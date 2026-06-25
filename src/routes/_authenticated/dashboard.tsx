import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Smartphone,
  Wifi,
  Plus,
  Receipt,
  Shield,
  ArrowRight,
  TrendingUp,
  ArrowDownLeft,
  Bell,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WalletCard } from "@/components/wallet-card";
import { UserAvatar } from "@/components/user-avatar";
import { getWallet, getTransactions } from "@/lib/wallet.functions";
import { hasPin } from "@/lib/pin.functions";
import { getProfile } from "@/lib/profile.functions";
import { formatDate, formatNaira } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HypeData" }] }),
  component: Dashboard,
});

const QUICK = [
  {
    to: "/airtime",
    label: "Buy Airtime",
    desc: "Top up instantly",
    icon: Smartphone,
    iconBg: "from-primary/90 to-primary/60",
  },
  {
    to: "/data",
    label: "Buy Data",
    desc: "All networks",
    icon: Wifi,
    iconBg: "from-accent/90 to-accent/60",
  },
  {
    to: "/fund",
    label: "Deposit",
    desc: "Fund wallet",
    icon: Plus,
    iconBg: "from-success/90 to-success/60",
  },
  {
    to: "/history",
    label: "History",
    desc: "View activity",
    icon: Receipt,
    iconBg: "from-warning/90 to-warning/60",
  },
] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


function Dashboard() {
  const qc = useQueryClient();
  const w = useServerFn(getWallet);
  const t = useServerFn(getTransactions);
  const p = useServerFn(hasPin);
  const pr = useServerFn(getProfile);
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => w() });
  const txns = useQuery({ queryKey: ["txns"], queryFn: () => t() });
  const pin = useQuery({ queryKey: ["hasPin"], queryFn: () => p() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => pr() });

  const [notifOpen, setNotifOpen] = useState(false);
  // Placeholder — wire to admin broadcasts later
  const notifications: Array<{ id: string; title: string; body: string; createdAt: string; read: boolean }> = [];
  const unread = notifications.filter((n) => !n.read).length;

  const balance = Number(wallet.data?.balance ?? 0);
  const all = txns.data ?? [];
  const recent = all.slice(0, 5);
  const firstName = (profile.data?.full_name || "").split(" ")[0] || "there";

  async function refreshWallet() {
    await qc.invalidateQueries({ queryKey: ["wallet"] });
  }

  return (
    <AppShell>
      {/* Header */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar src={profile.data?.avatar_url} size={44} className="shadow-glow" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{greeting()},</p>
            <h1 className="truncate font-display text-lg font-bold tracking-tight">
              {firstName} 👋
            </h1>
          </div>
        </div>
        <button
          onClick={() => setNotifOpen(true)}
          aria-label="Notifications"
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border/60 bg-card/60 transition hover:bg-card"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </header>

      {/* Wallet */}
      <WalletCard
        balance={balance}
        onRefresh={refreshWallet}
        refreshing={wallet.isFetching}
      />

      {/* PIN nudge */}
      {pin.data && !pin.data.hasPin && (
        <Link
          to="/pin"
          className="mt-4 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm transition hover:bg-warning/15"
        >
          <Shield className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-warning">Set your 4-digit PIN</p>
            <p className="text-xs text-muted-foreground">Required to authorize transactions.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-warning" />
        </Link>
      )}

      {/* Quick actions */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {QUICK.map((q, i) => (
            <Link
              key={q.to}
              to={q.to}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group animate-fade-in rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card active:scale-[0.98]"
            >
              <div
                className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${q.iconBg} shadow-glow transition group-hover:scale-110`}
              >
                <q.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <p className="mt-3 text-sm font-semibold">{q.label}</p>
              <p className="text-xs text-muted-foreground">{q.desc}</p>
            </Link>
          ))}
        </div>
      </section>


      {/* Recent */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            Recent transactions
          </h2>
          <Link to="/history" className="text-xs font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        {txns.isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-card/50" />
            ))}
          </div>
        )}
        {!txns.isLoading && recent.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-6 text-center">
            <TrendingUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No transactions yet. Buy airtime or data to get started.
            </p>
          </div>
        )}
        <ul className="space-y-2">
          {recent.map((r, i) => {
            const credit = r.type === "wallet_funding";
            return (
              <li
                key={r.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="flex animate-fade-in items-center gap-3 rounded-xl border border-border/50 bg-card/60 p-3 transition hover:border-primary/30 hover:bg-card"
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                    credit ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
                  }`}
                >
                  {r.type === "airtime" ? (
                    <Smartphone className="h-5 w-5" />
                  ) : r.type === "data" ? (
                    <Wifi className="h-5 w-5" />
                  ) : (
                    <ArrowDownLeft className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {r.type.replace("_", " ")}
                    {r.network ? ` · ${r.network.toUpperCase()}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${credit ? "text-success" : ""}`}>
                    {credit ? "+" : "-"}
                    {formatNaira(r.amount)}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Notifications drawer (UI only) */}
      {notifOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setNotifOpen(false)}
        >
          <div
            className="w-full max-w-md animate-fade-in rounded-t-3xl border border-border/60 bg-card p-5 shadow-card sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold">Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  Updates and announcements from HypeData
                </p>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">You're all caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New announcements will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-border/50 bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "success"
      ? "bg-success/15 text-success"
      : status === "failed"
      ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
