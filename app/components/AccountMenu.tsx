"use client";

import { useCallback, useEffect, useState } from "react";

import { useMemberProfile } from "@/app/hooks/useMemberProfile";
import { getAuthToken, logout } from "@/lib/auth";
import {
  MEMBER_PROFILE_UPDATED_EVENT,
  getMemberProfile,
  memberProfileErrorMessage,
} from "@/lib/wp-profile";

export function AccountMenu() {
  const { profile, loading: profileLoading, error: profileError } = useMemberProfile();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    setHasToken(Boolean(getAuthToken()));
  }, []);

  const handleLogin = async () => {
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
    <div className="mrc-account-wrap">
      <button
        type="button"
        className="mrc-account-trigger"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mrc-account-panel"
        aria-haspopup="dialog"
      >
        <span className="mrc-account-trigger-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span className="mrc-account-trigger-label">My Account</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="mrc-account-backdrop"
            tabIndex={-1}
            aria-label="Close account menu"
            onClick={close}
          />
          <aside
            id="mrc-account-panel"
            className="mrc-account-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mrc-account-title"
          >
            <div className="mrc-account-panel-header">
              <h2 id="mrc-account-title" className="mrc-account-panel-title">
                My Account
              </h2>
              <button
                type="button"
                className="mrc-account-close"
                onClick={close}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mrc-account-panel-body">
              <p className="mrc-account-lead">
                View and update your My Road Club member profile.
              </p>
              {hasToken === null ? (
                <p className="mrc-account-hint" role="status">
                  Checking your account…
                </p>
              ) : !hasToken ? (
                <div className="mrc-login-form">

                  <div className="ra-mt">
                    <label className="ra-field">
                      <span className="ra-field-label">Email</span>
                      <input
                        className="ra-input"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                  </div>
                  
                  <div className="ra-mt">
                    <label className="ra-field">
                      <span className="ra-field-label">Password</span>
                      <input
                        type="password"
                        className="ra-input"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                  </div>

                  <button
                    className="mrc-account-primary-btn ra-mt"
                    type="button"
                    onClick={handleLogin}
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </button>
                  {loginError && (
                    <p className="ra-inline-error" role="alert">
                      {loginError}
                    </p>
                  )}
                </div>
              ) : profile ? (
                <div className="mrc-user-info">
                  <div className="mrc-user-div">
                    <p>Welcome</p>
                    <strong className="ra-display-name">{profile.displayName}</strong>
                  </div>

                  <a className="mrc-account-primary-btn ra-mt" href="/profile">
                    View profile
                  </a>
                  <button
                    className="mrc-account-primary-btn ra-mt"
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                  >
                    Logout
                  </button>
                </div>
              ) : profileLoading || loading ? (
                <p className="mrc-account-hint" role="status">
                  Loading your member profile…
                </p>
              ) : (
                <div className="mrc-user-info">
                  <p className="ra-inline-error" role="alert">
                    {loginError ||
                      (profileError
                        ? memberProfileErrorMessage(profileError)
                        : "Your profile is temporarily unavailable.")}
                  </p>
                  <button
                    className="mrc-account-primary-btn ra-mt"
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                  >
                    Logout
                  </button>
                </div>
              )}

              <div className="mrc-account-section">
                <h3 className="mrc-account-section-title">Member support</h3>
                <a className="mrc-account-link" href="mailto:info@myroadclub.com">
                  info@myroadclub.com
                </a>
                <a className="mrc-account-link" href="tel:+18668401070">
                  866-840-1070
                </a>
              </div>
            </div>
          </aside>
        </>
      )}

      {confirmLogout && (
        <>
          <div className="mrc-modal-backdrop" />

          <div className="mrc-modal">
            <h3>Logout</h3>
            <p>Are you sure you want to log out?</p>

            <div className="mrc-modal-actions">
              <button
                className="mrc-btn-secondary"
                type="button"
                onClick={() => setConfirmLogout(false)}
              >
                Cancel
              </button>

              <button
                className="mrc-btn-danger"
                type="button"
                onClick={() => {
                  logout();
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    
  );
}
