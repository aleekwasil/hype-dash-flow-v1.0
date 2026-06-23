import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: `Set new password — ${BRAND.name}` }] }),
  component: ResetPasswordPage,
});

function passwordStrength(pw: string) {
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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);

  // Supabase fires PASSWORD_RECOVERY after parsing the recovery link from the URL.
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also flag ready if we already have a session (link processed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 sm:px-6 sm:py-12">
        <Link to="/auth" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <header className="flex flex-col items-center text-center">
          <BrandLogo size={48} className="shadow-glow" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
        </header>

        <section className="mt-6 rounded-2xl border border-white/10 bg-card/40 p-5 shadow-card backdrop-blur-xl sm:p-7">
          {!ready ? (
            <p className="text-center text-sm text-muted-foreground">
              Validating reset link… If nothing happens, request a new link from the{" "}
              <Link to="/forgot-password" className="text-primary hover:underline">forgot password</Link> page.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <PwField id="new" label="New password" value={password} onChange={setPassword} show={show} onToggle={() => setShow((s) => !s)} />
              {password && (
                <div className="space-y-1.5">
                  <div className="flex h-1.5 gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`h-full flex-1 rounded-full transition-colors ${i < strength.score ? strength.color : "bg-muted"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Strength: <span className="font-medium text-foreground">{strength.label}</span></p>
                </div>
              )}
              <PwField id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} show={show} onToggle={() => setShow((s) => !s)} />
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function PwField({
  id, label, value, onChange, show, onToggle,
}: { id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="pl-9 pr-9"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
