import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Zap, ShieldCheck, Headphones, Mail, Lock, User, Phone, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  biometricSupported,
  platformAuthenticatorAvailable,
  getStoredCredential,
  verifyBiometric,
  enrollBiometric,
  clearStoredCredential,
} from "@/lib/biometric";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Sign in — ${BRAND.name}` },
      { name: "description", content: `Sign in or create your ${BRAND.name} account to buy airtime, data, and manage your wallet securely.` },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address");
const passSchema = z.string().min(8, "Password must be at least 8 characters");

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Too weak", color: "bg-destructive" },
    { label: "Weak", color: "bg-destructive" },
    { label: "Fair", color: "bg-warning" },
    { label: "Good", color: "bg-warning" },
    { label: "Strong", color: "bg-success" },
    { label: "Excellent", color: "bg-success" },
  ];
  return { score, ...map[Math.min(score, 5)] };
}

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false);
  const [storedBio, setStoredBio] = useState(getStoredCredential());
  const [askEnroll, setAskEnroll] = useState<{ userId: string; email: string; displayName?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformAuthenticatorAvailable().then((ok) => { if (!cancelled) setBioAvailable(ok); });
    return () => { cancelled = true; };
  }, []);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const canBiometricLogin = bioAvailable && !!storedBio;

  async function finishLogin() {
    router.invalidate();
    navigate({ to: "/dashboard" });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      passSchema.parse(password);
      if (tab === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: parsedEmail, password });
        if (error) throw error;
        toast.success("Welcome back");
        // Offer biometric enrollment if available and not yet enrolled for this user
        if (data.user && bioAvailable && (!storedBio || storedBio.userId !== data.user.id)) {
          setAskEnroll({ userId: data.user.id, email: parsedEmail, displayName: data.user.user_metadata?.full_name });
          setLoading(false);
          return;
        }
        await finishLogin();
      } else {
        if (password !== confirm) throw new Error("Passwords do not match");
        const { error } = await supabase.auth.signUp({
          email: parsedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created");
        await finishLogin();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
      if (res.error) throw res.error;
      if (res.redirected) return;
      await finishLogin();
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    setLoading(true);
    try {
      await verifyBiometric();
      // Check the stored session is still valid; if not, the user must sign in normally.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.message("Session expired. Please sign in with your password to continue.");
        return;
      }
      toast.success("Welcome back");
      await finishLogin();
    } catch (err: any) {
      const msg = err?.message ?? "Biometric login failed";
      toast.error(`${msg}. Please use your password.`);
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnroll() {
    if (!askEnroll) return;
    setLoading(true);
    try {
      const stored = await enrollBiometric(askEnroll);
      setStoredBio(stored);
      toast.success("Biometric login enabled");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not enable biometrics");
    } finally {
      setAskEnroll(null);
      setLoading(false);
      await finishLogin();
    }
  }

  function skipEnroll() {
    setAskEnroll(null);
    finishLogin();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:max-w-lg sm:px-6 sm:py-12">
        {/* Hero */}
        <header className="animate-fade-in flex flex-col items-center text-center">
          <BrandLogo size={56} className="shadow-glow" />
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl text-balance">
            Welcome to {BRAND.name}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground sm:text-base">
            Airtime, data and wallet — fast and secure.
          </p>
        </header>

        {/* Biometric quick login */}
        {canBiometricLogin && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={loading}
            className="animate-scale-in mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary shadow-glow transition active:scale-[0.99]"
          >
            <Fingerprint className="h-5 w-5" />
            Login with biometrics
          </button>
        )}

        {/* Auth Card — glass */}
        <section
          className="animate-scale-in mt-4 rounded-2xl border border-white/10 bg-card/40 p-5 shadow-card backdrop-blur-xl sm:mt-6 sm:p-7"
          style={{ animationDelay: "80ms" }}
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/40">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleEmail} className="space-y-4">
                <FieldEmail value={email} onChange={setEmail} />
                <div className="space-y-1.5">
                  <FieldPassword
                    value={password}
                    onChange={setPassword}
                    show={showPw}
                    onToggle={() => setShowPw((s) => !s)}
                  />
                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-gradient-primary text-base font-semibold shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? "Please wait…" : "Sign in"}
                </Button>
                {storedBio && (
                  <button
                    type="button"
                    onClick={() => { clearStoredCredential(); setStoredBio(null); toast.success("Biometric login disabled on this device"); }}
                    className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    Disable biometric login on this device
                  </button>
                )}
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleEmail} className="space-y-4">
                <Field label="Full name" id="fullName" icon={<User className="h-4 w-4" />}>
                  <Input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="pl-9"
                  />
                </Field>
                <FieldEmail value={email} onChange={setEmail} />
                <Field label="Phone" id="phone" icon={<Phone className="h-4 w-4" />}>
                  <Input
                    id="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08012345678"
                    inputMode="tel"
                    className="pl-9"
                  />
                </Field>
                <FieldPassword
                  value={password}
                  onChange={setPassword}
                  show={showPw}
                  onToggle={() => setShowPw((s) => !s)}
                />

                {password && (
                  <div className="space-y-1.5">
                    <div className="flex h-1.5 gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-full flex-1 rounded-full transition-colors ${
                            i < strength.score ? strength.color : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Strength: <span className="font-medium text-foreground">{strength.label}</span>
                    </p>
                  </div>
                )}

                <Field
                  label="Confirm password"
                  id="confirm"
                  icon={<Lock className="h-4 w-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                >
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-gradient-primary text-base font-semibold shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? "Please wait…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-card/0 px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="h-11 w-full border-white/15 bg-white/5 hover:bg-white/10"
          >
            <GoogleIcon /> Continue with Google
          </Button>
        </section>

        {/* Trust section */}
        <section
          className="animate-fade-in mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-3"
          style={{ animationDelay: "160ms" }}
        >
          <TrustCard icon={<Zap className="h-4 w-4" />} title="Fast Delivery" desc="Airtime & data in seconds." />
          <TrustCard icon={<ShieldCheck className="h-4 w-4" />} title="Secure" desc="Bank-grade encryption." />
          <TrustCard icon={<Headphones className="h-4 w-4" />} title="24/7 Support" desc="We're always here." />
        </section>

        {/* Footer */}
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Terms</Link>
          <span className="opacity-30">•</span>
          <Link to="/" className="hover:text-foreground">Privacy</Link>
          <span className="opacity-30">•</span>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground">Support</a>
        </footer>
      </div>

      {/* Biometric enrollment sheet */}
      {askEnroll && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md animate-fade-in rounded-t-3xl border border-border/60 bg-card p-6 shadow-card sm:rounded-3xl">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
              <Fingerprint className="h-7 w-7" />
            </div>
            <h3 className="text-center font-display text-lg font-bold">Enable biometric login?</h3>
            <p className="mt-1.5 text-center text-sm text-muted-foreground">
              Sign in faster next time using your fingerprint or face on this device. You can always use your password.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={skipEnroll} disabled={loading}>Not now</Button>
              <Button onClick={confirmEnroll} disabled={loading} className="bg-gradient-primary shadow-glow">
                {loading ? "Enabling…" : "Enable"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  id,
  icon,
  trailing,
  children,
}: {
  label: string;
  id: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        {children}
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>
        )}
      </div>
    </div>
  );
}

function FieldEmail({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Email" id="email" icon={<Mail className="h-4 w-4" />}>
      <Input
        id="email"
        type="email"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
        className="pl-9"
      />
    </Field>
  );
}

function FieldPassword({
  value,
  onChange,
  show,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <Field
      label="Password"
      id="password"
      icon={<Lock className="h-4 w-4" />}
      trailing={
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    >
      <Input
        id="password"
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
        className="pl-9 pr-9"
      />
    </Field>
  );
}

function TrustCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card/30 p-3 backdrop-blur-md transition-colors hover:bg-card/50">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}
