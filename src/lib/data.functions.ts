import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const networkSchema = z.object({ network: z.enum(["mtn", "glo", "airtel", "9mobile"]) });

export const getDataPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => networkSchema.parse(d))
  .handler(async ({ data }) => {
    const { fetchDataPlans } = await import("./vtpass.server");
    const serviceID =
      data.network === "mtn" ? "mtn-data" :
      data.network === "glo" ? "glo-data" :
      data.network === "airtel" ? "airtel-data" : "etisalat-data";
    const plans = await fetchDataPlans(serviceID);
    return { serviceID, plans };
  });

const buySchema = z.object({
  network: z.enum(["mtn", "glo", "airtel", "9mobile"]),
  phone: z.string().regex(/^0\d{10}$/),
  variation_code: z.string().min(1),
  plan_label: z.string().min(1),
  amount: z.number().min(50).max(100000),
  pin: z.string().regex(/^\d{4}$/),
});

export const buyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => buySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { verifyUserPinServer } = await import("./pin.functions");
    const { vtpassPay } = await import("./vtpass.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { genRef } = await import("./format");

    const ok = await verifyUserPinServer(context.userId, data.pin);
    if (!ok) throw new Error("Incorrect transaction PIN");

    const serviceID =
      data.network === "mtn" ? "mtn-data" :
      data.network === "glo" ? "glo-data" :
      data.network === "airtel" ? "airtel-data" : "etisalat-data";

    const reference = genRef("DAT");

    await supabaseAdmin.rpc("debit_wallet", { _user_id: context.userId, _amount: data.amount });

    await supabaseAdmin.from("transactions").insert({
      user_id: context.userId,
      type: "data",
      status: "pending",
      amount: data.amount,
      reference,
      provider: "vtpass",
      network: data.network,
      recipient: data.phone,
      plan_code: data.variation_code,
      plan_label: data.plan_label,
    });

    const res = await vtpassPay({
      serviceID,
      request_id: reference,
      billersCode: data.phone,
      variation_code: data.variation_code,
      phone: data.phone,
    });

    await supabaseAdmin.from("vtpass_logs").insert({
      user_id: context.userId,
      endpoint: "/pay (data)",
      request_body: { serviceID, request_id: reference, variation_code: data.variation_code, phone: data.phone },
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

    await supabaseAdmin.rpc("credit_wallet", { _user_id: context.userId, _amount: data.amount });
    await supabaseAdmin
      .from("transactions")
      .update({ status: "failed", provider_ref: res.providerRef })
      .eq("reference", reference);
    throw new Error("Data purchase failed. You have been refunded.");
  });
