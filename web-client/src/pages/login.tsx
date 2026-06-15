import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[360px]">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-8">
          <span className="size-2 rounded-full bg-primary shrink-0" />
          <span className="text-sm font-semibold text-text-primary tracking-tight">Creavint Pulse</span>
        </div>

        <div className="rounded-[--radius-lg] border border-border bg-surface p-7">
          <h1 className="text-base font-semibold text-text-primary mb-1">Sign in</h1>
          <p className="text-xs text-text-tertiary mb-6">Internal staff access only.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@creavint.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                error={!!error}
              />
            </div>

            {error && (
              <p className="text-xs text-destructive-text bg-destructive-subtle rounded-[--radius] px-3 py-2">
                {error}
              </p>
            )}

            <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-text-disabled font-mono">
          Phase 1a — pilot
        </p>
      </div>
    </div>
  );
}
