import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { RoadsideHelpTabs } from "./RoadsideHelpTabs";

vi.mock("./GotTicketForm", () => ({
  GotTicketForm: () => <div>Ticket panel content</div>,
}));

vi.mock("./RoadsideAssistanceForm", () => ({
  RoadsideAssistanceForm: () => <div>Roadside panel content</div>,
}));

vi.mock("./PlanTripWebview", () => ({
  PlanTripWebview: () => <div>Plan panel content</div>,
}));

describe("RoadsideHelpTabs", () => {
  test("starts on ticket and supports arrow-key tab navigation", async () => {
    render(<RoadsideHelpTabs />);
    const user = userEvent.setup();
    const ticket = screen.getByRole("tab", { name: "Got a ticket?" });
    const roadside = screen.getByRole("tab", { name: "Roadside Assistance" });

    expect(ticket).toHaveAttribute("aria-selected", "true");
    expect(ticket).toHaveAttribute("tabindex", "0");
    expect(roadside).toHaveAttribute("tabindex", "-1");

    ticket.focus();
    await user.keyboard("{ArrowRight}");

    expect(roadside).toHaveFocus();
    expect(roadside).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Roadside Assistance");
  });

  test("wraps with ArrowLeft and supports Home and End", async () => {
    render(<RoadsideHelpTabs />);
    const user = userEvent.setup();
    const ticket = screen.getByRole("tab", { name: "Got a ticket?" });
    const roadside = screen.getByRole("tab", { name: "Roadside Assistance" });
    const plan = screen.getByRole("tab", { name: "Plan a Trip" });

    ticket.focus();
    await user.keyboard("{ArrowLeft}");
    expect(plan).toHaveFocus();
    expect(plan).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(ticket).toHaveFocus();
    expect(ticket).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(roadside).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(ticket).toHaveFocus();

    await user.keyboard("{End}");
    expect(plan).toHaveFocus();
    expect(plan).toHaveAttribute("tabindex", "0");
    expect(ticket).toHaveAttribute("tabindex", "-1");
    expect(roadside).toHaveAttribute("tabindex", "-1");
  });
});
