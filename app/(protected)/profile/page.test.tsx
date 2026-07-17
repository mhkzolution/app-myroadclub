import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import ProfilePage from "./page";

const profile = {
  id: 123,
  username: "member-login",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+15550100",
  membershipId: "MRC-1001",
};

vi.mock("@/app/hooks/useMemberProfile", () => ({
  useMemberProfile: () => ({
    loading: false,
    error: null,
    profile,
  }),
}));

test("marks only the invalid profile field", async () => {
  render(<ProfilePage />);
  const user = userEvent.setup();
  const firstName = screen.getByLabelText("First name");
  const lastName = screen.getByLabelText("Last name");
  await user.clear(firstName);
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  expect(firstName).toHaveAttribute("aria-invalid", "true");
  expect(lastName).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("alert")).toHaveTextContent("First name is required.");
  expect(firstName).toHaveAccessibleDescription("First name is required.");

  await user.type(firstName, "Ada");
  expect(firstName).not.toHaveAttribute("aria-invalid");
  expect(firstName).not.toHaveAccessibleDescription();
});

test("editable profile controls do not expose native maxlength", () => {
  render(<ProfilePage />);
  for (const label of [
    "First name",
    "Last name",
    "Display name",
    "Email",
    "Phone number",
  ]) {
    expect(screen.getByLabelText(label)).not.toHaveAttribute("maxlength");
  }
});
