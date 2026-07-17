import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { GotTicketForm } from "./GotTicketForm";

vi.mock("../hooks/useMemberProfile", () => ({
  useMemberProfile: () => ({ profile: null, loading: false, error: null }),
}));

vi.mock("../../lib/wp-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/wp-requests")>();
  return { ...actual, submitTicketRequest: vi.fn() };
});

describe("GotTicketForm", () => {
  test("uses field semantics suitable for ticket and contact data", () => {
    render(<GotTicketForm />);
    expect(screen.getByLabelText(/citation or ticket number/i)).toHaveAttribute(
      "autocapitalize",
      "characters"
    );
    expect(screen.getByLabelText(/date of violation/i)).toHaveAttribute("type", "date");
    expect(screen.getByLabelText(/first name/i)).toHaveAttribute(
      "autocomplete",
      "given-name"
    );
    expect(screen.getByLabelText(/phone number/i)).toHaveAttribute("inputmode", "tel");
    expect(screen.getByLabelText(/photo or scan/i)).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,application/pdf"
    );
  });
});
