# Deployment

Production is a static Next.js export served by Nginx:

- URL: `https://app.myroadclub.com`
- Server: `64.225.43.219`
- Web root: `/var/www/app.myroadclub.com/current`
- Releases: `/var/www/app.myroadclub.com/releases`
- Nginx site: `/etc/nginx/sites-available/app.myroadclub.com`
- TLS: `/etc/letsencrypt/live/app.myroadclub.com`

## Deploy

1. Set production values in `.env.production.local`.
2. Verify access with `ssh deploy@64.225.43.219`.
3. Run:

   ```bash
   SSH_TARGET=deploy@64.225.43.219 ./scripts/deploy-static.sh
   ```

The script acquires an owner-checked remote lock before reading `current`,
builds locally, uploads a timestamped release, atomically switches the symlink,
checks HTTPS with bounded timeouts, rolls back on any failure before completion,
and retains the five newest timestamped releases.

## Rollback

List releases:

```bash
ssh deploy@64.225.43.219 \
  'readlink -f /var/www/app.myroadclub.com/current; ls -1dt /var/www/app.myroadclub.com/releases/*/'
```

Set the exact release directory name shown by the listing, validate it locally
and remotely, and atomically switch `current` while holding the deployment lock:

```bash
ROLLBACK_RELEASE_ID=20260717123456-12345
[[ "${ROLLBACK_RELEASE_ID}" =~ ^[0-9]{14}-[0-9]+$ ]]
ssh deploy@64.225.43.219 "
  set -eu
  root='/var/www/app.myroadclub.com'
  target=\"\${root}/releases/${ROLLBACK_RELEASE_ID}\"
  lock=\"\${root}/.deploy-lock\"
  token='manual-rollback-${ROLLBACK_RELEASE_ID}'
  if ! mkdir \"\${lock}\" 2>/dev/null; then
    echo 'A deployment or rollback is already in progress.' >&2
    exit 75
  fi
  trap 'owner=\$(cat \"\${lock}/owner\" 2>/dev/null || true); if [ -z \"\${owner}\" ] || [ \"\${owner}\" = \"\${token}\" ]; then rm -f -- \"\${lock}/owner\"; rmdir -- \"\${lock}\"; fi' EXIT HUP INT TERM
  printf '%s\n' \"\${token}\" >\"\${lock}/owner\"
  resolved=\"\$(readlink -f \"\${target}\")\"
  [ \"\${resolved}\" = \"\${target}\" ]
  [ -f \"\${target}/index.html\" ]
  temp=\"\${root}/.rollback-${ROLLBACK_RELEASE_ID}\"
  rm -f -- \"\${temp}\"
  ln -s \"\${target}\" \"\${temp}\"
  mv -Tf \"\${temp}\" \"\${root}/current\"
"
curl --fail --show-error --connect-timeout 10 --max-time 30 \
  https://app.myroadclub.com/ >/dev/null
```

## Certificate renewal hook

Install the versioned Certbot deploy hook at Certbot's standard deploy-hook
path. It validates Nginx before reloading:

```bash
sudo install -m 0755 ops/certbot/deploy-hooks/reload-nginx.sh \
  /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo bash -n /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

## Current public configuration

```dotenv
NEXT_PUBLIC_ROADSIDE_PHONE=+6654551559
NEXT_PUBLIC_SITE_URL=https://myroadclub.com
```

These values are embedded at build time. The local production environment file
is ignored by Git.
