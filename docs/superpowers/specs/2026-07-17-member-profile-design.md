# Member Profile and Form Autofill Design

## Goal

Use the authenticated WordPress member record as the source for contact
information, prefill both request forms without overwriting member-entered
values, and let members update their own profile inside the static app.

## WordPress API

The existing `myroadclub-requests` plugin adds:

- `GET /wp-json/myroadclub/v1/member-profile`
- `PATCH /wp-json/myroadclub/v1/member-profile`

Both routes require the existing JWT and resolve only the current WordPress
user. Members cannot select or modify another user.

The response contract is:

```json
{
  "id": 123,
  "username": "member-login",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "displayName": "Ada Lovelace",
  "email": "ada@example.com",
  "phone": "+15550100",
  "membershipId": "MRC-1001"
}
```

`username` and `membershipId` are read-only. Members may update `firstName`,
`lastName`, `displayName`, `email`, and `phone`.

WordPress core owns first name, last name, display name, and email. Phone is
stored canonically as `mrc_phone`; reads fall back to existing
`billing_phone` and `phone` user meta so current member records are useful
without migration. When `billing_phone` already exists, profile updates keep
it synchronized. Membership ID reads, in order, from `mrc_membership_id`,
`membership_id`, and `membership_number`, but is never member-editable.

The server validates required names, display name, email format/uniqueness,
phone length, and text limits. It returns `401`, `422`, or `500` without
exposing internal details.

## Application profile client

`lib/wp-profile.ts` owns the profile type, authenticated GET/PATCH calls,
safe error mapping, an in-memory cache, and a browser event announcing profile
updates. It reads JWT through the shared auth helper and uses
`NEXT_PUBLIC_WORDPRESS_URL`.

`useMemberProfile()` loads the cached profile once, listens for updates, and
exposes loading/error/profile state. Failed loads do not block request forms;
their fields remain editable.

## Autofill behavior

The ticket form prefills first name, last name, phone, and email.

The roadside form prefills those fields plus account/display name and
membership ID, and marks the requester as a member.

Autofill applies only to empty fields. If a member types before the request
finishes, their input wins. Navigating away and back after editing the profile
uses the updated cached profile.

## Profile page

`/profile` is moved under the protected route group and uses the same branded
form components as the request screens. It:

- shows username and membership ID as read-only;
- edits first name, last name, display name, email, and phone;
- disables save while submitting;
- shows actionable loading, validation, authentication, network, and server
  messages;
- updates the shared cache only after a confirmed successful WordPress
  response.

The My Account panel links directly to `/profile` and uses the same member
profile data for its greeting.

## Security and deployment

No privileged credentials are added to the app. Profile updates use the
member's browser JWT, and WordPress derives the target user ID from that token.
CORS remains restricted by the existing `/myroadclub/v1/` policy.

The updated plugin must be installed before deploying the updated static app.

## Verification

- Standalone PHP contracts cover profile mapping, fallback meta, validation,
  current-user scoping, and safe update behavior.
- TypeScript contracts cover token requirements, GET/PATCH requests, caching,
  update events, error mapping, and empty-only autofill.
- Plugin tests, TypeScript tests, lint, production build, and whitespace checks
  pass.
- Manual deployment verification confirms GET, PATCH, form autofill, profile
  persistence, and rejection without JWT.
