import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  network: z.enum(["mtn", "glo", "airtel", "9mobile"]),
  phone: z.string().regex(/^0\d{10}$/, "Enter a valid 11-digit phone"),
  amount: z.number().int().min(50).max(50000),
  pin: z.string().regex(/^\d{4}$/),
});

export const buyAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { verifyUserPinServer } = await import("./pin.functions");
    const { vtpassPay } = await import("./vtpass.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { genRef } = await import("./format");

    const ok = await verifyUserPinServer(context.userId, data.pin);
    if (!ok) throw new Error("Incorrect transaction PIN");

    const serviceID = data.network === "9mobile" ? "etisalat" : data.network;
    const reference = genRef("AIR");

    // Debit first (atomic, throws insufficient_balance)
    await supabaseAdmin.rpc("debit_wallet", { _user_id: context.userId, _amount: data.amount });

    // Insert pending txn
    await supabaseAdmin.from("transactions").insert({
      user_id: context.userId,
      type: "airtime",
      status: "pending",
      amount: data.amount,
      reference,
      provider: "vtpass",
      network: data.network,
      recipient: data.phone,
    });

    const res = await vtpassPay({
      serviceID,
      request_id: reference,
      amount: data.amount,
      phone: data.phone,
    });

    await supabaseAdmin.from("vtpass_logs").insert({
      user_id: context.userId,
      endpoint: "/pay (airtime)",
      request_body: { serviceID, request_id: reference, amount: data.amount, phone: data.phone },
      response_body: res.raw,
      http_status: res.httpStatus,
      reference,
    });

    if (res.status === "success") {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "success", provider_ref: res.providerRef })
        .eq("reference", reference);
      return { ok: true, reference };
    }

    // Refund on failure
    await supabaseAdmin.rpc("credit_wallet", { _user_id: context.userId, _amount: data.amount });
    await supabaseAdmin
      .from("transactions")
      .update({ status: "failed", provider_ref: res.providerRef })
      .eq("reference", reference);
    throw new Error("Airtime purchase failed. You have been refunded.");
  });
