import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  if (!isLoading && user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: hero image — hidden on mobile */}
      <div className="relative hidden lg:block lg:w-3/5 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=85"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark scrim */}
        <div className="absolute inset-0" style={{ background: "oklch(0.09 0.018 258 / 0.72)" }} />
        {/* Branding on image */}
        <div className="absolute top-7 left-8 flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-white/50" />
          <span className="text-sm font-medium text-white/60">Creavint Pulse</span>
        </div>
        {/* Photo credit */}
        <div className="absolute bottom-7 left-8 font-mono text-xs text-white/25">
          Photo: NASA · Unsplash
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-8 py-16">
        <div className="w-full max-w-[340px]">
          {/* Mobile-only wordmark */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <span className="size-2 rounded-full bg-accent" />
            <span className="text-sm font-semibold text-text-primary">Creavint Pulse</span>
          </div>

          <div className="mb-8 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
            <p className="text-sm text-text-secondary">Operations access is logged.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <div className="rounded-[--radius] bg-destructive-subtle border border-destructive/30 px-3 py-2.5">
                <p className="text-sm text-destructive-text">{error}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-7 text-center text-xs text-text-tertiary">
            Contact an administrator for an account.
          </p>
        </div>
      </div>
    </div>
  );
}
