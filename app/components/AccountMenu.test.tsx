import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const authState = vi.hoisted(() => ({ hasToken: false }));
const logoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/hooks/useMemberProfile", () => ({
  useMemberProfile: () => ({ profile: null, loading: false, error: null }),
}));

vi.mock("@/lib/auth", () => ({
  getAuthToken: () => (authState.hasToken ? "token-123" : null),
  logout: logoutMock,
}));

vi.mock("@/lib/wp-profile", () => ({
  MEMBER_PROFILE_UPDATED_EVENT: "mrc:member-profile-updated",
  getMemberProfile: vi.fn().mockResolvedValue({}),
  memberProfileErrorMessage: () => "Your profile is temporarily unavailable.",
}));

describe("AccountMenu", () => {
  beforeEach(() => {
    authState.hasToken = false;
    logoutMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("opening the drawer focuses the close button and Escape restores trigger focus", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: /my account/i });

    await user.click(trigger);
    const closeButton = await screen.findByRole("button", { name: "Close" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("drawer email and password fields use expected input semantics", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);
    await user.click(screen.getByRole("button", { name: /my account/i }));

    const emailField = screen.getByLabelText("Email");
    const passwordField = screen.getByLabelText("Password");
    expect(emailField).toHaveAttribute("type", "email");
    expect(emailField).toHaveAttribute("autocomplete", "username");
    expect(emailField).toHaveAttribute("autocapitalize", "none");
    expect(emailField).toHaveAttribute("spellcheck", "false");
    expect(passwordField).toHaveAttribute("autocomplete", "current-password");
  });

  test("submits the drawer login form on Enter and stores the token locally", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "abc123" }),
      })
    );
    const user = userEvent.setup();
    render(<AccountMenu />);
    await user.click(screen.getByRole("button", { name: /my account/i }));

    await user.type(screen.getByLabelText("Email"), "member@example.com");
    await user.type(screen.getByLabelText("Password"), "secret{Enter}");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem("wp_token")).toBe("abc123"));
    expect(sessionStorage.getItem("wp_token")).toBeNull();
  });

  test("logout confirmation exposes dialog semantics, focuses Cancel, and restores focus on Escape", async () => {
    authState.hasToken = true;
    const user = userEvent.setup();
    render(<AccountMenu />);
    await user.click(screen.getByRole("button", { name: /my account/i }));

    const logoutTrigger = await screen.findByRole("button", { name: "Logout" });
    await user.click(logoutTrigger);

    const dialog = screen.getByRole("dialog", { name: "Logout" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancelButton).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Logout" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "My Account" })).toBeInTheDocument();
    expect(logoutTrigger).toHaveFocus();
  });

  test("Tab and Shift+Tab wrap within the open account drawer", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: /my account/i });
    await user.click(trigger);

    const drawer = await screen.findByRole("dialog", { name: "My Account" });
    const closeButton = screen.getByRole("button", { name: "Close" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const lastFocusable = screen.getByRole("link", { name: "866-840-1070" });
    lastFocusable.focus();
    expect(lastFocusable).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(trigger).not.toHaveFocus();

    await user.tab({ shift: true });
    expect(lastFocusable).toHaveFocus();
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(trigger).not.toHaveFocus();
  });

  test("Tab and Shift+Tab wrap within the logout confirmation dialog", async () => {
    authState.hasToken = true;
    const user = userEvent.setup();
    render(<AccountMenu />);
    await user.click(screen.getByRole("button", { name: /my account/i }));

    const logoutTrigger = await screen.findByRole("button", { name: "Logout" });
    await user.click(logoutTrigger);

    const logoutDialog = screen.getByRole("dialog", { name: "Logout" });
    const cancelButton = within(logoutDialog).getByRole("button", { name: "Cancel" });
    const confirmLogout = within(logoutDialog).getByRole("button", { name: "Logout" });
    await waitFor(() => expect(cancelButton).toHaveFocus());

    await user.tab();
    expect(confirmLogout).toHaveFocus();
    expect(logoutDialog.contains(document.activeElement)).toBe(true);

    await user.tab();
    expect(cancelButton).toHaveFocus();
    expect(logoutDialog.contains(document.activeElement)).toBe(true);
    expect(logoutTrigger).not.toHaveFocus();

    await user.tab({ shift: true });
    expect(confirmLogout).toHaveFocus();
    expect(logoutDialog.contains(document.activeElement)).toBe(true);
  });
});
