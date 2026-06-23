import { useState } from "react";
import { Eye, EyeOff, RefreshCw, Copy, Check, Building2 } from "lucide-react";
import { formatNaira } from "@/lib/format";

export type VirtualAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export function WalletCard({
  balance,
  account,
  onRefresh,
  refreshing,
}: {
  balance: number;
  account?: VirtualAccount | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [show, setShow] = useState(true);
  const [copied, setCopied] = useState(false);

  // Placeholder until virtual account providers (PalmPay, 9PSB, Kolomoni MFB) are wired
  const acct: VirtualAccount = account ?? {
    bankName: "PalmPay",
    accountNumber: "—— —— ——",
    accountName: "Pending assignment",
  };

  async function copyAcct() {
    try {
      await navigator.clipboard.writeText(acct.accountNumber.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-card p-6 text-white shadow-glow">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />

      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
          Available balance
        </p>
        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
          NGN
        </span>
      </div>

      <div className="relative mt-3 flex items-end gap-2">
        <p className="font-display text-4xl font-bold leading-none tracking-tight">
          {show ? formatNaira(balance) : "₦ • • • • •"}
        </p>
        <button
          onClick={() => setShow((s) => !s)}
          className="mb-1 rounded-full p-1 text-white/80 transition hover:bg-white/10"
          aria-label="Toggle balance"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="mb-1 rounded-full p-1 text-white/80 transition hover:bg-white/10 disabled:opacity-60"
          aria-label="Refresh balance"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Virtual account details */}
      <div className="relative mt-5 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/20">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Fund via transfer</p>
              <p className="text-xs font-semibold">{acct.bankName}</p>
            </div>
          </div>
          <button
            onClick={copyAcct}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold transition hover:bg-white/25"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Account number</p>
            <p className="font-display text-lg font-bold tracking-wider">{acct.accountNumber}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Account name</p>
            <p className="truncate text-xs font-semibold">{acct.accountName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
