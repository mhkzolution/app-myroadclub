export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wp_token");
}