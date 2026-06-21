import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { initFunding, verifyFunding } from "@/lib/funding.functions";
import { getWallet } from "@/lib/wallet.functions";
import { formatNaira } from "@/lib/format";

const searchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/_authenticated/fund")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Fund Wallet — HypeData" }] }),
  component: Fund,
});

const QUICK = [500, 1000, 2000, 5000, 10000, 20000];

function Fund() {
  const qc = useQueryClient();
  const { ref } = useSearch({ from: "/_authenticated/fund" });
  const w = useServerFn(getWallet);
  const i = useServerFn(initFunding);
  const v = useServerFn(verifyFunding);
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => w() });

  const [amount, setAmount] = useState<number | "">("");

  const initMut = useMutation({
    mutationFn: () => i({ data: { amount: Number(amount) } }),
    onSuccess: (res) => {
      if (res.demo) {
        toast.success(`Wallet credited (demo mode) — ₦${Number(amount).toLocaleString()}`);
        setAmount("");
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["txns"] });
        return;
      }
      window.location.href = res.authorization_url;
    },
    onError: (e: any) => toast.error(e?.message ?? "Init failed"),
  });

  // If returning from Paystack with ?ref=, verify and credit immediately
  useEffect(() => {
    if (!ref) return;
    (async () => {
      try {
        const res = await v({ data: { reference: ref } });
        if (res.ok) {
          toast.success("Wallet funded!");
          qc.invalidateQueries({ queryKey: ["wallet"] });
          qc.invalidateQueries({ queryKey: ["txns"] });
        } else {
          toast.message("Payment not confirmed yet. We'll credit your wallet shortly.");
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Verification failed");
      }
    })();
  }, [ref, v, qc]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(amount);
    if (!a || a < 100) return toast.error("Minimum ₦100");
    initMut.mutate();
  }

  return (
    <AppShell title="Fund Wallet">
      <p className="mb-4 text-xs text-muted-foreground">
        Current balance: <span className="font-mono text-foreground">{formatNaira(wallet.data?.balance ?? 0)}</span>
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (NGN)</Label>
          <Input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")} placeholder="1000" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {QUICK.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm font-medium transition hover:border-primary"
              >
                ₦{a.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={initMut.isPending} className="w-full bg-gradient-primary shadow-glow">
          {initMut.isPending ? "Processing…" : "Fund Wallet"}
        </Button>

        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-center text-xs text-warning">
          Demo mode — wallet credits instantly. Add <span className="font-mono">PAYSTACK_SECRET_KEY</span> in secrets to enable real payments.
        </p>
      </form>
    </AppShell>
  );
}
