import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, LogOut, Fingerprint } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfile, isAdmin } from "@/lib/profile.functions";
import { hasPin } from "@/lib/pin.functions";
import {
  platformAuthenticatorAvailable,
  getStoredCredential,
  enrollBiometric,
  clearStoredCredential,
} from "@/lib/biometric";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — HypeData" }] }),
  component: Profile,
});

function Profile() {
  const g = useServerFn(getProfile);
  const u = useServerFn(updateProfile);
  const h = useServerFn(hasPin);
  const a = useServerFn(isAdmin);
  const router = useRouter();
  const qc = useQueryClient();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => g() });
  const pin = useQuery({ queryKey: ["hasPin"], queryFn: () => h() });
  const admin = useQuery({ queryKey: ["isAdmin"], queryFn: () => a() });

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(!!getStoredCredential());
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvailable);
  }, []);

  async function toggleBiometric(next: boolean) {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      if (!next) {
        clearStoredCredential();
        setBioEnabled(false);
        toast.success("Biometric login disabled on this device");
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again to enable biometrics");
      await enrollBiometric({
        userId: data.user.id,
        email: data.user.email ?? "",
        displayName: profile.data?.full_name ?? data.user.email ?? undefined,
      });
      setBioEnabled(true);
      toast.success("Biometric login enabled");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update biometric setting");
    } finally {
      setBioBusy(false);
    }
  }

  async function handleLogout() {
    clearStoredCredential();
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  const mutation = useMutation({
    mutationFn: () => u({ data: { full_name: fullName, phone } }),
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  return (
    <AppShell title="Profile">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
        <UserAvatar src={profile.data?.avatar_url} size={56} className="shadow-glow" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{profile.data?.full_name || "Your name"}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.data?.email}</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={profile.data?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <div className="mt-6 space-y-2">
        <Link to="/pin" className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4">
          <div>
            <p className="font-medium">Transaction PIN</p>
            <p className="text-xs text-muted-foreground">{pin.data?.hasPin ? "Change your 4-digit PIN" : "Set your 4-digit PIN"}</p>
          </div>
          <span className="text-xs text-primary">{pin.data?.hasPin ? "Change" : "Set up"} →</span>
        </Link>

        {bioAvailable && (
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Biometric login</p>
                <p className="text-xs text-muted-foreground">Use Face ID, Touch ID or fingerprint on this device.</p>
              </div>
            </div>
            <Switch checked={bioEnabled} disabled={bioBusy} onCheckedChange={toggleBiometric} />
          </div>
        )}

        {admin.data?.isAdmin && (
          <Link
            to="/admin"
            className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-accent" />
              <div>
                <p className="font-medium text-accent">Admin dashboard</p>
                <p className="text-xs text-muted-foreground">Manage users, wallets and transactions</p>
              </div>
            </div>
            <span className="text-xs text-accent">Open →</span>
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4 text-left transition hover:border-destructive/40 hover:bg-destructive/5"
        >
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">End your current session</p>
            </div>
          </div>
        </button>
      </div>
    </AppShell>
  );
}
