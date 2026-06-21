import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Shield, Wifi, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLockup } from "@/components/brand-logo";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "HypeData — Airtime & Data, Instantly" },
      { name: "description", content: "Buy airtime and data on all Nigerian networks. Fast, secure, wallet-powered." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <BrandLockup size={36} />

        <div className="mt-16 flex-1">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-balance">
            Airtime & data,{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">instantly.</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Top up any Nigerian network from one wallet. Lightning-fast checkout, transparent pricing, military-grade security.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: Zap, title: "Instant delivery", desc: "Topped up in seconds, every time." },
              { icon: Wifi, title: "All networks", desc: "MTN, Glo, Airtel, 9mobile." },
              { icon: Shield, title: "PIN-protected", desc: "4-digit PIN on every transaction." },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          to="/auth"
          className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-4 font-medium text-primary-foreground shadow-glow transition hover:opacity-95"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <Link to="/auth" className="text-primary underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
