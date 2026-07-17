export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wp_token") ?? sessionStorage.getItem("wp_token");
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("wp_token");
  sessionStorage.removeItem("wp_token");
}

export function logout() {
  if (typeof window === "undefined") return;

  clearAuthTokens();
  window.location.href = "/login";
}
