"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token =
        localStorage.getItem("wp_token") ||
        sessionStorage.getItem("wp_token");
    setToken(token);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (!token && !pathname.startsWith("/login")) {
      router.replace("/login");
    }
  }, [ready, token, pathname, router]);

  if (!ready) {
    return (
      <div className="mrc-loading">
        <div className="mrc-spinner"></div>
        <p className="mrc-loading-text">Loading...</p>
      </div>
    );
  }

  if (!token && !pathname.startsWith("/login")) {
    return null;
  }

  return <>{children}</>;
}