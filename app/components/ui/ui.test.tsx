import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Button } from "./Button";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { StatusBanner } from "./StatusBanner";

describe("shared UI", () => {
  test("associates a label, hint, and error with its input", () => {
    render(
      <FormField id="email" label="Email" hint="Use your member email" error="Enter a valid email">
        {(controlProps) => <Input {...controlProps} type="email" />}
      </FormField>
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use your member email Enter a valid email");
  });

  test("prevents loading button activation", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  test("uses alert for errors and status for success", () => {
    const { rerender } = render(<StatusBanner tone="error">Failed</StatusBanner>);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    rerender(<StatusBanner tone="success">Saved</StatusBanner>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});
