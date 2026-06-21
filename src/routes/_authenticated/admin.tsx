import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Wallet, Receipt, Smartphone, Wifi, TrendingUp, Plus, Minus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira, formatDate } from "@/lib/format";
import { getAdminStats, listUsers, listAllTransactions, adjustWallet } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — HypeData" }] }),
  beforeLoad: async () => {
    try {
      const res = await (await import("@/lib/profile.functions")).isAdmin();
      if (!res.isAdmin) throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur transition hover:border-primary/40 hover:shadow-glow">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-lg bg-primary/15 ${accent ?? "text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const s = useServerFn(getAdminStats);
  const u = useServerFn(listUsers);
  const t = useServerFn(listAllTransactions);
  const a = useServerFn(adjustWallet);

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => s() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => u() });
  const txns = useQuery({ queryKey: ["admin-txns"], queryFn: () => t() });

  const [target, setTarget] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [action, setAction] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const adjust = useMutation({
    mutationFn: () => a({ data: { user_id: target!.id, action, amount: Number(amount), note: note || undefined } }),
    onSuccess: () => {
      toast.success(`Wallet ${action === "credit" ? "credited" : "debited"}`);
      setTarget(null);
      setAmount("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-txns"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Adjustment failed"),
  });

  return (
    <AppShell title="Admin">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Users" value={String(stats.data?.totalUsers ?? "—")} />
        <StatCard icon={Wallet} label="Total Wallets" value={formatNaira(stats.data?.totalBalance ?? 0)} />
        <StatCard icon={Receipt} label="Transactions" value={String(stats.data?.totalTransactions ?? "—")} />
        <StatCard icon={TrendingUp} label="Deposits" value={formatNaira(stats.data?.fundingTotal ?? 0)} />
        <StatCard icon={Smartphone} label={`Airtime (${stats.data?.airtimeCount ?? 0})`} value={formatNaira(stats.data?.airtimeTotal ?? 0)} />
        <StatCard icon={Wifi} label={`Data (${stats.data?.dataCount ?? 0})`} value={formatNaira(stats.data?.dataTotal ?? 0)} />
      </div>

      <Tabs defaultValue="users" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-2">
          {users.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {users.data?.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                {(u.full_name ?? u.email ?? "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.full_name ?? "—"} {u.roles.includes("admin") && <span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">admin</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email ?? u.phone ?? u.id.slice(0, 8)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{formatNaira(u.balance)}</p>
                <button
                  onClick={() => { setTarget({ id: u.id, name: u.full_name ?? u.email ?? u.id.slice(0,8), balance: u.balance }); setAction("credit"); }}
                  className="text-[11px] text-primary hover:underline"
                >Adjust</button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="txns" className="mt-4 space-y-2">
          {txns.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {txns.data?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/50 bg-card/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium capitalize">{r.type.replace(/_/g, " ")} {r.network ? `· ${r.network.toUpperCase()}` : ""}</p>
                <p className={`text-sm font-semibold ${r.type === "wallet_funding" ? "text-success" : ""}`}>
                  {r.type === "wallet_funding" ? "+" : "-"}{formatNaira(r.amount)}
                </p>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate">{r.recipient ?? r.user_id.slice(0, 8)} · {formatDate(r.created_at)}</span>
                <span className={`uppercase tracking-wider ${
                  r.status === "success" ? "text-success" :
                  r.status === "failed" ? "text-destructive" : "text-muted-foreground"
                }`}>{r.status}</span>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust wallet · {target?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Current balance: <span className="font-mono">{formatNaira(target?.balance ?? 0)}</span></p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setAction("credit")} className={`flex items-center justify-center gap-1 rounded-lg border p-2 text-sm font-medium ${action==="credit" ? "border-success bg-success/15 text-success" : "border-border/50"}`}>
              <Plus className="h-4 w-4" /> Credit
            </button>
            <button onClick={() => setAction("debit")} className={`flex items-center justify-center gap-1 rounded-lg border p-2 text-sm font-medium ${action==="debit" ? "border-destructive bg-destructive/15 text-destructive" : "border-border/50"}`}>
              <Minus className="h-4 w-4" /> Debit
            </button>
          </div>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="adj-amt">Amount (NGN)</Label>
            <Input id="adj-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="adj-note">Note (optional)</Label>
            <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Manual adjustment" />
          </div>

          <Button
            onClick={() => adjust.mutate()}
            disabled={!amount || adjust.isPending}
            className="mt-4 w-full bg-gradient-primary shadow-glow"
          >
            {adjust.isPending ? "Processing…" : `Confirm ${action}`}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
