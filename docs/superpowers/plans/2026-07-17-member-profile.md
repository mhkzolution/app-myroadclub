# Member Profile and Form Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load authenticated member information from WordPress, prefill both request forms safely, and provide an in-app profile editor.

**Architecture:** The WordPress plugin exposes JWT-protected GET/PATCH profile endpoints scoped to the current user. A cached typed client supplies profile data to forms and the profile page, while pure empty-only merge helpers prevent asynchronous loads from overwriting user input.

**Tech Stack:** WordPress REST API/PHP, existing JWT plugin, Next.js 14 static export, React 18, TypeScript 5, Node test runner.

## Global Constraints

- Never accept a target user ID from the browser; use `get_current_user_id()`.
- Username and membership ID are read-only.
- Do not overwrite non-empty form values during autofill.
- Do not add privileged credentials or a server runtime to the static app.
- Keep CORS restricted to the existing `myroadclub/v1` policy.
- Preserve current request payload contracts.
- Follow TDD and commit each reviewed task on `feat/member-profile`.

---

### Task 1: WordPress Member Profile Endpoint

**Files:**
- Create: `wordpress/myroadclub-requests/includes/class-mrc-member-profile-controller.php`
- Create: `wordpress/myroadclub-requests/tests/member-profile-test.php`
- Modify: `wordpress/myroadclub-requests/myroadclub-requests.php`
- Modify: `wordpress/myroadclub-requests/includes/class-mrc-request-cors.php`

**Interfaces:**
- Produces: `GET/PATCH /wp-json/myroadclub/v1/member-profile`
- Produces: `MRC_Member_Profile_Controller::profile_data(WP_User): array`
- Produces: `MRC_Member_Profile_Controller::validate_update(array): array|WP_Error`

- [ ] Write failing standalone contracts for mapping core fields, phone and
membership fallbacks, invalid updates, current-user scoping, and safe update
responses.
- [ ] Run `php wordpress/myroadclub-requests/tests/member-profile-test.php`;
expect failure because the controller is absent.
- [ ] Implement JWT-protected GET/PATCH routes using
`get_current_user_id()`, `get_userdata()`, `wp_update_user()`, and verified
user-meta writes.
- [ ] Add `PATCH` to the existing CORS allow-methods header.
- [ ] Run `npm run test:wp-plugin`; expect all plugin contracts to pass.
- [ ] Commit as `feat: add authenticated member profile API`.

### Task 2: Typed Profile Client and Autofill Contracts

**Files:**
- Create: `lib/wp-profile.ts`
- Create: `lib/wp-profile.test.ts`
- Create: `app/hooks/useMemberProfile.ts`
- Modify: `lib/wp-requests.ts`

**Interfaces:**
- Produces: `MemberProfile`
- Produces: `getMemberProfile(force?: boolean): Promise<MemberProfile>`
- Produces: `saveMemberProfile(input): Promise<MemberProfile>`
- Produces: `applyProfileDefaults<T>(current, defaults): T`
- Produces: `useMemberProfile()`

- [ ] Write failing TypeScript tests for GET/PATCH auth and payloads, response
validation, cache reuse/invalidation, error mapping, update notification, and
empty-only defaults.
- [ ] Run `npx --yes tsx --test lib/wp-profile.test.ts`; expect missing-module
failure.
- [ ] Implement the client using shared WordPress URL/token helpers and a
browser update event. Export shared URL/error utilities from `wp-requests`
only where necessary.
- [ ] Implement a hook that loads profile data and listens for successful
updates without blocking form rendering.
- [ ] Run profile and existing request client tests; expect all to pass.
- [ ] Commit as `feat: add cached WordPress member profile client`.

### Task 3: Form Autofill and Protected Profile Page

**Files:**
- Modify: `app/components/GotTicketForm.tsx`
- Modify: `app/components/RoadsideAssistanceForm.tsx`
- Modify: `app/components/AccountMenu.tsx`
- Modify: `app/(protected)/layout.tsx`
- Create: `app/(protected)/profile/page.tsx`
- Delete: `app/profile/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `useMemberProfile()`, `applyProfileDefaults()`, and profile save.
- Produces: `/profile` editor and empty-only form prefill.

- [ ] Add focused failing tests for pure field-default decisions and profile
input validation where they are not already covered.
- [ ] Prefill ticket contact fields only when empty.
- [ ] Prefill roadside contact/member fields only when empty and set member
status after a profile is loaded.
- [ ] Build the protected branded profile editor with read-only username and
membership ID, loading/save/error/success states, and confirmed cache update.
- [ ] Link My Account to `/profile`, use profile data for its greeting, and
make protected layout recognize both local and session JWT storage.
- [ ] Run TypeScript tests, `npm run lint`, and `npm run build`.
- [ ] Commit as `feat: autofill request forms and add member profile editor`.

### Task 4: Documentation, Packaging, and Final Verification

**Files:**
- Modify: `.cursor/rules/project-plan.mdc`
- Modify: `docs/deployment.md`
- Modify: `wordpress/myroadclub-requests/myroadclub-requests.php`
- Create/update locally: `wordpress/myroadclub-requests.zip`

- [ ] Document profile endpoint behavior, plugin-first deployment, member
field sources, and live GET/PATCH/autofill verification.
- [ ] Bump plugin version and produce an upload-ready ZIP whose root directory
is exactly `myroadclub-requests/`.
- [ ] Run `npm run test:wp-plugin`, all TypeScript tests, lint, build, and
`git diff --check`.
- [ ] Review the full branch for auth, user scoping, data-loss, client/server
contract, and deployment issues; fix every Critical/Important finding.
- [ ] Commit tracked documentation/version changes. Keep the ZIP available for
manual WordPress upload even if repository policy leaves it untracked.
