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
import { buyAirtime } from "@/lib/airtime.functions";
import { getWallet } from "@/lib/wallet.functions";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/airtime")({
  head: () => ({ meta: [{ title: "Buy Airtime — HypeData" }] }),
  component: Airtime,
});

const QUICK = [100, 200, 500, 1000, 2000, 5000];

function Airtime() {
  const qc = useQueryClient();
  const router = useRouter();
  const w = useServerFn(getWallet);
  const b = useServerFn(buyAirtime);
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => w() });

  const [network, setNetwork] = useState<Network>("mtn");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [pinOpen, setPinOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (pin: string) => b({ data: { network, phone, amount: Number(amount), pin } }),
    onSuccess: () => {
      toast.success("Airtime sent ✨");
      setPinOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["txns"] });
      router.navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Purchase failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^0\d{10}$/.test(phone)) return toast.error("Enter a valid 11-digit phone");
    const amt = Number(amount);
    if (!amt || amt < 50) return toast.error("Minimum amount is ₦50");
    setPinOpen(true);
  }

  return (
    <AppShell title="Buy Airtime">
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
                onClick={() => setNetwork(n.id)}
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

        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")} placeholder="500" />
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

        <Button type="submit" className="w-full bg-gradient-primary shadow-glow">Continue</Button>
      </form>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} loading={mutation.isPending} onConfirm={(pin) => mutation.mutate(pin)} />
    </AppShell>
  );
}
