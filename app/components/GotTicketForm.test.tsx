import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { submitTicketRequest } from "../../lib/wp-requests";
import { GotTicketForm } from "./GotTicketForm";

vi.mock("../hooks/useMemberProfile", () => ({
  useMemberProfile: () => ({ profile: null, loading: false, error: null }),
}));

vi.mock("../../lib/wp-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/wp-requests")>();
  return { ...actual, submitTicketRequest: vi.fn() };
});

const submitMock = vi.mocked(submitTicketRequest);

function ticketFile(name: string, type: string, size = 32) {
  return new File([new Uint8Array(size)], name, { type });
}

async function selectFiles(input: HTMLElement, files: File | File[]) {
  const user = userEvent.setup();
  await user.upload(input, files);
}

/** Bypass the browser `accept` filter so validateTicketFiles still runs in jsdom. */
function changeFiles(input: HTMLElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

describe("GotTicketForm", () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  test("exposes a multiple upload input described by the size and type hint", () => {
    render(<GotTicketForm />);
    const upload = screen.getByLabelText(/photo or scan/i);
    expect(upload).toHaveAttribute("multiple");
    expect(upload).toHaveAccessibleDescription(
      /JPG, PNG, or PDF\. Up to 10 files, 10 MB each and 50 MB combined/i
    );
  });

  test("adds valid JPEG, PNG, and PDF files and removes a middle selection", async () => {
    const user = userEvent.setup();
    render(<GotTicketForm />);
    const upload = screen.getByLabelText(/photo or scan/i);

    await selectFiles(upload, ticketFile("front.jpg", "image/jpeg"));
    await selectFiles(upload, ticketFile("back.png", "image/png"));
    await selectFiles(upload, ticketFile("copy.pdf", "application/pdf"));

    const list = screen.getByRole("list", { name: /selected files/i });
    expect(within(list).getByText("front.jpg")).toBeInTheDocument();
    expect(within(list).getByText("back.png")).toBeInTheDocument();
    expect(within(list).getByText("copy.pdf")).toBeInTheDocument();
    expect(within(list).getByText("PDF")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove back\.png/i }));

    expect(within(list).getByText("front.jpg")).toBeInTheDocument();
    expect(within(list).queryByText("back.png")).not.toBeInTheDocument();
    expect(within(list).getByText("copy.pdf")).toBeInTheDocument();
  });

  test("rejects invalid or oversized files without clearing entered fields or kept uploads", async () => {
    const user = userEvent.setup();
    render(<GotTicketForm />);

    await user.type(screen.getByLabelText(/citation or ticket number/i), "ABC-99");
    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/phone number/i), "5551234567");

    const upload = screen.getByLabelText(/photo or scan/i);
    await selectFiles(upload, ticketFile("kept.jpg", "image/jpeg"));
    expect(screen.getByText("kept.jpg")).toBeInTheDocument();

    changeFiles(upload, [ticketFile("bad.gif", "image/gif")]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /could not be accepted|review the form/i
    );
    expect(screen.getByLabelText(/citation or ticket number/i)).toHaveValue("ABC-99");
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Lovelace");
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("5551234567");
    expect(screen.getByText("kept.jpg")).toBeInTheDocument();
    expect(screen.queryByText("bad.gif")).not.toBeInTheDocument();

    changeFiles(upload, [ticketFile("huge.jpg", "image/jpeg", 10 * 1024 * 1024 + 1)]);
    expect(screen.getByRole("alert")).toHaveTextContent(/exceed the upload limit/i);
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByText("kept.jpg")).toBeInTheDocument();
    expect(screen.queryByText("huge.jpg")).not.toBeInTheDocument();
  });

  test("revokes image preview object URLs when a file is removed or the form unmounts", async () => {
    const user = userEvent.setup();
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob) => `blob:preview-${(blob as File).name}`);
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { unmount } = render(<GotTicketForm />);
    const upload = screen.getByLabelText(/photo or scan/i);

    await selectFiles(upload, [
      ticketFile("one.jpg", "image/jpeg"),
      ticketFile("two.jpg", "image/jpeg"),
    ]);
    expect(createSpy).toHaveBeenCalled();
    expect(screen.getByText("one.jpg")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove one\.jpg/i }));
    await waitFor(() => {
      expect(revokeSpy).toHaveBeenCalledWith("blob:preview-one.jpg");
      expect(revokeSpy).toHaveBeenCalledWith("blob:preview-two.jpg");
    });
    expect(screen.queryByText("one.jpg")).not.toBeInTheDocument();
    expect(screen.getByText("two.jpg")).toBeInTheDocument();

    revokeSpy.mockClear();
    unmount();
    expect(revokeSpy).toHaveBeenCalledWith("blob:preview-two.jpg");
  });

  test("shows success only after submitTicketRequest resolves with a valid reference", async () => {
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

    render(<GotTicketForm />);
    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/phone number/i), "5551234567");

    await user.click(screen.getByRole("button", { name: /submit ticket info/i }));

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();

    resolveSubmit({
      id: 42,
      reference: "TK-2026-001",
      status: "pending",
      createdAt: "2026-07-17T00:00:00.000Z",
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/TK-2026-001/);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/we received your information/i);
    expect(screen.getByRole("button", { name: /submit ticket info/i })).toBeEnabled();
  });
});
