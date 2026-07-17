# WordPress Form Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist both authenticated application forms in WordPress, including ticket media uploads, and show success only after confirmed storage.

**Architecture:** A self-contained WordPress plugin registers two private request post types and two JWT-protected REST endpoints. A shared Next.js client sends JSON or multipart requests from the existing static-export forms and translates API failures into actionable UI messages.

**Tech Stack:** WordPress REST API and Media Library (PHP 8-compatible), existing WordPress JWT authentication, Next.js 14 static export, React 18, TypeScript 5.

## Global Constraints

- Do not add a WordPress runtime dependency such as ACF or a form plugin.
- Do not place privileged WordPress credentials in the static application.
- Require a valid WordPress JWT for every submission.
- Accept at most 10 ticket files: JPEG, PNG, or PDF; 10 MB each and 50 MB combined.
- Allow production browser submissions only from `https://app.myroadclub.com`; support one configured development origin.
- Keep the existing required fields: ticket contact first name, last name, and phone; roadside service type plus those contact fields.
- Keep the application as a Next.js static export.
- Do not create Git commits unless the user explicitly requests them.

## File Structure

### New WordPress plugin files

- `wordpress/myroadclub-requests/myroadclub-requests.php` — plugin bootstrap, constants, includes, and hooks.
- `wordpress/myroadclub-requests/includes/class-mrc-request-post-types.php` — CPT and meta registration.
- `wordpress/myroadclub-requests/includes/class-mrc-request-validator.php` — payload normalization and validation.
- `wordpress/myroadclub-requests/includes/class-mrc-request-rest-controller.php` — routes, JWT permission checks, persistence, media handling, and rollback.
- `wordpress/myroadclub-requests/includes/class-mrc-request-admin.php` — admin list columns and read-only detail panels.
- `wordpress/myroadclub-requests/includes/class-mrc-request-cors.php` — namespace-scoped preflight and response headers.
- `wordpress/myroadclub-requests/tests/validator-test.php` — executable pure-PHP validator contract tests.

### New application/test files

- `lib/wp-requests.ts` — API URL, token lookup, payload types, response type, error class, and both submit methods.
- `scripts/tests/wordpress-plugin.test.sh` — PHP syntax and validator test runner.

### Modified files

- `app/components/GotTicketForm.tsx` — build multipart request, await API, and display reference/errors.
- `app/components/RoadsideAssistanceForm.tsx` — await JSON API and display reference/errors.
- `package.json` — add the WordPress plugin test script.
- `.env.example` — document `NEXT_PUBLIC_WORDPRESS_URL`.
- `docs/deployment.md` — document plugin installation and server upload limits.
- `.cursor/rules/project-plan.mdc` — replace client-only submission notes with the implemented WordPress behavior.

---

### Task 1: WordPress Request Data Model and Validation

**Files:**
- Create: `wordpress/myroadclub-requests/myroadclub-requests.php`
- Create: `wordpress/myroadclub-requests/includes/class-mrc-request-post-types.php`
- Create: `wordpress/myroadclub-requests/includes/class-mrc-request-validator.php`
- Create: `wordpress/myroadclub-requests/tests/validator-test.php`
- Create: `scripts/tests/wordpress-plugin.test.sh`
- Modify: `package.json`

**Interfaces:**
- Produces: `MRC_Request_Post_Types::register(): void`
- Produces: `MRC_Request_Validator::ticket(array $input): array|WP_Error`
- Produces: `MRC_Request_Validator::roadside(array $input): array|WP_Error`
- Produces: CPT names `mrc_ticket_request` and `mrc_roadside_request`

- [ ] **Step 1: Write validator contract tests**

Create a lightweight test harness that defines a minimal `WP_Error` stand-in,
loads the validator, and asserts:

```php
$valid_ticket = MRC_Request_Validator::ticket([
    'firstName' => 'Ada',
    'lastName' => 'Lovelace',
    'phone' => '+1 555 0100',
    'violationType' => 'Speeding',
]);
assert_same('Ada', $valid_ticket['firstName'], 'valid ticket is normalized');

$invalid_ticket = MRC_Request_Validator::ticket([
    'firstName' => '',
    'lastName' => 'Lovelace',
    'phone' => '+1 555 0100',
]);
assert_true($invalid_ticket instanceof WP_Error, 'ticket requires first name');

$invalid_service = MRC_Request_Validator::roadside([
    'serviceType' => 'not-real',
    'customer' => ['firstName' => 'Ada', 'lastName' => 'Lovelace', 'phone' => '1'],
]);
assert_true($invalid_service instanceof WP_Error, 'service type is constrained');
```

- [ ] **Step 2: Run the tests and confirm the initial failure**

Run: `php wordpress/myroadclub-requests/tests/validator-test.php`

Expected: non-zero exit because `class-mrc-request-validator.php` does not exist.

- [ ] **Step 3: Implement the validator**

Implement explicit allowlists:

```php
private const SERVICE_TYPES = [
    'jump-start', 'flat-tire', 'fuel', 'lockout',
    'winch', 'towing', 'battery', 'other',
];
private const VIOLATION_TYPES = [
    '', 'Speeding', 'Parking', 'Red light / stop sign',
    'HOV / carpool', 'Registration / plates',
    'Cell phone / distracted', 'Other',
];
private const PASSENGERS = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8+'];
private const DRIVE_TYPES = ['', 'FWD', 'RWD', 'AWD', '4WD', 'Other'];
```

Return `WP_Error('mrc_validation_error', ..., ['status' => 422])` for missing
required values, invalid enums, malformed dates/emails/coordinates, or values
over defined text limits. Return a complete normalized array on success.
Normalize absent nested objects to empty values, remove drop-off values unless
the service is towing, and remove account values unless `isMember` is true.

- [ ] **Step 4: Register private CPTs and meta**

Bootstrap the plugin with:

```php
/**
 * Plugin Name: MyRoadClub Requests
 * Description: Stores authenticated ticket and roadside requests.
 * Version: 1.0.0
 */
defined('ABSPATH') || exit;

define('MRC_REQUESTS_VERSION', '1.0.0');
define('MRC_REQUESTS_FILE', __FILE__);
define('MRC_REQUESTS_DIR', plugin_dir_path(__FILE__));
```

Register both CPTs with `show_ui => true`, `public => false`,
`publicly_queryable => false`, `exclude_from_search => true`, and support for
`title` and `author`. Register every meta key from the approved design with
`show_in_rest => false`, a matching scalar or array type, single-value
semantics, and a sanitization callback.

- [ ] **Step 5: Add the plugin test runner**

The shell test must:

```bash
set -euo pipefail
while IFS= read -r -d '' file; do
  php -l "$file"
done < <(printf '%s\0' wordpress/myroadclub-requests/*.php wordpress/myroadclub-requests/includes/*.php)
php wordpress/myroadclub-requests/tests/validator-test.php
```

Add `"test:wp-plugin": "bash scripts/tests/wordpress-plugin.test.sh"` to
`package.json`.

- [ ] **Step 6: Run the task verification**

Run: `npm run test:wp-plugin`

Expected: all PHP files report no syntax errors and the validator test prints
`Validator tests passed.`

---

### Task 2: Authenticated REST Persistence and Media Uploads

**Files:**
- Create: `wordpress/myroadclub-requests/includes/class-mrc-request-rest-controller.php`
- Modify: `wordpress/myroadclub-requests/myroadclub-requests.php`
- Modify: `wordpress/myroadclub-requests/tests/validator-test.php`

**Interfaces:**
- Consumes: validator methods and CPT names from Task 1.
- Produces: `POST /wp-json/myroadclub/v1/ticket-requests`
- Produces: `POST /wp-json/myroadclub/v1/roadside-requests`
- Produces success body `{ id, reference, status, createdAt }`

- [ ] **Step 1: Extend tests for persistence mapping helpers**

Test that:

```php
$ticket_meta = MRC_Request_REST_Controller::ticket_meta($valid_ticket);
assert_same('Ada', $ticket_meta['_mrc_customer_first_name'], 'ticket meta maps first name');

$roadside_meta = MRC_Request_REST_Controller::roadside_meta($valid_roadside);
assert_same('jump-start', $roadside_meta['_mrc_service_type'], 'roadside meta maps service');
assert_true(!array_key_exists('_mrc_dropoff_address', $roadside_meta), 'non-towing omits drop-off');
```

Run the test and expect failure because the controller class is not defined.

- [ ] **Step 2: Register both routes**

Use `rest_api_init` and:

```php
register_rest_route('myroadclub/v1', '/ticket-requests', [
    'methods' => WP_REST_Server::CREATABLE,
    'callback' => [self::class, 'create_ticket'],
    'permission_callback' => [self::class, 'require_login'],
]);
register_rest_route('myroadclub/v1', '/roadside-requests', [
    'methods' => WP_REST_Server::CREATABLE,
    'callback' => [self::class, 'create_roadside'],
    'permission_callback' => [self::class, 'require_login'],
]);
```

`require_login()` must return true only when `get_current_user_id() > 0`;
otherwise return a `WP_Error` with status `401`.

- [ ] **Step 3: Implement shared post persistence**

Create a pending request with the current user as author, write all mapped
meta, generate `TK-YYYYMMDD-ID` or `RA-YYYYMMDD-ID`, then update the post title.
Check every `is_wp_error()` result and return a generic status-`500` error
without exposing internals.

- [ ] **Step 4: Implement ticket multipart parsing and file validation**

Decode `payload` from the multipart body and normalize the shape of
`$_FILES['attachments']`. Reject before post creation when:

```php
count($files) > 10;
$file['size'] > 10 * MB_IN_BYTES;
$combined_size > 50 * MB_IN_BYTES;
!in_array($checked_type, ['image/jpeg', 'image/png', 'application/pdf'], true);
```

Use `wp_check_filetype_and_ext()` for actual type checks. Treat PHP upload
errors as request errors.

- [ ] **Step 5: Upload and roll back atomically**

After creating the ticket post, load WordPress media includes and upload each
validated file with `media_handle_sideload($file_array, $post_id)`. Save all
attachment IDs in `_mrc_attachment_ids`.

On any upload or meta failure:

```php
foreach ($created_attachment_ids as $attachment_id) {
    wp_delete_attachment($attachment_id, true);
}
wp_delete_post($post_id, true);
```

Return `413` for size/count errors, `422` for validation/type errors, and `500`
for storage failures.

- [ ] **Step 6: Verify PHP contracts**

Run: `npm run test:wp-plugin`

Expected: syntax checks and mapping/validator tests pass.

---

### Task 3: WordPress Admin Views and Restricted CORS

**Files:**
- Create: `wordpress/myroadclub-requests/includes/class-mrc-request-admin.php`
- Create: `wordpress/myroadclub-requests/includes/class-mrc-request-cors.php`
- Modify: `wordpress/myroadclub-requests/myroadclub-requests.php`

**Interfaces:**
- Consumes: CPT/meta constants and REST namespace from Tasks 1–2.
- Produces: admin list columns, request detail metaboxes, and route-specific CORS.

- [ ] **Step 1: Add admin list columns**

For both CPTs, replace unhelpful default columns with reference, requester,
phone, type, status, and date. Render all values with `esc_html()`.

- [ ] **Step 2: Add read-only request details**

Register one metabox per CPT. Render nonce-free read-only tables because the
box does not save. Escape text with `esc_html()`, render multiline values with
`nl2br(esc_html(...))`, build map URLs with `add_query_arg()`, and use
`wp_get_attachment_link()` for saved ticket IDs.

- [ ] **Step 3: Add namespace-scoped CORS**

Use `rest_pre_serve_request` to handle only routes beginning
`/myroadclub/v1/`. Compare the request origin against:

```php
$allowed = array_filter([
    'https://app.myroadclub.com',
    defined('MRC_REQUESTS_DEV_ORIGIN') ? MRC_REQUESTS_DEV_ORIGIN : '',
]);
```

For an allowed origin emit `Access-Control-Allow-Origin` with the exact origin,
`Vary: Origin`, and allow `Authorization, Content-Type`. Reject an unapproved
origin without weakening the JWT permission check. Ensure `OPTIONS` preflight
returns the required methods and headers.

- [ ] **Step 4: Run plugin verification**

Run: `npm run test:wp-plugin`

Expected: every new PHP file passes syntax validation and validator/mapping
contracts still pass.

---

### Task 4: Shared TypeScript WordPress Request Client

**Files:**
- Create: `lib/wp-requests.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `getWordPressToken(): string | null`
- Produces: `submitTicketRequest(payload: TicketRequestPayload, files: File[]): Promise<RequestCreated>`
- Produces: `submitRoadsideRequest(payload: RoadsideRequestPayload): Promise<RequestCreated>`
- Produces: `WordPressRequestError` with `kind: "auth" | "validation" | "size" | "network" | "server"`

- [ ] **Step 1: Define exact request and response types**

Define `TicketRequestPayload`, `RoadsideRequestPayload`, nested customer,
vehicle/location/additional interfaces, and:

```ts
export interface RequestCreated {
  id: number;
  reference: string;
  status: "pending";
  createdAt: string;
}
```

Do not include client attachment metadata or `submittedAt` in API payloads.

- [ ] **Step 2: Implement token and URL handling**

Read the token in the same order as the guard:

```ts
export function getWordPressToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wp_token") ?? sessionStorage.getItem("wp_token");
}
```

Build endpoints from
`process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://myroadclub.com"` after
removing trailing slashes.

- [ ] **Step 3: Implement fetch and error translation**

For tickets, create `FormData`, append the serialized payload under `payload`,
and append each file under `attachments[]`; do not manually set
`Content-Type`. For roadside requests, send JSON with `Content-Type:
application/json`. Both send the Bearer token.

Map status `401`, `413`, `422`, network exceptions, and other responses to the
five error kinds. Treat anything other than HTTP `201` with a valid response
body as failure.

- [ ] **Step 4: Verify TypeScript integration**

Run: `npm run lint`

Expected: no lint errors in `lib/wp-requests.ts`.

---

### Task 5: Connect Both Forms to WordPress

**Files:**
- Modify: `app/components/GotTicketForm.tsx`
- Modify: `app/components/RoadsideAssistanceForm.tsx`

**Interfaces:**
- Consumes: all exports from `lib/wp-requests.ts`.
- Produces: real persistence UI with server reference and retry-safe failure states.

- [ ] **Step 1: Connect ticket submission**

Make `onSubmit` asynchronous. Keep existing required-field validation, then:

```ts
try {
  setSubmitting(true);
  setSubmitOk(null);
  const result = await submitTicketRequest(ticketPayload, ticketFiles);
  setSubmitOk(result);
} catch (error) {
  setSubmitError(requestErrorMessage(error));
} finally {
  setSubmitting(false);
}
```

Replace boolean success state with `RequestCreated | null`, show the returned
reference, and preserve all fields/files on failure. Narrow the file input
accept value to `image/jpeg,image/png,application/pdf`. Before sending, reject
more than 10 files, any file above 10 MB, or a combined size above 50 MB.

- [ ] **Step 2: Connect roadside submission**

Make `onSubmit` asynchronous, call `submitRoadsideRequest()`, store the returned
response, and show its reference. Keep all entered values on every failure.

- [ ] **Step 3: Add actionable error copy**

Map error kinds to:

```ts
const messages = {
  auth: "Your session has expired. Please sign in again before submitting.",
  validation: "Some information could not be accepted. Review the form and try again.",
  size: "The selected files exceed the upload limit. Remove or reduce files and try again.",
  network: "Could not reach My Road Club. Check your connection and try again.",
  server: "We could not save your request. Please try again or call member services.",
};
```

Never clear form state or display success in a catch path.

- [ ] **Step 4: Run application checks**

Run: `npm run lint && npm run build`

Expected: lint succeeds and Next.js produces the static export without type
errors.

---

### Task 6: Documentation and End-to-End Verification

**Files:**
- Modify: `docs/deployment.md`
- Modify: `.cursor/rules/project-plan.mdc`

**Interfaces:**
- Consumes: plugin and application behavior from Tasks 1–5.
- Produces: repeatable installation and production verification instructions.

- [ ] **Step 1: Document WordPress installation**

Document copying `wordpress/myroadclub-requests/` into
`wp-content/plugins/myroadclub-requests/`, activating it with WordPress Admin
or WP-CLI, and setting a development origin in `wp-config.php` only when
needed:

```php
define('MRC_REQUESTS_DEV_ORIGIN', 'http://localhost:3000');
```

- [ ] **Step 2: Document server and build configuration**

Add:

```dotenv
NEXT_PUBLIC_WORDPRESS_URL=https://myroadclub.com
```

Document checking PHP `upload_max_filesize`, `post_max_size`,
`max_file_uploads`, Nginx `client_max_body_size`, and forwarding the
`Authorization` header to PHP-FPM.

- [ ] **Step 3: Update project notes**

State that both forms persist through authenticated WordPress endpoints,
ticket files enter Media Library, server response controls success, and the
plugin is the canonical meta/schema owner.

- [ ] **Step 4: Run local verification**

Run:

```bash
npm run test:wp-plugin
npm run lint
npm run build
git diff --check
```

Expected: all checks succeed with no whitespace errors.

- [ ] **Step 5: Verify on a WordPress staging or production server**

After plugin installation, obtain a normal member JWT and verify:

```bash
curl -i -X POST 'https://myroadclub.com/wp-json/myroadclub/v1/roadside-requests' \
  -H "Authorization: Bearer $WP_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"serviceType":"jump-start","serviceDetails":"Test request","customer":{"firstName":"Test","lastName":"Member","phone":"+15550100","email":"","isMember":true,"accountName":"","membershipId":""},"vehicle":{"year":"","make":"","model":"","color":"","vin":"","plate":"","safeLocation":true},"serviceLocation":{"address":"","city":"","state":"","zip":""},"dropOff":null,"additional":{"passengers":"1","driveType":"","withVehicle":true}}'
```

Expected: HTTP `201`, a generated `RA-...` reference, a pending WordPress
record authored by the member, and no public route for viewing the post.

Submit a ticket with `curl -F` and a JPEG/PDF, then confirm HTTP `201`, the
`TK-...` request, and linked Media Library items. Repeat without a token and
expect `401`; repeat with an invalid file and expect `422`.

