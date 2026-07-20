"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWP } from "@/lib/wp-login";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { FormField } from "@/app/components/ui/FormField";
import { Input } from "@/app/components/ui/Input";
import { StatusBanner } from "@/app/components/ui/StatusBanner";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      localStorage.getItem("wp_token") ||
      sessionStorage.getItem("wp_token");

    if (token) {
      router.replace("/");
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    try {
      setLoading(true);

      const data = await loginWP(username, password);

      if (remember) {
        localStorage.setItem("wp_token", data.token);
      } else {
        sessionStorage.setItem("wp_token", data.token);
      }

      router.replace("/");
    } catch {
      setLoginError("Login failed. Check your username and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-mrc-soft px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-mrc-text">
          Welcome to <span className="text-mrc-primary">My Road Club</span>
        </h1>

        <section aria-labelledby="login-heading" className="space-y-4">
          <h2 id="login-heading" className="sr-only">
            Sign in
          </h2>

          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <FormField id="login-username" label="Username">
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              )}
            </FormField>

            <FormField id="login-password" label="Password">
              {(controlProps) => (
                <div className="relative">
                  <Input
                    {...controlProps}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="pr-24"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-1 flex min-h-11 items-center px-3 text-xs font-bold text-mrc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </div>
              )}
            </FormField>

            <label
              htmlFor="login-remember"
              className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm font-medium text-mrc-text"
            >
              <input
                id="login-remember"
                type="checkbox"
                className="size-4 accent-mrc-primary"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>

            {loginError && <StatusBanner tone="error">{loginError}</StatusBanner>}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </section>

        <div
          className="my-6 flex items-center gap-3"
          role="separator"
          aria-label="or"
        >
          <span className="h-px flex-1 bg-mrc-border" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-mrc-muted">
            or
          </span>
          <span className="h-px flex-1 bg-mrc-border" aria-hidden="true" />
        </div>

        <section aria-labelledby="register-heading" className="space-y-3">
          <h2
            id="register-heading"
            className="text-center text-sm font-medium text-mrc-muted"
          >
            New to My Road Club?
          </h2>
          <a
            href="https://myroadclub.com/#membership"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-mrc-border bg-white px-4 py-2.5 text-sm font-bold text-mrc-primary transition hover:border-mrc-primary hover:bg-mrc-tint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
          >
            Register
          </a>
        </section>
      </Card>
    </main>
  );
}
