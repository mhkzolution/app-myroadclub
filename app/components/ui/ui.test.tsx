import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Button } from "./Button";
import { Card } from "./Card";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { LoadingScreen } from "./LoadingScreen";
import { Select } from "./Select";
import { StatusBanner } from "./StatusBanner";
import { Textarea } from "./Textarea";
import { controlClasses } from "./classNames";

describe("shared UI", () => {
  test("LoadingScreen exposes status role and label text", () => {
    render(<LoadingScreen label="Checking session…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Checking session…");
  });

  test("Textarea forwards native props and shared control classes", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(
      <Textarea
        ref={ref}
        id="notes"
        rows={4}
        placeholder="Describe the issue"
        aria-invalid={true}
        className="extra-class"
      />
    );
    const area = screen.getByPlaceholderText("Describe the issue");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("id", "notes");
    expect(area).toHaveAttribute("rows", "4");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area.className).toContain(controlClasses.split(" ")[0]);
    expect(area.className).toMatch(/min-h-24/);
    expect(area.className).toMatch(/resize-y/);
    expect(area.className).toMatch(/extra-class/);
    expect(ref.current).toBe(area);
  });

  test("Select and Card apply shared styling and native props", () => {
    render(
      <>
        <Select aria-label="Drive type" defaultValue="2wd">
          <option value="2wd">2WD</option>
          <option value="awd">AWD</option>
        </Select>
        <Card as="section" aria-label="Details">
          Body
        </Card>
      </>
    );
    const select = screen.getByLabelText("Drive type");
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveValue("2wd");
    expect(select.className).toMatch(/pr-10/);
    expect(select.className).toContain(controlClasses.split(" ")[0]);
    expect(screen.getByRole("region", { name: "Details" }).tagName).toBe("SECTION");
  });

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

  test("primary buttons use the brand gradient utility", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" }).className).toMatch(
      /bg-mrc-gradient-btn/
    );
  });

  test("uses alert for errors and status for success", () => {
    const { rerender } = render(<StatusBanner tone="error">Failed</StatusBanner>);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    rerender(<StatusBanner tone="success">Saved</StatusBanner>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});
