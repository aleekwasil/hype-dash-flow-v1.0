import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PinDialog } from "@/components/pin-dialog";
import { NETWORKS, type Network } from "@/lib/networks";
import { NetworkLogo } from "@/components/network-logo";
import { buyData, getDataPlans } from "@/lib/data.functions";
import { getWallet } from "@/lib/wallet.functions";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/data")({
  head: () => ({ meta: [{ title: "Buy Data — HypeData" }] }),
  component: DataPage,
});

function DataPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const w = useServerFn(getWallet);
  const g = useServerFn(getDataPlans);
  const b = useServerFn(buyData);
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => w() });

  const [network, setNetwork] = useState<Network>("mtn");
  const [phone, setPhone] = useState("");
  const [planCode, setPlanCode] = useState<string>("");
  const [pinOpen, setPinOpen] = useState(false);

  const plans = useQuery({
    queryKey: ["plans", network],
    queryFn: () => g({ data: { network } }),
  });

  const selected = plans.data?.plans.find((p) => p.variation_code === planCode);

  const mutation = useMutation({
    mutationFn: (pin: string) => b({
      data: {
        network, phone,
        variation_code: planCode,
        plan_label: selected?.name ?? "Data plan",
        amount: Number(selected?.variation_amount ?? 0),
        pin,
      }
    }),
    onSuccess: () => {
      toast.success("Data delivered ✨");
      setPinOpen(false);
      setPlanCode("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["txns"] });
      router.navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Purchase failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^0\d{10}$/.test(phone)) return toast.error("Enter a valid 11-digit phone");
    if (!planCode) return toast.error("Select a data plan");
    setPinOpen(true);
  }

  return (
    <AppShell title="Buy Data">
      <p className="mb-4 text-xs text-muted-foreground">
        Wallet: <span className="font-mono text-foreground">{formatNaira(wallet.data?.balance ?? 0)}</span>
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label className="mb-2 block">Network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => { setNetwork(n.id); setPlanCode(""); }}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
                  network === n.id
                    ? "border-primary bg-primary/15 text-foreground shadow-glow"
                    : "border-border/50 bg-card/50 text-muted-foreground hover:border-primary/50"
                }`}
              >
                <NetworkLogo network={n.id} size={36} />
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" inputMode="numeric" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" />
        </div>

        <div>
          <Label className="mb-2 block">Plan</Label>
          {plans.isLoading && <p className="text-sm text-muted-foreground">Loading plans…</p>}
          {plans.data?.plans.length === 0 && <p className="text-sm text-muted-foreground">No plans available.</p>}
          <div className="grid grid-cols-2 gap-2">
            {plans.data?.plans.map((p) => (
              <button
                key={p.variation_code}
                type="button"
                onClick={() => setPlanCode(p.variation_code)}
                className={`rounded-xl border p-3 text-left transition ${
                  planCode === p.variation_code
                    ? "border-primary bg-primary/15 shadow-glow"
                    : "border-border/50 bg-card/50 hover:border-primary/50"
                }`}
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-1 font-mono text-xs text-accent">{formatNaira(Number(p.variation_amount))}</p>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full bg-gradient-primary shadow-glow">
          {selected ? `Buy · ${formatNaira(Number(selected.variation_amount))}` : "Continue"}
        </Button>
      </form>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} loading={mutation.isPending} onConfirm={(pin) => mutation.mutate(pin)} />
    </AppShell>
  );
}
