import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-paystack-signature");
        const { verifyPaystackSignature } = await import("@/lib/paystack.server");
        const ok = await verifyPaystackSignature(raw, sig);
        if (!ok) return new Response("invalid signature", { status: 401 });

        let event: any;
        try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        if (event?.event !== "charge.success") return new Response("ignored", { status: 200 });

        const reference: string = event?.data?.reference;
        const amountKobo: number = Number(event?.data?.amount ?? 0);
        if (!reference) return new Response("missing ref", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: intent } = await supabaseAdmin
          .from("funding_intents").select("*").eq("reference", reference).maybeSingle();
        if (!intent) return new Response("unknown reference", { status: 200 });
        if (intent.status === "success") return new Response("already processed", { status: 200 });

        const amount = amountKobo / 100;
        await supabaseAdmin.rpc("credit_wallet", { _user_id: intent.user_id, _amount: amount });
        await supabaseAdmin
          .from("funding_intents")
          .update({ status: "success", completed_at: new Date().toISOString() })
          .eq("reference", reference);
        await supabaseAdmin.from("transactions").insert({
          user_id: intent.user_id,
          type: "wallet_funding",
          status: "success",
          amount,
          reference,
          provider: "paystack",
          meta: { source: "webhook" },
        });
        return new Response("ok", { status: 200 });
      },
    },
  },
});
