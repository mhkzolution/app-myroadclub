# WordPress Form Submission Design

## Goal

Persist the existing **Got a ticket?** and **Roadside Assistance** forms in
WordPress. Only users authenticated through the existing WordPress JWT login
may submit. Ticket images and PDFs are uploaded to the WordPress Media Library
and linked to their request.

The Next.js application remains a static export. WordPress is the only backend
for this feature.

## Architecture

### WordPress plugin

Add a deployable plugin at `wordpress/myroadclub-requests/`. The plugin is
uploaded to `wp-content/plugins/myroadclub-requests/` on `myroadclub.com` and
activated by an administrator.

The plugin owns:

- two non-public custom post types;
- all request meta registration and sanitization;
- two authenticated REST endpoints;
- ticket media uploads and attachment relationships;
- request details and useful list columns in WordPress Admin;
- CORS handling for the request endpoints.

The implementation must not depend on ACF or another form plugin.

### Application client

Add a small API client under `lib/` that:

- reads `wp_token` from local storage or session storage;
- reads the WordPress origin from `NEXT_PUBLIC_WORDPRESS_URL`;
- sends the JWT as `Authorization: Bearer <token>`;
- parses structured WordPress errors into safe user-facing messages.

Both forms call this client instead of logging a payload and immediately
reporting success.

## WordPress data model

### Custom post types

| Label | Post type | Visibility | Initial status |
|---|---|---|---|
| Roadside Requests | `mrc_roadside_request` | Admin only | `pending` |
| Ticket Requests | `mrc_ticket_request` | Admin only | `pending` |

Both post types have `public` and `publicly_queryable` disabled, are excluded
from search, and are visible in WordPress Admin. The authenticated WordPress
user becomes `post_author`. A server-generated reference is used as the post
title:

- `RA-YYYYMMDD-<post-id>` for roadside requests;
- `TK-YYYYMMDD-<post-id>` for ticket requests.

The server creation time is authoritative. The client-supplied `submittedAt`
field is not stored.

### Ticket meta mapping

| App field | WordPress meta key | Type |
|---|---|---|
| `citationNumber` | `_mrc_citation_number` | string |
| `violationDate` | `_mrc_violation_date` | `YYYY-MM-DD` string |
| `state` | `_mrc_violation_state` | US state code string |
| `city` | `_mrc_violation_city` | string |
| `violationType` | `_mrc_violation_type` | allowed enum string |
| `description` | `_mrc_ticket_description` | multiline string |
| `courtDate` | `_mrc_court_date` | `YYYY-MM-DD` string |
| `firstName` | `_mrc_customer_first_name` | string |
| `lastName` | `_mrc_customer_last_name` | string |
| `phone` | `_mrc_customer_phone` | string |
| `email` | `_mrc_customer_email` | email string |
| Uploaded files | `_mrc_attachment_ids` | array of media attachment IDs |

### Roadside meta mapping

| App field | WordPress meta key | Type |
|---|---|---|
| `serviceType` | `_mrc_service_type` | allowed enum string |
| `serviceDetails` | `_mrc_service_details` | multiline string |
| `customer.firstName` | `_mrc_customer_first_name` | string |
| `customer.lastName` | `_mrc_customer_last_name` | string |
| `customer.phone` | `_mrc_customer_phone` | string |
| `customer.email` | `_mrc_customer_email` | email string |
| `customer.isMember` | `_mrc_is_member` | boolean |
| `customer.accountName` | `_mrc_account_name` | string |
| `customer.membershipId` | `_mrc_membership_id` | string |
| `vehicle.year` | `_mrc_vehicle_year` | four-digit string |
| `vehicle.make` | `_mrc_vehicle_make` | string |
| `vehicle.model` | `_mrc_vehicle_model` | string |
| `vehicle.color` | `_mrc_vehicle_color` | string |
| `vehicle.vin` | `_mrc_vehicle_vin` | string |
| `vehicle.plate` | `_mrc_vehicle_plate` | string |
| `vehicle.safeLocation` | `_mrc_vehicle_safe_location` | boolean |
| `serviceLocation.address` | `_mrc_service_address` | string |
| `serviceLocation.city` | `_mrc_service_city` | string |
| `serviceLocation.state` | `_mrc_service_state` | string |
| `serviceLocation.zip` | `_mrc_service_zip` | string |
| `serviceLocation.lat` | `_mrc_service_lat` | decimal number |
| `serviceLocation.lng` | `_mrc_service_lng` | decimal number |
| `dropOff.address` | `_mrc_dropoff_address` | string |
| `dropOff.city` | `_mrc_dropoff_city` | string |
| `dropOff.state` | `_mrc_dropoff_state` | string |
| `dropOff.zip` | `_mrc_dropoff_zip` | string |
| `dropOff.lat` | `_mrc_dropoff_lat` | decimal number |
| `dropOff.lng` | `_mrc_dropoff_lng` | decimal number |
| `additional.passengers` | `_mrc_passengers` | allowed enum string |
| `additional.driveType` | `_mrc_drive_type` | allowed enum string |
| `additional.withVehicle` | `_mrc_with_vehicle` | boolean |

Drop-off meta is stored only when `serviceType` is `towing`. Account name and
membership ID are stored only when `isMember` is true.

## REST API contract

### Authentication

Every endpoint requires a valid JWT that resolves to a WordPress user.
The permission callback rejects anonymous or expired tokens with HTTP `401`.
Being logged in is sufficient to create a request; no request-editing
capability is granted to members.

### Ticket submission

`POST /wp-json/myroadclub/v1/ticket-requests`

Content type: `multipart/form-data`

- `payload`: JSON string containing all ticket fields except attachment
  metadata;
- `attachments[]`: zero to ten uploaded files.

Allowed file types are JPEG, PNG, and PDF. The plugin verifies file content
using WordPress file-type checks rather than trusting the browser MIME type.
Each file may be at most 10 MB and the combined files may be at most 50 MB.
The app file picker is narrowed to the same formats.

Before creating anything, the endpoint validates the payload and all file
limits. After post creation it uploads files with the WordPress media APIs,
sets the request as their parent, and saves their IDs. If any upload or save
fails, newly uploaded media and the incomplete request are deleted.

### Roadside submission

`POST /wp-json/myroadclub/v1/roadside-requests`

Content type: `application/json`

The body is the current nested roadside payload without `submittedAt`.

### Success response

Both endpoints return HTTP `201`:

```json
{
  "id": 123,
  "reference": "RA-20260717-123",
  "status": "pending",
  "createdAt": "2026-07-17T09:00:00Z"
}
```

The application displays the reference in its success message.

### Error responses

Errors use normal WordPress REST error objects with a stable error code and an
appropriate status:

- `401` for missing or expired JWT;
- `413` for excessive file count or size;
- `422` for invalid or missing form fields;
- `500` for unexpected persistence or media failures.

No internal paths, SQL details, or stack traces are returned to the browser.

## Validation

The server repeats all important client validation.

Ticket requests require first name, last name, and phone. Roadside requests
require a recognized service type, first name, last name, and phone.

Allowed roadside service types are `jump-start`, `flat-tire`, `fuel`,
`lockout`, `winch`, `towing`, `battery`, and `other`. Passenger count and drive
type are constrained to the options currently rendered by the form. Dates,
email addresses, coordinates, booleans, and text lengths are validated and
sanitized before storage.

## WordPress Admin experience

Each request type has its own admin menu. List screens show reference,
requester, phone, service or violation type, status, and submission date.

The request screen presents grouped, read-only details. Coordinates include a
Google Maps link. Ticket attachments link to Media Library files. An
administrator can use standard WordPress status controls to process a pending
request.

Email notifications and dispatch workflow automation are outside this
feature's scope.

## CORS and server requirements

The request namespace accepts browser requests only from:

- `https://app.myroadclub.com`;
- a configurable local development origin.

Preflight responses allow `Authorization` and `Content-Type`. Authentication,
not CORS, remains the security boundary.

WordPress/PHP and the reverse proxy must allow at least ten files and a request
body greater than 50 MB. Deployment documentation will identify the settings
to verify: `upload_max_filesize`, `post_max_size`, `max_file_uploads`, and the
Nginx `client_max_body_size`.

`NEXT_PUBLIC_WORDPRESS_URL=https://myroadclub.com` is added to build-time
environment configuration. No privileged WordPress credential is shipped in
the static app.

## Application behavior

While a request is in flight, its submit button remains disabled. Success is
shown only after an HTTP `201`, and includes the server reference. Failure
keeps all entered fields and selected files so the user can retry.

For an authentication error, the app explains that the session expired and
does not claim the request was received. Network, validation, and file-size
errors receive distinct actionable messages.

The shared request client also normalizes token retrieval across the existing
local-storage and session-storage login modes.

## Verification

### WordPress

- Anonymous and invalid-token submissions return `401`.
- A valid member can create both request types but cannot administer them.
- Meta values are sanitized and conditional fields are stored correctly.
- Valid ticket files appear in Media Library and are linked to the request.
- Invalid MIME types, too many files, and oversized files are rejected.
- A forced upload failure leaves no incomplete post or orphaned new media.
- Admin list and request-detail screens display the saved information.

### Application

- Lint and static production build pass.
- Each form shows loading, success, and error states correctly.
- Success is never shown for non-`201` responses.
- Retrying after a network failure preserves the form and attachments.
- Production and local-development CORS preflights succeed.
- End-to-end submissions create matching WordPress records under the
  authenticated user's ID.

## Deployment sequence

1. Install and activate the WordPress plugin.
2. Verify PHP/Nginx upload limits and JWT authorization forwarding.
3. Test both endpoints with an authenticated non-admin member.
4. Add `NEXT_PUBLIC_WORDPRESS_URL` to the application's production build
   environment.
5. Build and deploy the static application.
6. Run end-to-end submissions and verify records and media in WordPress Admin.

The WordPress endpoint is deployed before the app change so the production
form never points at a missing API.
