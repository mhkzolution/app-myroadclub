# VPS Deployment Design

## Goal

Deploy the existing MyRoadClub Next.js application to a fresh Ubuntu 24.04 VPS at `64.225.43.219`, serve it from `https://app.myroadclub.com`, and make future deployments repeatable from the developer's Mac.

## Current Application

- Next.js 14.2 configured with `output: "export"` and `trailingSlash: true`.
- `npm run build` produces a static site in `out/`.
- The production VPS does not need Node.js or a long-running application process.
- Public build-time configuration:
  - `NEXT_PUBLIC_ROADSIDE_PHONE`
  - `NEXT_PUBLIC_SITE_URL`
- Roadside and ticket forms currently validate in the browser but do not submit to a production backend. Binary attachments are not uploaded.

## Chosen Architecture

Nginx will serve static files from:

`/var/www/app.myroadclub.com/current`

The `current` path will be a symbolic link to a timestamped directory under:

`/var/www/app.myroadclub.com/releases/`

The Mac will build the application and upload `out/` with `rsync`. After a complete upload, deployment will atomically switch the `current` link to the new release. Nginx will remain running throughout deployment.

DNS will contain an A record:

- Host: `app`
- Value: `64.225.43.219`

Certbot will obtain and renew a Let's Encrypt certificate for
`app.myroadclub.com`. Its versioned deploy hook validates Nginx before reload.
Nginx will redirect HTTP traffic to HTTPS.

## Server Bootstrap

The initial server setup will:

1. Install Ubuntu security updates and reboot if required.
2. Verify SSH key access before changing SSH authentication settings.
3. Install Nginx, UFW, Certbot, and its Nginx integration.
4. Allow only OpenSSH, HTTP, and HTTPS through UFW.
5. Create a non-root `deploy` user that owns the release directory and accepts SSH key authentication.
6. Add and validate the Nginx virtual host.
7. Obtain the TLS certificate after DNS resolves to the VPS.

If the previously reported login address `162.243.190.66` is not recognized by the server owner, server credentials must be rotated and access logs reviewed before deployment.

## Deployment Flow

1. Load the production public environment variables on the Mac.
2. Install locked dependencies with `npm ci`.
3. Run lint and the production build.
4. Acquire an owner-token deployment lock before reading the current release.
5. Create a timestamped release directory on the VPS.
6. Upload the contents of `out/` into the new release with `rsync`.
7. Verify that required files, including `index.html`, exist.
8. Atomically point `current` to the new release.
9. Test the public HTTPS endpoint with bounded connect and total timeouts.
10. Retain the five most recent timestamped releases.
11. Release the lock only after verifying its owner token.

Build or upload failures occur before the symlink switch and therefore leave
the live release unchanged. Signals and all failures after activation but
before completion restore the validated previous release when `current` still
points to that deployment's release. Owner checks prevent one deployment from
releasing another deployment's lock or rolling back another release.

## Rollback

Rollback consists of repointing `current` to the preceding release and rechecking the public endpoint. Static assets and HTML remain paired because each build is stored in a separate release directory.

## Nginx Behavior

- Serve static files from the `current` symlink.
- Use `try_files` behavior compatible with exported routes and trailing-slash directories.
- Return the site's custom static files when they exist; do not proxy to a Node process.
- Apply HTTPS and basic security headers.
- Send HSTS for this HTTPS-only hostname without extending it to subdomains.
- Cache fingerprinted `/_next/static/` assets for a long period while keeping HTML caching conservative.
- Serve the exported `404.html` for missing routes when available.

## Failure Handling

- `npm ci`, lint, or build failure: stop before upload.
- Lock contention: stop before reading `current` or starting the local build.
- Upload failure: do not switch `current`; remove the incomplete release.
- Invalid Nginx configuration: `nginx -t` must pass before reload.
- DNS not propagated: delay certificate issuance; the site may be tested by HTTP/IP only during bootstrap.
- Certificate issuance failure: leave HTTP configuration valid, diagnose DNS/firewall, then retry Certbot.
- Failed health check, signal, or other post-activation failure: owner-check
  the lock, switch `current` back only if it still targets this deployment,
  and remove the failed release.

## Verification

Initial setup verification:

- DNS resolves `app.myroadclub.com` to `64.225.43.219`.
- UFW exposes only ports 22, 80, and 443.
- `nginx -t` succeeds.
- HTTP redirects to HTTPS.
- The TLS certificate is valid for `app.myroadclub.com`.
- Certbot renewal dry-run succeeds.

Release verification:

- Lint and production build pass locally.
- Home, login, and protected static routes load directly and after refresh.
- Static assets return successful responses.
- The account panel, tabs, GPS controls, map links, and phone link render with production configuration.
- A previous release can be restored by switching the symlink.

## Non-Goals

- Adding a backend, database, authentication service, or attachment storage.
- Running Next.js with `next start`, PM2, or Docker.
- CI/CD from GitHub or GitLab.
- Mobile Android package deployment.

