# Tailwind CSS and Responsive UI Design

## Goal

Migrate the complete application UI from legacy component classes in `app/globals.css` to Tailwind CSS while preserving the MyRoadClub brand and all existing business behavior. Improve layouts for mobile, tablet, and desktop, and make form controls consistent, accessible, and appropriate for their data.

## Scope

The migration covers every application route and shared component, including:

- Protected home page and header
- Roadside Assistance tabs and request form
- Got a Ticket form and file previews
- Plan a Trip embed
- Account drawer, confirmation modal, and loading states
- Login page
- Member profile page
- Authentication guard states

The work does not change authentication, WordPress APIs, profile autofill, GPS, maps, uploads, request submission, persistence, or error-response behavior.

## Tailwind Architecture

- Install Tailwind CSS with the PostCSS integration supported by the current Next.js 14 application.
- Define reusable MyRoadClub design tokens for primary, cyan, text, muted text, border, surface, tint, danger, shadows, and gradients.
- Use mobile-first Tailwind utility classes in route and feature components.
- Keep `app/globals.css` limited to the Tailwind entry point, essential base rules, shared CSS variables, safe-area behavior, and animations that are clearer as CSS.
- Remove legacy component selectors after all consumers have migrated.
- Do not introduce a third-party component library.

## Shared UI Components

Create small reusable primitives for repeated presentation and accessibility behavior:

- `FormField`: label, required indicator, helper text, and error association
- `Input`: common sizing, focus, disabled, read-only, and invalid states
- `Select`: input-compatible sizing and states
- `Textarea`: shared states with vertical resizing and a sensible minimum height
- `Button`: primary, secondary, danger, and loading/disabled variants
- `Card`: common surface, border, radius, spacing, and shadow

Feature-specific controls such as service tiles, member toggles, tabs, file previews, and map panels remain in their feature components. Existing state and event handlers remain unchanged.

## Responsive Layout

Use three layout tiers:

- Mobile, from 320px: one-column forms, compact page padding, touch-friendly controls, wrapping tabs where required, and no horizontal overflow.
- Tablet, from 768px: pair related short fields in two columns and increase card/page spacing.
- Desktop, from 1024px: use a wider centered container and arrange suitable form sections or field groups in two columns while preserving the natural reading and keyboard order.

Long content such as addresses, textareas, maps, file uploads, notices, and submit actions spans the full available form width. The account drawer remains a bounded slide-over on larger screens and uses the full practical width on small screens. Embedded maps and web content remain fluid.

## Input Design

- Give interactive controls a minimum 44px touch target.
- Use a 16px input font on mobile to prevent unwanted iOS form zoom.
- Set appropriate `type`, `inputMode`, and `autoComplete` values for names, email, phone, username, password, address, postal information, and vehicle fields.
- Associate every visible label with its control using `htmlFor` and `id`.
- Connect helper and error text with `aria-describedby`; set `aria-invalid` when applicable.
- Preserve native form semantics and browser behavior unless a feature requires a custom control.
- Give checkbox, toggle, service selection, upload, reveal-password, and remove-file controls visible keyboard focus and clear selected/disabled states.
- Communicate validation with text and styling rather than color alone.

## States and Error Handling

Existing client and server validation rules remain authoritative. Authentication, validation, upload-size, network, and server errors continue to use the current application flow. Their presentation becomes consistent across features:

- Field-specific errors appear next to the related field where available.
- Form-level errors and successes use accessible banners.
- Loading and disabled states prevent duplicate actions and remain visibly distinct.
- Failed submissions preserve entered form data.
- Success is shown only under the existing server-response rules.

## Verification

Run lint and the production build. Manually verify representative widths of 320px, 390px, 768px, 1024px, and 1440px. Check:

- No horizontal page scrolling
- Header, tabs, account drawer, modal, maps, iframe, and file previews
- Login, profile, ticket, and roadside form flows
- Keyboard order and visible focus
- Label and error associations
- Appropriate mobile keyboards and autocomplete hints
- Touch-target sizes
- Loading, disabled, error, and success states

## Acceptance Criteria

- Every application route and component uses Tailwind utilities or the approved shared UI primitives.
- `app/globals.css` contains no legacy feature/component styling.
- Brand colors, logo, typography, and recognizable visual identity are preserved and refined.
- Mobile, tablet, and desktop layouts follow the defined responsive tiers without horizontal overflow.
- Inputs use appropriate semantics and consistent accessible states.
- Existing application behavior and WordPress integrations remain unchanged.
- Lint and production build pass.
