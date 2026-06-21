import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, wallets, txns, airtime, data, funding] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("wallets").select("balance"),
      supabaseAdmin.from("transactions").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("transactions").select("amount").eq("type", "airtime").eq("status", "success"),
      supabaseAdmin.from("transactions").select("amount").eq("type", "data").eq("status", "success"),
      supabaseAdmin.from("transactions").select("amount").eq("type", "wallet_funding").eq("status", "success"),
    ]);

    const totalBalance = (wallets.data ?? []).reduce((s, w) => s + Number(w.balance ?? 0), 0);
    const airtimeTotal = (airtime.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const dataTotal = (data.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const fundingTotal = (funding.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    return {
      totalUsers: users.count ?? 0,
      totalBalance,
      totalTransactions: txns.count ?? 0,
      airtimeCount: airtime.data?.length ?? 0,
      airtimeTotal,
      dataCount: data.data?.length ?? 0,
      dataTotal,
      fundingTotal,
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const [walletsRes, rolesRes] = await Promise.all([
      supabaseAdmin.from("wallets").select("user_id, balance").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const wMap = new Map((walletsRes.data ?? []).map((w) => [w.user_id, Number(w.balance)]));
    const rMap = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rMap.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      balance: wMap.get(p.id) ?? 0,
      roles: rMap.get(p.id) ?? [],
    }));
  });

export const listAllTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("id, user_id, type, status, amount, network, recipient, plan_label, reference, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const adjustSchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(["credit", "debit"]),
  amount: z.number().int().min(1).max(10_000_000),
  note: z.string().max(200).optional(),
});

export const adjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adjustSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { genRef } = await import("./format");

    const rpc = data.action === "credit" ? "credit_wallet" : "debit_wallet";
    const { error: rpcErr } = await supabaseAdmin.rpc(rpc, {
      _user_id: data.user_id,
      _amount: data.amount,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    await supabaseAdmin.from("transactions").insert({
      user_id: data.user_id,
      type: data.action === "credit" ? "wallet_funding" : "adjustment",
      status: "success",
      amount: data.amount,
      reference: genRef(data.action === "credit" ? "ADJC" : "ADJD"),
      provider: "admin",
      meta: { admin_id: context.userId, note: data.note ?? null, action: data.action },
    } as any);

    return { ok: true };
  });
