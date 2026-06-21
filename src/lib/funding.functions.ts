import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ amount: z.number().int().min(100).max(1_000_000) });

export const initFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { initTransaction, isPaystackConfigured } = await import("./paystack.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { genRef } = await import("./format");

    if (!isPaystackConfigured()) {
      throw new Error("Payments not configured. Ask the admin to add PAYSTACK_SECRET_KEY.");
    }

    const { data: profile } = await context.supabase
      .from("profiles").select("email").eq("id", context.userId).maybeSingle();
    if (!profile?.email) throw new Error("Email missing on profile.");

    const reference = genRef("FUND");

    await supabaseAdmin.from("funding_intents").insert({
      reference,
      user_id: context.userId,
      amount: data.amount,
      status: "pending",
    });

    const req = getRequest();
    const origin = req?.headers.get("origin") || req?.headers.get("referer")?.replace(/\/[^/]*$/, "") || "";
    const callbackUrl = `${origin}/fund?ref=${reference}`;

    const init = await initTransaction({
      email: profile.email,
      amountKobo: data.amount * 100,
      reference,
      callbackUrl,
      metadata: { user_id: context.userId, purpose: "wallet_funding" },
    });

    return { authorization_url: init.authorization_url, reference };
  });

const verifySchema = z.object({ reference: z.string().min(5) });

/** Optional client-side verify (webhook is the source of truth, but this gives instant feedback). */
export const verifyFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { verifyTransaction } = await import("./paystack.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: intent } = await supabaseAdmin
      .from("funding_intents").select("*").eq("reference", data.reference).maybeSingle();
    if (!intent || intent.user_id !== context.userId) throw new Error("Unknown reference");
    if (intent.status === "success") return { ok: true, alreadyCredited: true };

    const v = await verifyTransaction(data.reference);
    if (v.status !== "success") return { ok: false, status: v.status };

    const amount = v.amountKobo / 100;
    await supabaseAdmin.rpc("credit_wallet", { _user_id: context.userId, _amount: amount });
    await supabaseAdmin
      .from("funding_intents")
      .update({ status: "success", completed_at: new Date().toISOString() })
      .eq("reference", data.reference);
    await supabaseAdmin.from("transactions").insert({
      user_id: context.userId,
      type: "wallet_funding",
      status: "success",
      amount,
      reference: data.reference,
      provider: "paystack",
    });
    return { ok: true };
  });
