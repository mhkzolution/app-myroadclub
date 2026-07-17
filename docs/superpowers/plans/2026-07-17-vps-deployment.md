# VPS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the existing static Next.js export at `https://app.myroadclub.com` from Ubuntu VPS `64.225.43.219` with repeatable Mac-to-server deployments and rollback.

**Architecture:** The Mac builds the site into `out/` and uploads immutable timestamped releases with `rsync`. Nginx serves a `current` symlink, while Certbot supplies and renews the TLS certificate. Deployment switches the symlink only after a complete upload.

**Tech Stack:** Next.js 14.2, Bash, rsync, Ubuntu 24.04, Nginx, UFW, Certbot, Let's Encrypt

## Global Constraints

- Production hostname: `app.myroadclub.com`.
- VPS IPv4 address: `64.225.43.219`.
- Static document root: `/var/www/app.myroadclub.com/current`.
- Release root: `/var/www/app.myroadclub.com/releases`.
- Deployment account: non-root user `deploy` with SSH key authentication.
- Retain the five most recent releases.
- The VPS must not run `next start`, PM2, Docker, a database, or an application process.
- `NEXT_PUBLIC_ROADSIDE_PHONE` and `NEXT_PUBLIC_SITE_URL` are build-time values and remain local secrets/configuration.
- Do not disable password authentication until key login has been verified in a separate SSH connection.
- Do not commit unless the user explicitly authorizes a commit.

---

### Task 1: Add Local Deployment Hygiene

**Files:**
- Create: `.gitignore`
- Create: `.eslintrc.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Next.js build outputs and local environment files.
- Produces: ignored local artifacts and documented production public variables.

- [ ] **Step 1: Record the expected ignore behavior**

Run:

```bash
test ! -e .gitignore
```

Expected: exit code `0` before the file is created.

- [ ] **Step 2: Create the non-interactive Next.js ESLint configuration**

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
.next/
out/
.env
.env.*
!.env.example
.DS_Store

android/.gradle/
android/.idea/
android/app/build/
android/build/
```

- [ ] **Step 4: Document production build values in `.env.example`**

```dotenv
# Roadside assistance dispatch phone (E.164 recommended, e.g. +18005551234)
# NEXT_PUBLIC_ROADSIDE_PHONE=+18005551234

# Main site used by public links
NEXT_PUBLIC_SITE_URL=https://myroadclub.com
```

- [ ] **Step 5: Verify ESLint and ignore rules**

Run:

```bash
npm run lint
touch .env.production.local
git check-ignore .env.production.local node_modules .next out
rm .env.production.local
```

Expected: ESLint runs without an interactive prompt and all four ignored paths are printed.

- [ ] **Step 6: Commit only if explicitly authorized**

```bash
git add .gitignore .eslintrc.json .env.example
git commit -m "chore: protect local deployment artifacts"
```

### Task 2: Add Reproducible Nginx Configuration

**Files:**
- Create: `ops/nginx/app.myroadclub.com.bootstrap.conf`
- Create: `ops/nginx/app.myroadclub.com.conf`
- Create: `ops/certbot/deploy-hooks/reload-nginx.sh`

**Interfaces:**
- Consumes: `/var/www/app.myroadclub.com/current` and Let's Encrypt certificate files.
- Produces: an HTTP bootstrap virtual host and the final HTTPS virtual host.

- [ ] **Step 1: Create the HTTP bootstrap configuration**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.myroadclub.com;

    root /var/www/app.myroadclub.com/current;
    index index.html;

    location /.well-known/acme-challenge/ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

- [ ] **Step 2: Create the final HTTPS configuration**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.myroadclub.com;

    location /.well-known/acme-challenge/ {
        root /var/www/app.myroadclub.com/current;
        try_files $uri =404;
    }

    location / {
        return 301 https://app.myroadclub.com$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.myroadclub.com;

    root /var/www/app.myroadclub.com/current;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/app.myroadclub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.myroadclub.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    error_page 404 /404.html;

    location /_next/static/ {
        try_files $uri =404;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location = /404.html {
        internal;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header Cache-Control "no-store" always;
    }

    location / {
        try_files $uri $uri/ =404;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header Cache-Control "no-store" always;
    }
}
```

- [ ] **Step 3: Verify required settings are present**

Run:

```bash
rg 'server_name app\.myroadclub\.com|try_files \$uri \$uri/|ssl_certificate ' ops/nginx
```

Expected: both files contain the hostname and route handling; the final file contains the certificate path.

- [ ] **Step 4: Commit only if explicitly authorized**

```bash
git add ops/nginx
git commit -m "feat: add static site nginx configuration"
```

### Task 3: Add the Locked Atomic Deployment Script

**Files:**
- Create: `scripts/deploy-static.sh`

**Interfaces:**
- Consumes: `SSH_TARGET`, optional `DOMAIN`, `REMOTE_ROOT`, and `KEEP_RELEASES`; local `out/`.
- Produces: a timestamped remote release and updated `current` symlink.

- [ ] **Step 1: Create the deployment script**

The final script must acquire an owner-token remote lock before reading
`current`, keep that lock through build/upload/activation/health/retention,
owner-check every cleanup, and roll back only when `current` still points to
its own new release. HUP, INT, TERM, health failure, and any other
post-activation failure before completion restore the validated previous
release and delete the failed release. The HTTPS check uses both
`--connect-timeout 10` and `--max-time 30`.

> The code block below records the initial draft. The executable
> `scripts/deploy-static.sh` and its mocked tests are the final source of truth;
> do not copy the draft without the locking and owner-checked cleanup above.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${DOMAIN:-app.myroadclub.com}"
SSH_TARGET="${SSH_TARGET:-}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/app.myroadclub.com}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

fail_config() {
  echo "Invalid configuration: $1" >&2
  exit 2
}

[[ "${DOMAIN}" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]] ||
  fail_config "DOMAIN must be a DNS hostname"
[[ "${SSH_TARGET}" =~ ^[A-Za-z_][A-Za-z0-9._-]*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$ ]] ||
  fail_config "SSH_TARGET must be user@hostname with no SSH options"
[[ "${REMOTE_ROOT}" =~ ^(/[A-Za-z0-9._-]+)+$ ]] ||
  fail_config "REMOTE_ROOT must be an absolute path using only safe path characters"
[[ "${KEEP_RELEASES}" =~ ^[1-9][0-9]*$ ]] ||
  fail_config "KEEP_RELEASES must be a positive integer"

SSH_OPTIONS=(
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)
RSYNC_RSH="ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$$"
RELEASES_ROOT="${REMOTE_ROOT}/releases"
REMOTE_RELEASE="${RELEASES_ROOT}/${RELEASE_ID}"
CURRENT_TEMP="${REMOTE_ROOT}/.current-${RELEASE_ID}"
ROLLBACK_TEMP="${REMOTE_ROOT}/.rollback-${RELEASE_ID}"

if ! PREVIOUS_RELEASE="$(
  ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
    "readlink -f '${REMOTE_ROOT}/current'" 2>/dev/null
)"; then
  echo "Unable to determine the current remote release; deployment stopped before build." >&2
  exit 1
fi

if [[ "${PREVIOUS_RELEASE}" != "${RELEASES_ROOT}/"* ]]; then
  echo "Current remote release is missing or outside ${RELEASES_ROOT}; deployment stopped before build." >&2
  exit 1
fi
PREVIOUS_RELEASE_ID="${PREVIOUS_RELEASE#"${RELEASES_ROOT}/"}"
if [[ "${PREVIOUS_RELEASE_ID}" != "bootstrap" &&
      ! "${PREVIOUS_RELEASE_ID}" =~ ^[0-9]{14}-[0-9]+$ ]]; then
  echo "Current remote release has an unsafe name; deployment stopped before build." >&2
  exit 1
fi

ACTIVATED=false
REMOTE_TOUCHED=false
DEPLOYMENT_COMPLETE=false

cleanup_on_exit() {
  local status=$?
  trap - EXIT HUP INT TERM

  if [[ "${REMOTE_TOUCHED}" == true && "${DEPLOYMENT_COMPLETE}" == false ]]; then
    if [[ "${ACTIVATED}" == false ]]; then
      ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
        "current_target=\"\$(readlink -f '${REMOTE_ROOT}/current' 2>/dev/null || true)\"
         if [ \"\${current_target}\" = '${REMOTE_RELEASE}' ]; then
           rm -f -- '${ROLLBACK_TEMP}'
           ln -s '${PREVIOUS_RELEASE}' '${ROLLBACK_TEMP}' &&
             mv -Tf '${ROLLBACK_TEMP}' '${REMOTE_ROOT}/current'
         fi
         if [ \"\$(readlink -f '${REMOTE_ROOT}/current' 2>/dev/null || true)\" != '${REMOTE_RELEASE}' ]; then
           rm -rf -- '${REMOTE_RELEASE}'
         fi
         rm -f -- '${CURRENT_TEMP}' '${ROLLBACK_TEMP}'" \
        >/dev/null 2>&1 || true
    else
      ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
        "rm -f -- '${CURRENT_TEMP}' '${ROLLBACK_TEMP}'" \
        >/dev/null 2>&1 || true
    fi
  fi

  exit "${status}"
}
trap cleanup_on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

npm ci
npm run lint
npm run build
test -f out/index.html

REMOTE_TOUCHED=true
ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" "mkdir -p '${REMOTE_RELEASE}'"
rsync -az --delete --checksum -e "${RSYNC_RSH}" \
  out/ "${SSH_TARGET}:${REMOTE_RELEASE}/"
ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "test -f '${REMOTE_RELEASE}/index.html'"

ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "rm -f -- '${CURRENT_TEMP}' &&
   ln -s '${REMOTE_RELEASE}' '${CURRENT_TEMP}' &&
   mv -Tf '${CURRENT_TEMP}' '${REMOTE_ROOT}/current'"
ACTIVATED=true

if ! curl --fail --silent --show-error --retry 5 --retry-delay 2 \
  "https://${DOMAIN}/" >/dev/null; then
  if ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
    "rm -f -- '${ROLLBACK_TEMP}' &&
     ln -s '${PREVIOUS_RELEASE}' '${ROLLBACK_TEMP}' &&
     mv -Tf '${ROLLBACK_TEMP}' '${REMOTE_ROOT}/current' &&
     rm -rf -- '${REMOTE_RELEASE}' &&
     rm -f -- '${CURRENT_TEMP}' '${ROLLBACK_TEMP}'"; then
    ACTIVATED=false
    REMOTE_TOUCHED=false
    echo "Health check failed. The previous release was restored and the failed release was removed." >&2
  else
    echo "Health check failed, and rollback cleanup did not complete; verify the remote current symlink." >&2
  fi
  exit 1
fi

ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "cd '${RELEASES_ROOT}' &&
   if [ -d './bootstrap' ]; then rm -rf -- './bootstrap'; fi &&
   find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' |
   LC_ALL=C sort -r |
   awk '/^[0-9]{14}-[0-9]+$/ { count++; if (count > ${KEEP_RELEASES}) print }' |
   while IFS= read -r release; do rm -rf -- \"./\${release}\"; done"

DEPLOYMENT_COMPLETE=true
REMOTE_TOUCHED=false
echo "Deployed release ${RELEASE_ID} to https://${DOMAIN}/"
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/deploy-static.sh
```

- [ ] **Step 3: Verify shell syntax**

Run:

```bash
bash -n scripts/deploy-static.sh
```

Expected: exit code `0` with no output.

- [ ] **Step 4: Run syntax and mocked deployment tests**

Run:

```bash
bash -n scripts/deploy-static.sh scripts/tests/deploy-static.test.sh
bash scripts/tests/deploy-static.test.sh
env -u SSH_TARGET ./scripts/deploy-static.sh
```

Expected: syntax succeeds, mocked lock/rollback/retention scenarios pass, and
the final command exits before `npm ci` with
`Invalid configuration: SSH_TARGET must be user@hostname with no SSH options`.

- [ ] **Step 5: Commit only if explicitly authorized**

```bash
git add scripts/deploy-static.sh
git commit -m "feat: add atomic static deployment script"
```

### Task 4: Bootstrap and Harden the Ubuntu Server

**Files:**
- Deploy: `ops/nginx/app.myroadclub.com.bootstrap.conf`

**Interfaces:**
- Consumes: root SSH key access to `64.225.43.219`.
- Produces: patched server, `deploy` account, firewall rules, Nginx, release directories, and HTTP site.

- [ ] **Step 1: Confirm the reported prior login is recognized**

Ask the owner whether `162.243.190.66` was their source IP. If not, stop deployment, rotate provider/root credentials, replace SSH authorized keys, and inspect:

```bash
sudo last -ai
sudo journalctl -u ssh --since "2026-07-17 00:00:00"
```

Expected: the owner confirms known access before continuing.

- [ ] **Step 2: Confirm root key access in a fresh connection**

Run from the Mac:

```bash
ssh root@64.225.43.219 'id && uname -a'
```

Expected: `uid=0(root)` and Ubuntu kernel information.

- [ ] **Step 3: Patch and install packages**

Run:

```bash
ssh root@64.225.43.219 \
  'export DEBIAN_FRONTEND=noninteractive &&
   apt-get update &&
   apt-get -y upgrade &&
   apt-get install -y nginx ufw certbot &&
   systemctl enable --now nginx'
```

Expected: command succeeds. If `/var/run/reboot-required` exists, reboot and reconnect before continuing.

- [ ] **Step 4: Create the deployment account and initial release**

Run:

```bash
ssh root@64.225.43.219 \
  'id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
   install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
   cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
   chown deploy:deploy /home/deploy/.ssh/authorized_keys
   chmod 600 /home/deploy/.ssh/authorized_keys
   install -d -m 755 -o deploy -g deploy /var/www/app.myroadclub.com/releases/bootstrap
   printf "%s\n" "<!doctype html><title>MyRoadClub deployment pending</title>" \
     > /var/www/app.myroadclub.com/releases/bootstrap/index.html
   chown deploy:deploy /var/www/app.myroadclub.com/releases/bootstrap/index.html
   ln -sfn /var/www/app.myroadclub.com/releases/bootstrap /var/www/app.myroadclub.com/current'
```

Expected: `deploy` owns the release tree and `current` resolves to `bootstrap`.

- [ ] **Step 5: Verify deploy-user key access before hardening SSH**

Run from a separate Mac connection:

```bash
ssh deploy@64.225.43.219 'id && readlink -f /var/www/app.myroadclub.com/current'
```

Expected: `uid` is `deploy` and the path ends in `/releases/bootstrap`.

- [ ] **Step 6: Install and validate the bootstrap Nginx site**

Run:

```bash
scp ops/nginx/app.myroadclub.com.bootstrap.conf \
  root@64.225.43.219:/etc/nginx/sites-available/app.myroadclub.com
ssh root@64.225.43.219 \
  'ln -sfn /etc/nginx/sites-available/app.myroadclub.com \
      /etc/nginx/sites-enabled/app.myroadclub.com
   rm -f /etc/nginx/sites-enabled/default
   nginx -t
   systemctl reload nginx'
```

Expected: `syntax is ok` and `test is successful`.

- [ ] **Step 7: Configure and enable the firewall**

Run:

```bash
ssh root@64.225.43.219 \
  'ufw allow OpenSSH &&
   ufw allow "Nginx Full" &&
   ufw --force enable &&
   ufw status verbose'
```

Expected: firewall active with SSH, port 80, and port 443 allowed.

- [ ] **Step 8: Harden SSH after deploy-user key login is verified**

Run:

```bash
ssh root@64.225.43.219 \
  'printf "%s\n" \
     "PasswordAuthentication no" \
     "KbdInteractiveAuthentication no" \
     "PermitRootLogin prohibit-password" \
     > /etc/ssh/sshd_config.d/99-myroadclub-hardening.conf
   sshd -t
   systemctl reload ssh'
```

Expected: `sshd -t` succeeds and a new `ssh deploy@64.225.43.219` connection still works.

### Task 5: Configure DNS and HTTPS

**Files:**
- Deploy: `ops/nginx/app.myroadclub.com.conf`

**Interfaces:**
- Consumes: DNS control for `myroadclub.com`, a certificate email address, and the HTTP bootstrap site.
- Produces: validated TLS and HTTP-to-HTTPS redirect.

- [ ] **Step 1: Configure and verify DNS**

Create the DNS record:

```text
Type: A
Name: app
Value: 64.225.43.219
TTL: 300
```

Verify:

```bash
dig +short app.myroadclub.com A
```

Expected: `64.225.43.219`.

- [ ] **Step 2: Verify the HTTP challenge path is reachable**

Run:

```bash
curl --fail --show-error http://app.myroadclub.com/
```

Expected: response contains `MyRoadClub deployment pending`.

- [ ] **Step 3: Obtain the certificate**

```bash
read -r -p "Let's Encrypt notification email: " CERTBOT_EMAIL
[[ "${CERTBOT_EMAIL}" == *@*.* ]]
ssh root@64.225.43.219 \
  certbot certonly --webroot \
  --webroot-path /var/www/app.myroadclub.com/current \
  --domain app.myroadclub.com \
  --email "${CERTBOT_EMAIL}" \
  --agree-tos --no-eff-email
```

Expected: certificate saved under `/etc/letsencrypt/live/app.myroadclub.com/`.

- [ ] **Step 4: Install and validate the final Nginx site**

Run:

```bash
scp ops/nginx/app.myroadclub.com.conf \
  root@64.225.43.219:/etc/nginx/sites-available/app.myroadclub.com
ssh root@64.225.43.219 \
  'nginx -t && systemctl reload nginx'
```

Expected: Nginx configuration test succeeds.

- [ ] **Step 5: Install the Certbot deploy hook**

```bash
scp ops/certbot/deploy-hooks/reload-nginx.sh root@64.225.43.219:/tmp/reload-nginx.sh
ssh root@64.225.43.219 \
  'install -m 0755 /tmp/reload-nginx.sh \
     /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
   rm -f /tmp/reload-nginx.sh
   bash -n /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh'
```

Expected: the versioned hook is executable and syntax-valid. On renewal it
runs `nginx -t` before reloading Nginx.

- [ ] **Step 6: Verify HTTPS and automatic renewal**

Run:

```bash
curl -I http://app.myroadclub.com/
curl -I https://app.myroadclub.com/
ssh root@64.225.43.219 'certbot renew --dry-run'
```

Expected: HTTP returns `301`, HTTPS returns `200`, and the renewal simulation succeeds.

### Task 6: Perform and Verify the First Production Deployment

**Files:**
- Local-only: `.env.production.local`

**Interfaces:**
- Consumes: production roadside phone number and the configured `deploy` SSH account.
- Produces: live release at `https://app.myroadclub.com`.

- [ ] **Step 1: Create local production configuration**

Prompt for the dispatch phone and create `.env.production.local` without committing it:

```bash
read -r -p "Dispatch phone in E.164 format (example +18005551234): " DISPATCH_PHONE
[[ "${DISPATCH_PHONE}" =~ ^\+[1-9][0-9]{7,14}$ ]]
printf '%s\n' \
  "NEXT_PUBLIC_ROADSIDE_PHONE=${DISPATCH_PHONE}" \
  "NEXT_PUBLIC_SITE_URL=https://myroadclub.com" \
  > .env.production.local
```

- [ ] **Step 2: Run the deployment**

Run:

```bash
SSH_TARGET=deploy@64.225.43.219 ./scripts/deploy-static.sh
```

Expected: output ends with `Deployed release ... to https://app.myroadclub.com/`.

- [ ] **Step 3: Verify exported routes and assets**

Run:

```bash
curl --fail --silent --show-error https://app.myroadclub.com/ >/dev/null
curl --fail --silent --show-error https://app.myroadclub.com/login/ >/dev/null
curl --fail --silent --show-error https://app.myroadclub.com/profile/ >/dev/null
ASSET_PATH="$(rg -o '/_next/static/[^" ]+' out/index.html | awk 'NR == 1 { print; exit }')"
test -n "${ASSET_PATH}"
curl --fail --silent --show-error \
  "https://app.myroadclub.com${ASSET_PATH}" >/dev/null
```

Expected: home, login, profile, and one fingerprinted browser asset return success.

- [ ] **Step 4: Perform browser smoke tests**

Open `https://app.myroadclub.com` and verify:

```text
- TLS lock is valid.
- Direct refresh on /login/ and /profile/ works.
- Account panel and all three tabs open.
- GPS permission flow reports success or a clear browser denial.
- Map and phone links use the intended targets.
- Ticket and roadside forms retain their current client-only behavior.
```

- [ ] **Step 5: Verify rollback without changing the live release**

Run:

```bash
ssh deploy@64.225.43.219 \
  'readlink -f /var/www/app.myroadclub.com/current
   ls -1dt /var/www/app.myroadclub.com/releases/*/'
```

Expected: `current` points to the latest timestamped release and at least the
bootstrap release is available. Use the exact target-validated, lock-protected
atomic rollback command in `docs/deployment.md`; do not interpolate an
unvalidated path into a remote shell command.

```bash
ROLLBACK_RELEASE_ID=20260717123456-12345
[[ "${ROLLBACK_RELEASE_ID}" =~ ^[0-9]{14}-[0-9]+$ ]]
# Then run the owner-locked remote command documented in docs/deployment.md.
```

### Task 7: Update Project Deployment Documentation

**Files:**
- Create: `docs/deployment.md`
- Modify: `.cursor/rules/project-plan.mdc`

**Interfaces:**
- Consumes: the tested deployment commands and production architecture.
- Produces: concise operator instructions and current project notes.

- [ ] **Step 1: Write the operator runbook**

Document:

```markdown
# Deployment

Production is a static Next.js export served by Nginx at
https://app.myroadclub.com.

## Deploy

1. Set production values in `.env.production.local`.
2. Verify SSH access with `ssh deploy@64.225.43.219`.
3. Run:

   `SSH_TARGET=deploy@64.225.43.219 ./scripts/deploy-static.sh`

## Rollback

List releases, then atomically repoint
`/var/www/app.myroadclub.com/current` to the selected previous release.

## Server

- Host: `64.225.43.219`
- Web root: `/var/www/app.myroadclub.com/current`
- Nginx site: `/etc/nginx/sites-available/app.myroadclub.com`
- Certificates: `/etc/letsencrypt/live/app.myroadclub.com`
```

- [ ] **Step 2: Update project notes**

Add a deployment section to `.cursor/rules/project-plan.mdc` containing the production hostname, VPS IP, static Nginx architecture, deploy script path, release root, and five-release retention policy.

- [ ] **Step 3: Run final local verification**

Run:

```bash
bash -n scripts/deploy-static.sh
bash -n ops/certbot/deploy-hooks/reload-nginx.sh
bash scripts/tests/deploy-static.test.sh
npm run lint
npm run build
```

Expected: all commands succeed and `out/index.html` exists.

- [ ] **Step 4: Commit only if explicitly authorized**

```bash
git add .gitignore .env.example ops scripts docs .cursor/rules/project-plan.mdc
git commit -m "feat: add VPS deployment workflow"
```

