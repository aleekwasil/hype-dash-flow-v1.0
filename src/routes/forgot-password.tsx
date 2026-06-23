import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: `Reset password — ${BRAND.name}` },
      { name: "description", content: `Reset your ${BRAND.name} account password.` },
    ],
  }),
  component: ForgotPasswordPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address");

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent. Check your email.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send reset email.");
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

        <header className="animate-fade-in flex flex-col items-center text-center">
          <BrandLogo size={48} className="shadow-glow" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Forgot password?</h1>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Enter your email and we'll send you a secure link to reset it.
          </p>
        </header>

        <section className="animate-scale-in mt-6 rounded-2xl border border-white/10 bg-card/40 p-5 shadow-card backdrop-blur-xl sm:p-7">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold">Check your inbox</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
                It may take a minute to arrive.
              </p>
              <Button asChild className="mt-5 w-full bg-gradient-primary shadow-glow">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-primary shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Remembered it?{" "}
                <Link to="/auth" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
