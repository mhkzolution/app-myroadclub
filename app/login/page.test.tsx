import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loginWP } from "@/lib/wp-login";
import LoginPage from "./page";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/wp-login", () => ({
  loginWP: vi.fn(),
}));

const loginWPMock = vi.mocked(loginWP);

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    replaceMock.mockReset();
    loginWPMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("uses semantic username/password fields and a reveal toggle", () => {
    render(<LoginPage />);

    const username = screen.getByLabelText("Username");
    expect(username).toHaveAttribute("id", "login-username");
    expect(username).toHaveAttribute("type", "text");
    expect(username).toHaveAttribute("autocomplete", "username");
    expect(username).toHaveAttribute("autocapitalize", "none");
    expect(username).toHaveAttribute("spellcheck", "false");

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("id", "login-password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAttribute("type", "password");

    const reveal = screen.getByRole("button", { name: "Show password" });
    expect(reveal).toHaveAttribute("aria-pressed", "false");
  });

  test("reveal toggle shows the password and flips its accessible label", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    const hideButton = screen.getByRole("button", { name: "Hide password" });
    expect(hideButton).toHaveAttribute("aria-pressed", "true");
  });

  test("Remember me exposes an explicit 44px label target", () => {
    render(<LoginPage />);
    const remember = screen.getByLabelText("Remember me");
    expect(remember).toHaveAttribute("id", "login-remember");
    expect(remember).toBeChecked();
    const label = remember.closest("label");
    expect(label?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["min-h-11"])
    );
  });

  test("stores the token in local storage when Remember me is selected", async () => {
    loginWPMock.mockResolvedValue({ token: "member-token" });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "member1");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(localStorage.getItem("wp_token")).toBe("member-token");
    expect(sessionStorage.getItem("wp_token")).toBeNull();
  });

  test("stores the token in session storage when Remember me is cleared", async () => {
    loginWPMock.mockResolvedValue({ token: "member-token-2" });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByLabelText("Remember me"));
    await user.type(screen.getByLabelText("Username"), "member1");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(sessionStorage.getItem("wp_token")).toBe("member-token-2");
    expect(localStorage.getItem("wp_token")).toBeNull();
  });

  test("renders an accessible error banner instead of window.alert on failure", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    loginWPMock.mockRejectedValue(new Error("Login failed"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "member1");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/login failed/i);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("wp_token")).toBeNull();
    expect(sessionStorage.getItem("wp_token")).toBeNull();
  });
});
