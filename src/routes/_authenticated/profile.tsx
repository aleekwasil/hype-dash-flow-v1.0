import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  Fingerprint,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Shield,
  Smartphone,
  User,
  AtSign,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfile, isAdmin } from "@/lib/profile.functions";
import { hasPin } from "@/lib/pin.functions";
import {
  platformAuthenticatorAvailable,
  getStoredCredential,
  enrollBiometric,
  clearStoredCredential,
  webauthnCreateAllowed,
} from "@/lib/biometric";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — HypeData" }] }),
  component: Profile,
});

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm shadow-card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  right,
  onClick,
  to,
  destructive = false,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  to?: string;
  destructive?: boolean;
}) {
  const content = (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${destructive ? "text-destructive" : ""}`}>
          {label}
        </p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {right ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  const className =
    "flex items-center gap-3 rounded-xl p-3 text-left transition hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

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

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");

  // Password change dialog
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  // Notifications & info sheets
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvailable);
  }, []);

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const metaUsername = session?.user.user_metadata?.username;
      const fallback = session?.user.email?.split("@")[0] ?? "";
      setUsername(typeof metaUsername === "string" && metaUsername.trim() ? metaUsername : fallback);
    });
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

  const mutation = useMutation({
    mutationFn: async () => {
      await u({ data: { full_name: fullName, phone } });
      const { data, error } = await supabase.auth.updateUser({
        data: { username: username.trim() || undefined },
      });
      if (error) throw error;
      const returnedUsername = data.user?.user_metadata?.username;
      if (typeof returnedUsername === "string") setUsername(returnedUsername);
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.data?.email) {
      toast.error("Email not available");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile.data.email,
        password: currentPw,
      });
      if (authError) throw new Error("Current password is incorrect");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) throw updateError;
      toast.success("Password updated successfully");
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update password");
    } finally {
      setPwBusy(false);
    }
  }

  const email = profile.data?.email ?? "";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Profile header */}
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-surface/90 to-card/60 p-6 text-center shadow-card backdrop-blur-xl">
          <div className="bg-gradient-hero absolute inset-0 -z-10 opacity-60" />
          <UserAvatar
            src={profile.data?.avatar_url}
            size={96}
            className="mx-auto shadow-glow"
          />
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            {profile.data?.full_name || "Your name"}
          </h1>
          <p className="mt-1 text-sm font-medium text-primary">@{username || "username"}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
        </div>

        {/* Personal Information */}
        <SectionCard title="Personal Information">
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Full name
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="flex items-center gap-2">
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email address
              </Label>
              <Input id="email" value={email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone number
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>
            <Button
              type="submit"
              disabled={mutation.isPending || profile.isLoading}
              className="w-full"
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </SectionCard>

        {/* Security */}
        <SectionCard title="Security">
          <Row
            icon={KeyRound}
            label="Change transaction PIN"
            description={pin.data?.hasPin ? "Change your 4-digit PIN" : "Set your 4-digit PIN"}
            to="/pin"
          />
          <Row
            icon={Lock}
            label="Change password"
            description="Update your account password"
            onClick={() => setPwOpen(true)}
          />
          {bioAvailable && (
            <div className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-accent/5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Fingerprint className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Biometric login</p>
                  <p className="text-xs text-muted-foreground">
                    Use Face ID, Touch ID or fingerprint on this device
                  </p>
                </div>
              </div>
              <Switch
                checked={bioEnabled}
                disabled={bioBusy || (!bioEnabled && !webauthnCreateAllowed())}
                onCheckedChange={toggleBiometric}
              />
            </div>
          )}
          {!bioEnabled && !webauthnCreateAllowed() && bioAvailable && (
            <p className="px-3 text-xs text-warning">
              Biometric setup is blocked inside this preview. Open the app in a new browser tab or your published site to enable it.
            </p>
          )}
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account">
          <Row
            icon={Bell}
            label="Notifications"
            description="View alerts and announcements"
            onClick={() => setNotificationsOpen(true)}
          />
          <Row
            icon={HelpCircle}
            label="Help & Support"
            description="Get help with your account"
            onClick={() => setHelpOpen(true)}
          />
          <Row
            icon={Info}
            label="About HypeData"
            description="Learn more about the app"
            onClick={() => setAboutOpen(true)}
          />
          {admin.data?.isAdmin && (
            <Row
              icon={Shield}
              label="Admin dashboard"
              description="Manage users, wallets and transactions"
              to="/admin"
            />
          )}
        </SectionCard>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-left transition hover:bg-destructive/10"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <LogOut className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">Sign out</p>
            <p className="text-xs text-muted-foreground">End your current session</p>
          </div>
        </button>
      </div>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-md border-border/60 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter your current password and a new secure password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPw">Current password</Label>
              <div className="relative">
                <Input
                  id="currentPw"
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Current password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPw">New password</Label>
              <div className="relative">
                <Input
                  id="newPw"
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPw">Confirm new password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
                required
                minLength={8}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pwBusy} className="w-full">
                {pwBusy ? "Updating…" : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notifications sheet */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="bottom" className="border-border/60 bg-card/95 backdrop-blur-xl">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>Alerts and announcements from HypeData.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium">No new notifications</p>
            <p className="text-xs text-muted-foreground">Admin broadcasts will appear here soon.</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Help & support dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md border-border/60 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Help & Support</DialogTitle>
            <DialogDescription>Need assistance? Our support team is ready to help.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <a
              href="https://wa.me/2347087950366"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 p-3 transition hover:bg-[#25D366]/15"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white">
                <WhatsAppIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">WhatsApp Support</p>
                <p className="text-xs text-muted-foreground">0708 795 0366</p>
                <p className="mt-0.5 text-xs text-[#25D366]">Chat with our support team</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
            <div className="flex items-center gap-3 rounded-xl border border-border/50 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Email support</p>
                <p className="text-xs text-muted-foreground">support@hypedata.ng</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              For fastest help, include your registered email and a description of the issue.
            </p>
          </div>
          <DialogFooter>
            <Button asChild className="w-full">
              <a href="mailto:support@hypedata.ng">Contact support</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* About dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-md border-border/60 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>About HypeData</DialogTitle>
            <DialogDescription>Nigeria&apos;s fastest data & airtime platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>Buy airtime, purchase data bundles, fund your wallet and track your transactions securely in seconds.</p>
            <p>Version <span className="font-mono text-foreground">1.0.0</span></p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAboutOpen(false)} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
