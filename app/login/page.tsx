"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWP } from "@/lib/wp-login";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);

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
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="app-content">
        <section className="roadside-section">
          <div className="ra-form-shell">
            <div className="min-h-screen flex items-center justify-center px-4">
              <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

                <h1 className="explore-greeting mb-4">
                  Welcome to <span>My Road Club</span>
                </h1>

                <form onSubmit={handleLogin} className="ra-form space-y-4">

                  <section className="ra-card">

                    {/* Username */}
                    <div className="ra-mt">
                      <label className="ra-field">
                        <span className="ra-field-label">Username</span>
                        <input
                          className="ra-input"
                          placeholder="Enter your username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </label>
                    </div>

                    {/* Password */}
                    <div className="ra-mt">
                      <label className="ra-field">
                        <span className="ra-field-label">Password</span>

                        <div className="ra-relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            className="ra-input pr-12"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) =>
                              setPassword(e.target.value)
                            }
                          />

                          <button
                            type="button"
                            className="show-password"
                            onClick={() =>
                              setShowPassword(!showPassword)
                            }
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </label>
                    </div>

                    {/* Remember */}
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) =>
                          setRemember(e.target.checked)
                        }
                      />
                      <span className="text-sm">
                        Remember me
                      </span>
                    </div>

                    {/* Button */}
                    <button
                      type="submit"
                      className="mrc-account-primary-btn ra-mt w-full"
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign in"}
                    </button>

                  </section>

                </form>

              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}