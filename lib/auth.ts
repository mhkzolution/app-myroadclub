export function logout() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("wp_token");

  window.location.href = "/login";
}