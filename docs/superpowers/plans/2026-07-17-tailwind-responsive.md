# Tailwind CSS and Responsive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the application's legacy feature CSS with a complete Tailwind CSS UI system that preserves behavior and works well on mobile, tablet, and desktop.

**Architecture:** Tailwind CSS v4 supplies brand tokens and mobile-first utilities. Small typed React primitives own repeated form, button, card, banner, and loading presentation; feature components retain their existing state, API, auth, GPS, upload, and submission logic. Migration proceeds feature by feature while legacy CSS remains available, then removes every obsolete selector in one final audit.

**Tech Stack:** Next.js 14.2, React 18, TypeScript, Tailwind CSS v4, PostCSS, Vitest, jsdom, Testing Library, existing Node tests

## Global Constraints

- Preserve MyRoadClub colors: primary `#00a0e3`, cyan `#39c8df`, text `#232323`, muted text `#546e7a`, and border `#e6e6e6`.
- Do not add a third-party component library or class-merging dependency.
- Do not change authentication, token storage, WordPress APIs, profile autofill, GPS, maps, uploads, request payloads, or server-controlled success behavior.
- Mobile starts at 320px with one-column forms; paired fields start at 768px; wider desktop layout starts at 1024px.
- All interactive controls must have a minimum 44px target; form controls use a 16px font on mobile.
- Keep the static export in `out/` compatible with Capacitor and Nginx.
- Do not create git commits unless the user explicitly authorizes them.

## File Map

**Create**

- `postcss.config.mjs` — Tailwind PostCSS integration.
- `vitest.config.ts` — jsdom component-test configuration.
- `test/setup.ts` — jest-dom setup and browser API cleanup.
- `app/components/ui/classNames.ts` — dependency-free class joining.
- `app/components/ui/FormField.tsx` — label, hint, error, and ARIA wiring.
- `app/components/ui/Input.tsx` — shared native input styling.
- `app/components/ui/Select.tsx` — shared native select styling.
- `app/components/ui/Textarea.tsx` — shared native textarea styling.
- `app/components/ui/Button.tsx` — shared button variants and loading state.
- `app/components/ui/Card.tsx` — shared card surface.
- `app/components/ui/StatusBanner.tsx` — error and success messages.
- `app/components/ui/LoadingScreen.tsx` — protected-route loading state.
- `app/components/ui/ui.test.tsx` — primitive semantics and state tests.
- `app/components/RoadsideHelpTabs.test.tsx` — tabs behavior and keyboard tests.
- `app/components/GotTicketForm.test.tsx` — ticket field semantics.
- `app/components/RoadsideAssistanceForm.test.tsx` — roadside conditional UI and field semantics.
- `app/components/AccountMenu.test.tsx` — drawer/dialog focus and form behavior.
- `app/login/page.test.tsx` — login semantics, errors, and token-storage choice.
- `app/(protected)/profile/page.test.tsx` — field-specific profile validation.

**Modify**

- `package.json`, `package-lock.json` — Tailwind and test dependencies/scripts.
- `app/globals.css` — Tailwind entry, theme, base rules, essential animations; remove legacy selectors last.
- `app/layout.tsx` — apply Roboto and global body layout.
- `app/(protected)/layout.tsx` — use shared loading UI.
- `app/(protected)/page.tsx` — responsive home/header container.
- `app/components/RoadsideHelpTabs.tsx` — responsive tab styling and keyboard behavior.
- `app/components/PlanTripWebview.tsx` — fluid Tailwind iframe shell.
- `app/components/GotTicketForm.tsx` — primitives, responsive fields, and input semantics.
- `app/components/RoadsideAssistanceForm.tsx` — primitives, responsive sections, semantics, maps, and feature controls.
- `app/components/AccountMenu.tsx` — Tailwind drawer/modal, form semantics, and focus management.
- `app/login/page.tsx` — responsive login, semantic controls, and accessible errors.
- `app/(protected)/profile/page.tsx` — responsive profile form and field-specific invalid state.
- `.cursor/rules/project-plan.mdc` — record the Tailwind/responsive architecture after behavior is implemented.

**Delete**

- `app/components/AuthGuard.tsx` — unused duplicate of the protected layout, after a repository search confirms no consumer.

---

### Task 1: Install Tailwind and Component-Test Foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces Tailwind utilities and `mrc-*` color tokens for every later task.
- Produces `npm run test:lib`, `npm run test:ui`, and `npm test`.

- [ ] **Step 1: Install current compatible packages**

Run:

```bash
npm install --save-dev tailwindcss @tailwindcss/postcss vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom tsx
```

Expected: `package.json` and `package-lock.json` update without peer dependency errors.

- [ ] **Step 2: Add deterministic test scripts**

Set the scripts in `package.json` to include:

```json
{
  "test:lib": "tsx --test lib/*.test.ts",
  "test:ui": "vitest run",
  "test": "npm run test:lib && npm run test:ui"
}
```

Keep `dev`, `build`, `start`, `lint`, and `test:wp-plugin` unchanged.

- [ ] **Step 3: Configure PostCSS**

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 4: Configure Vitest and Testing Library**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["app/**/*.test.tsx"],
    clearMocks: true,
  },
});
```

Create `test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

- [ ] **Step 5: Add the Tailwind theme without removing legacy CSS yet**

Prepend this to `app/globals.css`; retain all existing selectors until Task 8:

```css
@import "tailwindcss";

@theme inline {
  --color-mrc-primary: var(--mrc-primary);
  --color-mrc-primary-dark: var(--mrc-primary-dark);
  --color-mrc-cyan: var(--mrc-cyan);
  --color-mrc-danger: var(--mrc-red);
  --color-mrc-text: var(--mrc-text);
  --color-mrc-muted: var(--mrc-text-secondary);
  --color-mrc-border: var(--mrc-border);
  --color-mrc-surface: var(--mrc-surface);
  --color-mrc-soft: var(--mrc-surface-soft);
  --color-mrc-tint: var(--mrc-tint);
}
```

Keep the existing `:root` variables so arbitrary utilities can use `bg-[var(--mrc-gradient-btn)]`, `bg-[var(--mrc-gradient-panel)]`, and `shadow-[...]`.

- [ ] **Step 6: Apply Roboto and base body utilities**

Change `app/layout.tsx` to:

```tsx
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Road Club",
  description: "Member services — tickets, roadside assistance, and travel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.className} min-h-dvh bg-mrc-soft text-mrc-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify the foundation**

Run:

```bash
npm run test:lib
npm run lint
npm run build
```

Expected: all existing library tests pass, lint exits 0, and static export completes in `out/`.

- [ ] **Step 8: Review checkpoint**

Review `git diff -- package.json package-lock.json postcss.config.mjs vitest.config.ts test/setup.ts app/globals.css app/layout.tsx`. Do not commit unless explicitly authorized.

---

### Task 2: Build Accessible Shared UI Primitives

**Files:**
- Create: `app/components/ui/classNames.ts`
- Create: `app/components/ui/FormField.tsx`
- Create: `app/components/ui/Input.tsx`
- Create: `app/components/ui/Select.tsx`
- Create: `app/components/ui/Textarea.tsx`
- Create: `app/components/ui/Button.tsx`
- Create: `app/components/ui/Card.tsx`
- Create: `app/components/ui/StatusBanner.tsx`
- Create: `app/components/ui/LoadingScreen.tsx`
- Create: `app/components/ui/ui.test.tsx`

**Interfaces:**
- Produces `joinClasses(...values: Array<string | false | null | undefined>): string`.
- Produces native-prop-compatible `Input`, `Select`, `Textarea`, and `Button`.
- Produces `FormField` render-prop ARIA contract:

```ts
type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};
```

- [ ] **Step 1: Write failing primitive tests**

Create `app/components/ui/ui.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm run test:ui -- app/components/ui/ui.test.tsx
```

Expected: FAIL because the imported primitive modules do not exist.

- [ ] **Step 3: Implement the shared class utility and control styles**

Create `app/components/ui/classNames.ts`:

```ts
export function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export const controlClasses =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-mrc-text shadow-sm outline-none transition placeholder:text-slate-400 focus:border-mrc-cyan focus:ring-4 focus:ring-mrc-cyan/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-mrc-danger aria-[invalid=true]:ring-mrc-danger/15 md:text-sm";
```

Create `Input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { controlClasses, joinClasses } from "./classNames";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={joinClasses(controlClasses, className)} {...props} />;
  }
);
```

Create `Select.tsx`:

```tsx
import { forwardRef, type SelectHTMLAttributes } from "react";
import { controlClasses, joinClasses } from "./classNames";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select ref={ref} className={joinClasses(controlClasses, "pr-10", className)} {...props} />
    );
  }
);
```

Create `Textarea.tsx`:

```tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { controlClasses, joinClasses } from "./classNames";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={joinClasses(controlClasses, "min-h-24 resize-y", className)}
      {...props}
    />
  );
});
```

- [ ] **Step 4: Implement FormField**

Create `app/components/ui/FormField.tsx`:

```tsx
import type { ReactNode } from "react";

type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold text-slate-600" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-mrc-danger" aria-hidden>*</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && <p id={hintId} className="mt-1.5 text-xs leading-5 text-mrc-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Implement Button, Card, banners, and loading**

Create `Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";
import { joinClasses } from "./classNames";

const variants = {
  primary: "bg-[var(--mrc-gradient-btn)] text-white shadow-[0_4px_14px_var(--mrc-shadow-primary)]",
  secondary: "border border-mrc-border bg-white text-mrc-text hover:border-mrc-primary",
  danger: "bg-mrc-danger text-white",
} as const;

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  loading?: boolean;
}) {
  return (
    <button
      className={joinClasses(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mrc-cyan/30 disabled:cursor-not-allowed disabled:opacity-65",
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
```

Create `Card.tsx`:

```tsx
import type { HTMLAttributes } from "react";
import { joinClasses } from "./classNames";

export function Card({
  as: Element = "div",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" }) {
  return (
    <Element
      className={joinClasses(
        "rounded-2xl border border-mrc-border bg-white p-4 shadow-sm md:p-5",
        className
      )}
      {...props}
    />
  );
}
```

Create `StatusBanner.tsx`:

```tsx
import type { HTMLAttributes } from "react";
import { joinClasses } from "./classNames";

export function StatusBanner({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone: "error" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={joinClasses(
        "rounded-xl border px-3 py-3 text-sm leading-5",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800",
        className
      )}
      {...props}
    />
  );
}
```

`LoadingScreen.tsx` must render:

```tsx
export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-dvh flex-col items-center justify-center bg-white" role="status">
      <span className="size-11 animate-spin rounded-full border-4 border-slate-200 border-t-mrc-primary motion-reduce:animate-none" aria-hidden />
      <p className="mt-3.5 text-sm text-mrc-muted">{label}</p>
    </div>
  );
}
```

- [ ] **Step 6: Run tests and static checks**

Run:

```bash
npm run test:ui -- app/components/ui/ui.test.tsx
npm run lint
npm run build
```

Expected: primitive tests pass, lint exits 0, and static export succeeds.

- [ ] **Step 7: Review checkpoint**

Review all files under `app/components/ui/`. Confirm controls forward refs and accept native props. Do not commit unless explicitly authorized.

---

### Task 3: Migrate the App Shell, Header, Tabs, and Embedded Trip Page

**Files:**
- Modify: `app/(protected)/layout.tsx`
- Modify: `app/(protected)/page.tsx`
- Modify: `app/components/RoadsideHelpTabs.tsx`
- Modify: `app/components/PlanTripWebview.tsx`
- Create: `app/components/RoadsideHelpTabs.test.tsx`
- Delete: `app/components/AuthGuard.tsx`

**Interfaces:**
- Consumes `LoadingScreen`.
- Preserves `TabId = "ticket" | "roadside" | "plan"` and default tab `"ticket"`.
- Preserves `PLAN_TRIP_URL`, iframe title, sandbox, and permissions.

- [ ] **Step 1: Write failing keyboard-tab tests**

Mock the three tab panels, render `RoadsideHelpTabs`, and assert:

```tsx
test("starts on ticket and supports arrow-key tab navigation", async () => {
  render(<RoadsideHelpTabs />);
  const user = userEvent.setup();
  const ticket = screen.getByRole("tab", { name: "Got a ticket?" });
  const roadside = screen.getByRole("tab", { name: "Roadside Assistance" });
  expect(ticket).toHaveAttribute("aria-selected", "true");
  ticket.focus();
  await user.keyboard("{ArrowRight}");
  expect(roadside).toHaveFocus();
  expect(roadside).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Roadside Assistance");
});
```

Also assert ArrowLeft wraps, Home selects ticket, End selects plan, and inactive tabs have `tabIndex={-1}`.

- [ ] **Step 2: Run the test and confirm failure**

Run `npm run test:ui -- app/components/RoadsideHelpTabs.test.tsx`.

Expected: FAIL because arrow-key behavior and roving tab index are absent.

- [ ] **Step 3: Implement shell and responsive header utilities**

Use `LoadingScreen` in the protected layout. In the home page use:

```tsx
<main className="min-h-dvh">
  <header className="rounded-b-3xl border-b border-mrc-border bg-gradient-to-b from-white to-mrc-tint px-3 py-3 sm:px-5">
    <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2">
      {/* logo: h-10 w-auto max-w-28 */}
      {/* greeting: hidden below sm if space is constrained; sm:block */}
      {/* account menu aligned right */}
    </div>
  </header>
  <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 md:py-6 lg:px-8" aria-label="Roadside assistance">
    <RoadsideHelpTabs />
  </section>
</main>
```

The logo URL, alt text, dimensions, greeting copy, and account component remain unchanged.

- [ ] **Step 4: Implement responsive accessible tabs**

Use a three-column grid on all supported widths, compact text on mobile, `md:min-h-12`, complete literal active/inactive classes, and refs for keyboard focus. `onKeyDown` must map ArrowRight/ArrowDown to next, ArrowLeft/ArrowUp to previous, Home to first, and End to last; call `preventDefault()`, update state, then focus the new tab.

- [ ] **Step 5: Migrate the trip iframe**

Replace legacy classes with:

```tsx
<div className="overflow-hidden rounded-2xl border border-mrc-primary/20 bg-[var(--mrc-gradient-panel)] shadow-[0_8px_28px_var(--mrc-shadow-primary)]">
  <div className="relative min-h-80 h-[68dvh] max-h-[620px] w-full bg-white">
    <iframe className="absolute inset-0 size-full border-0" ... />
  </div>
</div>
```

- [ ] **Step 6: Remove the unused AuthGuard**

Run `rg "AuthGuard" app`. Expected: only `app/components/AuthGuard.tsx`. Delete that file.

- [ ] **Step 7: Verify task**

Run:

```bash
npm run test:ui -- app/components/RoadsideHelpTabs.test.tsx
npm run lint
npm run build
```

Expected: tests pass and static export succeeds.

- [ ] **Step 8: Review checkpoint**

Inspect at 320px, 768px, and 1440px. Confirm the header and tabs do not overflow. Do not commit unless explicitly authorized.

---

### Task 4: Migrate the Got a Ticket Form

**Files:**
- Modify: `app/components/GotTicketForm.tsx`

**Interfaces:**
- Consumes `FormField`, `Input`, `Select`, `Textarea`, `Button`, `Card`, and `StatusBanner`.
- Preserves `validateTicketFiles`, `submitTicketRequest`, preview URL cleanup, payload fields, and HTTP-201/reference success rules.

- [ ] **Step 1: Add a semantic regression test**

Create `app/components/GotTicketForm.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test and confirm failure**

Run `npm run test:ui -- app/components/GotTicketForm.test.tsx`.

Expected: FAIL because IDs, explicit label associations, and some input hints are absent.

- [ ] **Step 3: Replace form shell and cards**

Use a form shell `rounded-3xl border border-mrc-primary/20 bg-[var(--mrc-gradient-panel)] p-3 shadow-[0_8px_28px_var(--mrc-shadow-primary)] sm:p-5 lg:p-6`, a centered header, and `space-y-4`. Use `Card as="section"` for Ticket details and Contact information.

Use `grid grid-cols-1 gap-4 md:grid-cols-2`; apply `md:col-span-2` to descriptions, uploads, and other long fields.

- [ ] **Step 4: Apply explicit input semantics**

Use these IDs and attributes:

- `ticket-citation`: `type="text"`, `autoComplete="off"`, `autoCapitalize="characters"`, `spellCheck={false}`.
- `ticket-violation-date` and `ticket-court-date`: `type="date"`.
- `ticket-state`, `ticket-city`, `ticket-violation-type`, and `ticket-description`: `autoComplete="off"`.
- `ticket-first-name`: `autoComplete="given-name"`, required.
- `ticket-last-name`: `autoComplete="family-name"`, required.
- `ticket-phone`: `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, required.
- `ticket-email`: `type="email"`, `inputMode="email"`, `autoComplete="email"`.
- `ticket-files`: keep accept/multiple; connect the size/type hint with `aria-describedby`.

Use the visually hidden utility `sr-only` for the native file input. Keep the custom upload button and make each Remove button use the secondary/danger focus treatment.

- [ ] **Step 5: Migrate banners and submit controls**

Use `StatusBanner tone="error"` and `tone="success"` without changing copy or success conditions. Use `Button type="submit" loading={submitting}` and retain the disclaimer.

- [ ] **Step 6: Verify task**

Run:

```bash
npm run test:ui -- app/components/GotTicketForm.test.tsx
npm run test:lib
npm run lint
npm run build
```

Expected: tests pass; ticket request behavior compiles unchanged.

- [ ] **Step 7: Manual regression**

At 320px and 768px, add JPEG, PNG, and PDF files, remove a middle item, and confirm previews wrap without horizontal scroll. Simulate an invalid/oversized file and confirm entered fields remain intact.

- [ ] **Step 8: Review checkpoint**

Compare payload-building and submit logic with the pre-task diff; only markup, semantics, imports, and classes may change. Do not commit unless explicitly authorized.

---

### Task 5: Migrate the Roadside Assistance Form

**Files:**
- Modify: `app/components/RoadsideAssistanceForm.tsx`

**Interfaces:**
- Consumes all shared primitives.
- Preserves service IDs, profile defaults, member-toggle behavior, GPS/reverse geocoding, Google Maps URLs, towing conditional fields, payload, and success rules.

- [ ] **Step 1: Add failing behavior/semantics tests**

Create `app/components/RoadsideAssistanceForm.test.tsx`, mock `useMemberProfile` and request helpers, then assert:

```tsx
await user.click(screen.getByRole("button", { name: "Towing" }));
expect(screen.getByText("Drop-off location (for towing)")).toBeInTheDocument();
expect(screen.getByLabelText("VIN")).toHaveAttribute("maxlength", "17");
expect(screen.getByLabelText("ZIP code")).toHaveAttribute("inputmode", "numeric");
expect(screen.getByLabelText("Address")).toHaveAttribute(
  "autocomplete",
  "section-service street-address"
);
```

Also verify the Member Yes/No buttons expose `aria-pressed` and service selection remains a single active choice.

- [ ] **Step 2: Run the test and confirm failure**

Run `npm run test:ui -- app/components/RoadsideAssistanceForm.test.tsx`.

Expected: FAIL for missing explicit labels/attributes.

- [ ] **Step 3: Migrate shell, cards, grids, and buttons**

Use the same shell/header system as the ticket form. Each section becomes a `Card as="section"`. Use:

- Service grid: `grid grid-cols-2 gap-2 sm:grid-cols-4`.
- Standard paired fields: `grid grid-cols-1 gap-4 md:grid-cols-2`.
- City/state/ZIP: `grid grid-cols-1 gap-4 md:grid-cols-3`.
- Address, map, messages, and submit action: full width.
- Service tiles: minimum 76px high, visible `focus-visible:ring-4`, and literal selected/unselected classes.
- Toggle buttons: minimum 44px high and complete literal `aria-pressed` classes.

- [ ] **Step 4: Apply customer and vehicle semantics**

Use explicit IDs and these attributes:

- First name: `autoComplete="given-name"`, required.
- Last name: `autoComplete="family-name"`, required.
- Email: `type="email"`, `inputMode="email"`, `autoComplete="email"`.
- Phone: `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, required.
- Account name: `autoComplete="name"`.
- Membership ID: `autoComplete="off"`, `autoCapitalize="characters"`, `spellCheck={false}`.
- VIN: `maxLength={17}`, `autoComplete="off"`, `autoCapitalize="characters"`, `spellCheck={false}`.
- License plate: `autoComplete="off"`, `autoCapitalize="characters"`, `spellCheck={false}`.
- Make/model/color: `autoComplete="off"`.
- Year/passengers/drive type: native `Select`.

- [ ] **Step 5: Apply service and destination address semantics**

Service fields:

```tsx
autoComplete="section-service street-address"
autoComplete="section-service address-level2"
autoComplete="section-service address-level1"
autoComplete="section-service postal-code"
```

Destination fields use the same suffixes with `section-destination`. ZIP inputs use `inputMode="numeric"`. Keep map iframe titles, lazy loading, referrer policy, external-map rel attributes, and coordinate formatting.

- [ ] **Step 6: Migrate errors, success, and loading states**

Use shared buttons with `loading={serviceGpsLoading}`, `loading={destGpsLoading}`, or `loading={submitting}` as appropriate. Use field-adjacent text for GPS errors and `StatusBanner` for form errors/success. Do not clear state after failures.

- [ ] **Step 7: Verify task**

Run:

```bash
npm run test:ui -- app/components/RoadsideAssistanceForm.test.tsx
npm run test:lib
npm run lint
npm run build
```

Expected: all tests pass and static export succeeds.

- [ ] **Step 8: Manual regression**

At all five target widths, test service selection, early Member toggle changes before profile load, GPS success/error, towing destination visibility, maps, submit error, and disabled states.

- [ ] **Step 9: Review checkpoint**

Diff state initialization, profile-default effects, GPS callbacks, and payload creation against the original. They must remain behaviorally unchanged. Do not commit unless explicitly authorized.

---

### Task 6: Migrate Account Drawer, Logout Dialog, and Login Page

**Files:**
- Modify: `app/components/AccountMenu.tsx`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes shared form/button/banner primitives.
- Preserves dedicated login storage choice: local storage when Remember me is selected, session storage otherwise.
- Preserves account-drawer login storage in local storage.

- [ ] **Step 1: Add failing accessibility tests**

For the login page, mock `loginWP` and Next router; assert username uses `autoComplete="username"`, password uses `current-password`, reveal uses `aria-pressed`, and failed login renders `role="alert"` instead of calling `window.alert`.

For AccountMenu, assert opening focuses the close button, Escape closes and restores focus to the trigger, Enter submits the drawer login form, and logout confirmation has `role="dialog"`, `aria-modal="true"`, and an accessible name.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm run test:ui -- app/login/page.test.tsx app/components/AccountMenu.test.tsx
```

Expected: FAIL for missing focus restoration, drawer form submission, logout dialog semantics, and login error banner.

- [ ] **Step 3: Migrate and harden AccountMenu presentation**

Use a fixed backdrop and `aside` width `w-full max-w-sm`, `h-dvh`, safe-area padding, and `motion-reduce:animate-none`. Convert inline login markup to `<form onSubmit={...}>`. Use:

- Email: `type="email"`, `inputMode="email"`, `autoComplete="username"`, `autoCapitalize="none"`, `spellCheck={false}`.
- Password: `autoComplete="current-password"`.
- Close and dialog action buttons: minimum 44px.

Store trigger and close-button refs. On open, focus close. On close, restore trigger focus. Escape closes the topmost open dialog first. Keep body scroll locking.

- [ ] **Step 4: Add logout dialog semantics and focus**

Give the modal `role="dialog"`, `aria-modal="true"`, `aria-labelledby="logout-title"`, focus Cancel on open, close on Escape, and restore focus to the Logout trigger. Keep `logout()` unchanged.

- [ ] **Step 5: Migrate the dedicated login page**

Use a centered `min-h-dvh` layout and one `Card` with a maximum width around 448px. Add `loginError` state and replace `alert("Login failed")` with `StatusBanner tone="error"`.

Use:

- Username: `id="login-username"`, `type="text"`, `autoComplete="username"`, `autoCapitalize="none"`, `spellCheck={false}`.
- Password: `id="login-password"`, `autoComplete="current-password"`.
- Reveal button: `aria-pressed={showPassword}` and label `Show password`/`Hide password`.
- Remember checkbox: explicit `id`, `htmlFor`, and a 44px label target.

- [ ] **Step 6: Verify auth behavior**

Tests must assert:

```ts
expect(localStorage.getItem("wp_token")).toBe(token);
expect(sessionStorage.getItem("wp_token")).toBeNull();
```

when Remember is selected, and the inverse when cleared. Drawer login must assert local storage only.

- [ ] **Step 7: Run checks**

Run:

```bash
npm run test:ui -- app/login/page.test.tsx app/components/AccountMenu.test.tsx
npm run lint
npm run build
```

Expected: all tests pass and static export succeeds.

- [ ] **Step 8: Review checkpoint**

Confirm no token is moved to cookies or described as protected from scripts. Do not commit unless explicitly authorized.

---

### Task 7: Migrate the Member Profile Page

**Files:**
- Modify: `app/(protected)/profile/page.tsx`
- Modify: `lib/member-profile-form.ts`
- Modify: `lib/member-profile-form.test.ts`
- Create: `app/(protected)/profile/page.test.tsx`

**Interfaces:**
- Produces `validateMemberProfileFields(input): Partial<Record<keyof MemberProfileInput, string>>`.
- Preserves the existing `validateMemberProfileInput(input): string | null` API by returning the first field error.

- [ ] **Step 1: Write failing field-error tests**

Add to `lib/member-profile-form.test.ts`:

```ts
test("profile field validation identifies only invalid fields", () => {
  assert.deepEqual(
    validateMemberProfileFields({ ...validInput, firstName: "", email: "bad" }),
    {
      firstName: "First name is required.",
      email: "Enter a valid email address.",
    }
  );
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run `npm run test:lib`.

Expected: FAIL because `validateMemberProfileFields` is not exported.

- [ ] **Step 3: Implement field-specific validation without changing server rules**

Extract the existing required, email, and length checks into:

```ts
export function validateMemberProfileFields(
  input: MemberProfileInput
): Partial<Record<keyof MemberProfileInput, string>> {
  const errors: Partial<Record<keyof MemberProfileInput, string>> = {};
  const values: MemberProfileInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
  };

  if (!values.firstName) errors.firstName = "First name is required.";
  if (!values.lastName) errors.lastName = "Last name is required.";
  if (!values.displayName) errors.displayName = "Display name is required.";
  if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  for (const [field, limit] of Object.entries(LIMITS) as Array<
    [keyof MemberProfileInput, number]
  >) {
    if (length(values[field]) <= limit || errors[field]) continue;
    const label = field.replace(/([A-Z])/g, " $1").toLowerCase();
    errors[field] = `${label.charAt(0).toUpperCase()}${label.slice(
      1
    )} must be ${limit} characters or fewer.`;
  }

  return errors;
}

export function validateMemberProfileInput(input: MemberProfileInput): string | null {
  const errors = validateMemberProfileFields(input);
  return (Object.values(errors)[0] as string | undefined) ?? null;
}
```

Implement every current rule exactly; do not weaken limits or email validation.

- [ ] **Step 4: Migrate profile layout and controls**

Replace `fieldsInvalid: boolean` with field errors. Use a centered `max-w-3xl` page, responsive readonly and edit grids (`grid-cols-1 md:grid-cols-2`), and full-width display name/email/phone fields. Use shared primitives and IDs `profile-first-name`, `profile-last-name`, `profile-display-name`, `profile-email`, and `profile-phone`.

Set `inputMode="email"` for email and `inputMode="tel"` for phone. Pass only the corresponding field error into each `FormField`. Keep username and membership ID read-only text.

- [ ] **Step 5: Add the profile UI regression test**

Create `app/(protected)/profile/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import ProfilePage from "./page";

vi.mock("@/app/hooks/useMemberProfile", () => ({
  useMemberProfile: () => ({
    loading: false,
    error: null,
    profile: {
      id: 123,
      username: "member-login",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+15550100",
      membershipId: "MRC-1001",
    },
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
});
```

- [ ] **Step 6: Preserve API errors and successful cache refresh**

Server validation errors remain form-level when they cannot be mapped safely. Keep `saveMemberProfile`, profile cache refresh, success copy, loading state, and sign-in-again link behavior unchanged.

- [ ] **Step 7: Verify task**

Run:

```bash
npm run test:lib
npm run test:ui -- app/\\(protected\\)/profile/page.test.tsx
npm run lint
npm run build
```

Expected: field-validation and profile UI tests pass; static export succeeds.

- [ ] **Step 8: Manual regression**

Test delayed profile loading, typing before load completes, each required error independently, invalid email, save success, API validation failure, and auth failure.

- [ ] **Step 9: Review checkpoint**

Confirm profile field sources and membership ID read-only behavior remain unchanged. Do not commit unless explicitly authorized.

---

### Task 8: Remove Legacy CSS and Complete the Responsive Audit

**Files:**
- Modify: `app/globals.css`
- Modify: `.cursor/rules/project-plan.mdc`
- Review: all files under `app/`

**Interfaces:**
- Produces a globals file containing only Tailwind import/theme, root variables, minimal base rules, safe-area utilities, and necessary keyframes.

- [ ] **Step 1: Search for remaining legacy classes**

Run:

```bash
rg 'className=.*(ra-|mrc-|app-|explore-|show-password|pr-12|mb-4)' app
```

Expected: no output. If a match remains, migrate that consumer before deleting its selector.

- [ ] **Step 2: Remove all legacy feature selectors**

Reduce `app/globals.css` to:

- `@import "tailwindcss";`
- `@theme inline` tokens.
- `:root` brand variables and gradients.
- Minimal `html/body` sizing and safe-area rules not expressible clearly at call sites.
- Keyframes still referenced by arbitrary Tailwind animation values.
- `@media (prefers-reduced-motion: reduce)` overrides for nonessential motion.

Remove every `.ra-*`, `.mrc-*`, `.app-*`, `.explore-*`, `.show-password`, `.pr-12`, and `.mb-4` selector.

- [ ] **Step 3: Update the project rule**

Add a concise “Tailwind and responsive UI” section to `.cursor/rules/project-plan.mdc` recording:

- Tailwind v4/PostCSS ownership.
- Shared primitives under `app/components/ui`.
- 320/mobile, 768/tablet, and 1024/desktop layout tiers.
- 44px controls, mobile 16px inputs, semantic input attributes, and ARIA requirements.
- `globals.css` restriction against feature/component selectors.

- [ ] **Step 4: Run the complete automated suite**

Run:

```bash
npm test
npm run test:wp-plugin
npm run lint
npm run build
```

Expected: all library/UI/plugin tests pass, lint exits 0, and `next build` produces the static export.

- [ ] **Step 5: Check selector and overflow risk**

Run:

```bash
rg 'ra-|mrc-|app-|explore-|show-password|pr-12|mb-4' app --glob '*.{ts,tsx,css}'
rg 'grid-cols-2|grid-cols-3|w-screen|min-w-' app --glob '*.tsx'
```

Expected: the first command has no legacy class output. Review the second command and confirm all multi-column layouts are breakpoint-gated or intentionally safe.

- [ ] **Step 6: Perform the five-width manual matrix**

At 320, 390, 768, 1024, and 1440px verify:

- No horizontal page scroll.
- Header, tabs, drawer, logout dialog, maps, iframe, and file previews fit.
- Mobile forms are one column; paired fields begin at `md`; desktop uses the wider centered container.
- Every control is at least 44px and every mobile input renders at 16px.
- Keyboard order, tab arrow keys, Escape behavior, focus restoration, and focus rings work.
- Labels, helper text, errors, required indicators, `aria-invalid`, and status roles are correct.
- Mobile keyboards and autocomplete hints match the field data.
- Login, profile, ticket, roadside, GPS, towing, upload, failed submit, and success flows preserve behavior.

- [ ] **Step 7: Final diff audit**

Run `git diff --check` and inspect `git diff --stat` plus the complete diff. Expected: no whitespace errors, no unrelated backend/plugin changes, and no generated `out/` files tracked.

- [ ] **Step 8: Review checkpoint**

Present the completed diff and verification results. Do not commit or deploy unless explicitly requested.
