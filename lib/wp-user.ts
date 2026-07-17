export async function getUser() {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("wp_token");

  if (!token) return null;

  return { token };
}