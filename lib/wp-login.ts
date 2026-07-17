export async function loginWP(username: string, password: string) {
  const res = await fetch(
    "https://myroadclub.com/wp-json/jwt-auth/v1/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    }
  );

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json();
}