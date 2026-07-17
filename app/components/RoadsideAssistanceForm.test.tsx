import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MemberProfile } from "../../lib/wp-profile";
import {
  submitRoadsideRequest,
  WordPressRequestError,
} from "../../lib/wp-requests";
import { RoadsideAssistanceForm } from "./RoadsideAssistanceForm";

const profileState = vi.hoisted(() => ({
  profile: null as MemberProfile | null,
}));

vi.mock("../hooks/useMemberProfile", () => ({
  useMemberProfile: () => ({
    profile: profileState.profile,
    loading: profileState.profile === null,
    error: null,
  }),
}));

vi.mock("../../lib/wp-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/wp-requests")>();
  return { ...actual, submitRoadsideRequest: vi.fn() };
});

const submitMock = vi.mocked(submitRoadsideRequest);

describe("RoadsideAssistanceForm", () => {
  beforeEach(() => {
    profileState.profile = null;
    submitMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("selects exactly one service and shows towing destination fields", async () => {
    const user = userEvent.setup();
    render(<RoadsideAssistanceForm />);

    const serviceGroup = screen.getByRole("group", { name: /select service type/i });
    const towing = within(serviceGroup).getByRole("button", { name: "Towing" });
    const jumpStart = within(serviceGroup).getByRole("button", { name: "Jump Start" });

    expect(towing).toHaveAttribute("aria-pressed", "false");
    await user.click(towing);
    expect(towing).toHaveAttribute("aria-pressed", "true");
    expect(jumpStart).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Drop-off location (for towing)")).toBeInTheDocument();

    await user.click(jumpStart);
    expect(jumpStart).toHaveAttribute("aria-pressed", "true");
    expect(towing).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Drop-off location (for towing)")).not.toBeInTheDocument();
  });

  test("uses explicit vehicle and address input semantics", async () => {
    const user = userEvent.setup();
    render(<RoadsideAssistanceForm />);

    expect(screen.getByLabelText("VIN")).toHaveAttribute("maxlength", "17");
    expect(screen.getByLabelText("VIN")).toHaveAttribute("autocapitalize", "characters");
    expect(screen.getByLabelText("License plate")).toHaveAttribute("spellcheck", "false");
    expect(screen.getByLabelText("Address")).toHaveAttribute(
      "autocomplete",
      "section-service street-address"
    );
    expect(screen.getByLabelText("ZIP code")).toHaveAttribute("inputmode", "numeric");

    await user.click(screen.getByRole("button", { name: "Towing" }));
    expect(screen.getByLabelText("Destination address")).toHaveAttribute(
      "autocomplete",
      "section-destination street-address"
    );
    expect(screen.getByLabelText("Destination ZIP code")).toHaveAttribute(
      "inputmode",
      "numeric"
    );
  });

  test("member buttons expose pressed state and preserve an early No choice", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RoadsideAssistanceForm />);
    const memberGroup = screen.getByRole("group", { name: "Member?" });
    const noButton = within(memberGroup).getByRole("button", { name: "No" });

    expect(noButton).toHaveAttribute("aria-pressed", "true");
    await user.click(noButton);

    profileState.profile = {
      id: 7,
      username: "ada",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada L.",
      email: "ada@example.com",
      phone: "5551234567",
      membershipId: "MRC-7",
    };
    rerender(<RoadsideAssistanceForm />);

    expect(within(memberGroup).getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByLabelText("Membership ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
  });

  test("shows required errors without submitting and keeps entered values", async () => {
    const user = userEvent.setup();
    render(<RoadsideAssistanceForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.click(screen.getByRole("button", { name: /submit service request/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please select a service type.");
    expect(submitMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");

    await user.click(screen.getByRole("button", { name: "Battery" }));
    await user.click(screen.getByRole("button", { name: /submit service request/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter your first name, last name, and phone number."
    );
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
  });

  test("requests high-accuracy GPS, reverse geocodes, and renders the service map", async () => {
    const getCurrentPosition = vi.fn(
      (
        success: PositionCallback,
        _error: PositionErrorCallback,
        _options?: PositionOptions
      ) => {
        success({
          coords: {
            latitude: 18.7883,
            longitude: 98.9853,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: 1,
        });
      }
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          address: {
            house_number: "12",
            road: "Main Road",
            city: "Chiang Mai",
            state: "Chiang Mai",
            postcode: "50000",
          },
        }),
      })
    );
    render(<RoadsideAssistanceForm />);

    fireEvent.click(screen.getByRole("button", { name: "Get current GPS location" }));

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Address")).toHaveValue("12 Main Road");
    });
    expect(screen.getByLabelText("City")).toHaveValue("Chiang Mai");
    expect(screen.getByTitle("Service location on map")).toHaveAttribute(
      "src",
      expect.stringContaining("18.7883")
    );
    expect(screen.getByText(/GPS: 18\.788300, 98\.985300/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });

  test("shows an actionable error and keeps entered data after submitRoadsideRequest rejects", async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(
      new WordPressRequestError(
        "server",
        "We could not save your request. Please try again or call member services."
      )
    );
    render(<RoadsideAssistanceForm />);

    await user.click(screen.getByRole("button", { name: "Jump Start" }));
    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/phone number/i), "5551234567");
    await user.type(screen.getByLabelText(/make/i), "Honda");
    await user.click(screen.getByRole("button", { name: /submit service request/i }));

    expect(submitMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not save your request|try again or call member services/i
      );
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Lovelace");
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("5551234567");
    expect(screen.getByLabelText(/make/i)).toHaveValue("Honda");
    expect(screen.getByRole("button", { name: "Jump Start" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /submit service request/i })).toBeEnabled();
  });

  test("disables submission until the server controls success", async () => {
    const user = userEvent.setup();
    let resolveSubmit!: (value: {
      id: number;
      reference: string;
      status: "pending";
      createdAt: string;
    }) => void;
    submitMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );
    render(<RoadsideAssistanceForm />);

    await user.click(screen.getByRole("button", { name: "Flat Tire" }));
    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/phone number/i), "5551234567");
    await user.click(screen.getByRole("button", { name: /submit service request/i }));

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceType: "flat-tire",
        customer: expect.objectContaining({
          firstName: "Ada",
          lastName: "Lovelace",
          phone: "5551234567",
        }),
        dropOff: null,
      })
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();

    resolveSubmit({
      id: 9,
      reference: "RA-2026-009",
      status: "pending",
      createdAt: "2026-07-17T00:00:00.000Z",
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("RA-2026-009");
    });
  });
});
