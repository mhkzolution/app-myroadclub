"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMemberProfile } from "@/app/hooks/useMemberProfile";
import { getAuthToken, logout } from "@/lib/auth";
import {
  MEMBER_PROFILE_UPDATED_EVENT,
  getMemberProfile,
  memberProfileErrorMessage,
} from "@/lib/wp-profile";
import { Button } from "./ui/Button";
import { FormField } from "./ui/FormField";
import { Input } from "./ui/Input";
import { StatusBanner } from "./ui/StatusBanner";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex !== -1
  );
}

function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  if (event.key !== "Tab") return;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const focusIsInside = active !== null && container.contains(active);

  if (focusable.length === 1) {
    event.preventDefault();
    first.focus();
    return;
  }

  if (event.shiftKey) {
    if (!focusIsInside || active === first) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (!focusIsInside || active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function AccountMenu() {
  const { profile, loading: profileLoading, error: profileError } = useMemberProfile();
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [confirmLogout, setConfirmLogout] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const logoutTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const logoutDialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the close button on open; restore focus to the trigger whenever
  // the drawer closes (Escape, backdrop click, or explicit close).
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    return () => {
      trigger?.focus();
    };
  }, [open]);

  // Same pattern for the logout confirmation dialog nested inside the drawer.
  useEffect(() => {
    if (!confirmLogout) return;
    const logoutTrigger = logoutTriggerRef.current;
    cancelButtonRef.current?.focus();
    return () => {
      logoutTrigger?.focus();
    };
  }, [confirmLogout]);

  useEffect(() => {
    if (!open && !confirmLogout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmLogout) {
          setConfirmLogout(false);
          return;
        }
        close();
        return;
      }

      const trapRoot = confirmLogout
        ? logoutDialogRef.current
        : open
          ? drawerRef.current
          : null;
      if (!trapRoot) return;
      trapFocus(trapRoot, e);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, confirmLogout, close]);

  useEffect(() => {
    setHasToken(Boolean(getAuthToken()));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    let authenticated = false;
    try {
      setLoading(true);
      setLoginError(null);

      const res = await fetch(
        "https://myroadclub.com/wp-json/jwt-auth/v1/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: email,
            password: password
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setLoginError("Sign-in failed. Check your email and password.");
        return;
      }

      if (typeof data.token !== "string" || !data.token) {
        setLoginError("Sign-in failed. Please try again.");
        return;
      }

      localStorage.setItem("wp_token", data.token);
      authenticated = true;
      setHasToken(true);
      await getMemberProfile(true);
      window.dispatchEvent(new Event(MEMBER_PROFILE_UPDATED_EVENT));
      setEmail("");
      setPassword("");
    } catch {
      setLoginError(
        authenticated
          ? "Signed in, but your profile could not be loaded. Check your connection."
          : "Could not reach My Road Club. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-mrc-border bg-white px-3 py-2 text-xs font-bold text-mrc-text shadow-sm transition hover:border-mrc-primary hover:text-mrc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mrc-account-panel"
        aria-haspopup="dialog"
      >
        <span className="flex shrink-0 text-mrc-primary" aria-hidden>
          <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span className="whitespace-nowrap">My Account</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[200] cursor-pointer border-none bg-mrc-text/45 p-0"
            tabIndex={-1}
            aria-label="Close account menu"
            onClick={close}
          />
          <aside
            ref={drawerRef}
            id="mrc-account-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mrc-account-title"
            className="fixed inset-y-0 right-0 z-[210] flex h-dvh w-full max-w-sm flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] motion-safe:animate-[mrc-account-slide-in_0.28s_ease-out] motion-reduce:animate-none"
          >
            <div
              className="flex items-center justify-between gap-3 border-b border-mrc-border bg-gradient-to-b from-mrc-tint to-white px-4 py-3.5"
              style={{ paddingTop: "max(0.875rem, env(safe-area-inset-top))" }}
            >
              <h2 id="mrc-account-title" className="text-lg font-bold text-mrc-text">
                My Account
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-mrc-soft text-2xl leading-none text-mrc-text transition hover:bg-mrc-border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
                onClick={close}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto px-4 py-5"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <p className="mb-4 text-sm leading-relaxed text-mrc-muted">
                View and update your My Road Club member profile.
              </p>
              {hasToken === null ? (
                <p className="text-xs text-mrc-muted" role="status">
                  Checking your account…
                </p>
              ) : !hasToken ? (
                <form className="space-y-3" onSubmit={handleLogin} noValidate>
                  <FormField id="account-email" label="Email">
                    {(controlProps) => (
                      <Input
                        {...controlProps}
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField id="account-password" label="Password">
                    {(controlProps) => (
                      <Input
                        {...controlProps}
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    )}
                  </FormField>
                  <Button type="submit" loading={loading} className="w-full">
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  {loginError && <StatusBanner tone="error">{loginError}</StatusBanner>}
                </form>
              ) : profile ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-mrc-muted">Welcome</p>
                    <strong className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full border-2 border-mrc-primary px-4 text-sm font-bold text-mrc-primary">
                      {profile.displayName}
                    </strong>
                  </div>
                  <a
                    href="/profile"
                    className="flex min-h-11 w-full items-center justify-center rounded-xl bg-mrc-gradient-btn px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_var(--mrc-shadow-primary)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30"
                  >
                    View profile
                  </a>
                  <Button
                    ref={logoutTriggerRef}
                    type="button"
                    className="w-full"
                    onClick={() => setConfirmLogout(true)}
                  >
                    Logout
                  </Button>
                </div>
              ) : profileLoading || loading ? (
                <p className="text-xs text-mrc-muted" role="status">
                  Loading your member profile…
                </p>
              ) : (
                <div className="space-y-3">
                  <StatusBanner tone="error">
                    {loginError ||
                      (profileError
                        ? memberProfileErrorMessage(profileError)
                        : "Your profile is temporarily unavailable.")}
                  </StatusBanner>
                  <Button
                    ref={logoutTriggerRef}
                    type="button"
                    className="w-full"
                    onClick={() => setConfirmLogout(true)}
                  >
                    Logout
                  </Button>
                </div>
              )}

              <div className="mt-7 border-t border-mrc-border pt-5">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-mrc-text">
                  Member support
                </h3>
                <a
                  className="mb-2.5 block min-h-11 py-1.5 text-sm font-medium text-mrc-primary hover:underline"
                  href="mailto:info@myroadclub.com"
                >
                  info@myroadclub.com
                </a>
                <a
                  className="block min-h-11 py-1.5 text-sm font-medium text-mrc-primary hover:underline"
                  href="tel:+18668401070"
                >
                  866-840-1070
                </a>
              </div>
            </div>
          </aside>
        </>
      )}

      {confirmLogout && (
        <>
          <div className="fixed inset-0 z-[999] bg-black/50" />
          <div
            ref={logoutDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="fixed left-1/2 top-1/2 z-[1000] w-[90%] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 text-center shadow-xl motion-safe:animate-[mrcModal_0.2s_ease] motion-reduce:animate-none"
          >
            <h3 id="logout-title" className="text-lg font-bold text-mrc-text">
              Logout
            </h3>
            <p className="mt-2 text-sm text-mrc-muted">Are you sure you want to log out?</p>

            <div className="mt-4 flex gap-2.5">
              <Button
                ref={cancelButtonRef}
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmLogout(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={() => {
                  logout();
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
