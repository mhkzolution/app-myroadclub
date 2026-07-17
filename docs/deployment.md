# Deployment

Production is a static Next.js export served by Nginx:

- URL: `https://app.myroadclub.com`
- Server: `64.225.43.219`
- Web root: `/var/www/app.myroadclub.com/current`
- Releases: `/var/www/app.myroadclub.com/releases`
- Nginx site: `/etc/nginx/sites-available/app.myroadclub.com`
- TLS: `/etc/letsencrypt/live/app.myroadclub.com`

## WordPress request API

The static app submits both request forms and reads and updates the current
member profile through the `MyRoadClub Requests` plugin. Deploy and verify the
WordPress plugin before deploying an app build that uses these endpoints.

### Install and activate the plugin

Run these commands from this repository on a host that can write to the
WordPress installation. Replace `/path/to/wordpress` with the actual WordPress
root:

```bash
WP_ROOT=/path/to/wordpress
sudo install -d -o www-data -g www-data \
  "$WP_ROOT/wp-content/plugins/myroadclub-requests"
sudo rsync -a --delete wordpress/myroadclub-requests/ \
  "$WP_ROOT/wp-content/plugins/myroadclub-requests/"
sudo chown -R www-data:www-data \
  "$WP_ROOT/wp-content/plugins/myroadclub-requests"
sudo -u www-data wp --path="$WP_ROOT" plugin activate myroadclub-requests
sudo -u www-data wp --path="$WP_ROOT" plugin status myroadclub-requests
```

If WP-CLI is unavailable, copy the directory to
`wp-content/plugins/myroadclub-requests/`, then open **WordPress Admin >
Plugins > Installed Plugins** and select **Activate** for
**MyRoadClub Requests**. Do not copy a directory containing another nested
`myroadclub-requests/` directory.

The plugin owns the canonical private post types, registered meta schema,
validation, REST persistence, and ticket attachment linkage. Its authenticated
request-submission endpoints are:

- `/wp-json/myroadclub/v1/roadside-requests`
- `/wp-json/myroadclub/v1/ticket-requests`

Requests are saved as pending records authored by the authenticated WordPress
member. The post types are not public, publicly queryable, or exposed through
the standard WordPress REST post routes.

### Member profile endpoint contract

The plugin also exposes the authenticated current-member endpoint:

- `GET /wp-json/myroadclub/v1/member-profile` returns the current profile with
  HTTP `200`.
- `PATCH /wp-json/myroadclub/v1/member-profile` accepts a complete JSON object
  containing `firstName`, `lastName`, `displayName`, `email`, and `phone`, and
  returns the saved profile with HTTP `200`.

Both methods derive the user ID from the member JWT. There is no user-ID route
or request field that can select another account. The successful response
contract is:

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

`username` and `membershipId` are read-only and must not be sent by the app's
PATCH client. First name, last name, display name, and email use WordPress core
user fields. Phone reads `mrc_phone` whenever that canonical key exists;
otherwise it falls back to `billing_phone`, then `phone`. A profile update
writes `mrc_phone` and also synchronizes `billing_phone` when that legacy key
already exists. Membership ID is the first non-empty value from
`mrc_membership_id`, `membership_id`, then `membership_number`; members cannot
update it through this API.

Expect HTTP `401` without a valid JWT, `422` for missing, invalid, too-long, or
non-unique editable values, and `500` for a storage failure. Error messages are
safe for members and do not expose internal WordPress details.

### Configure uploads and PHP-FPM

Ticket uploads accept at most 10 JPEG, PNG, or PDF files, 10 MB per file and
50 MB combined. PHP and Nginx limits must leave room for multipart overhead.
Set the following PHP-FPM values in the applicable `php.ini` or pool override:

```ini
upload_max_filesize = 10M
post_max_size = 64M
max_file_uploads = 10
```

Restart the installed PHP-FPM service (change the service name to the installed
version), then confirm the effective values through the same WordPress/PHP-FPM
runtime:

```bash
WP_ROOT=/path/to/wordpress
PHP_FPM_SERVICE=php8.3-fpm
sudo systemctl restart "$PHP_FPM_SERVICE"
sudo systemctl is-active "$PHP_FPM_SERVICE"
sudo -u www-data wp --path="$WP_ROOT" eval \
  'printf("upload_max_filesize=%s\npost_max_size=%s\nmax_file_uploads=%s\n", ini_get("upload_max_filesize"), ini_get("post_max_size"), ini_get("max_file_uploads"));'
```

### Configure Nginx and Authorization forwarding

In the `server` block for `myroadclub.com`, set the body limit and ensure the
PHP location forwards the bearer token to PHP-FPM:

```nginx
server {
    client_max_body_size 64m;

    location ~ \.php$ {
        # Existing SCRIPT_FILENAME and fastcgi_pass configuration remains here.
        include fastcgi_params;
        fastcgi_param HTTP_AUTHORIZATION $http_authorization;
    }
}
```

If the site uses `include fastcgi.conf` instead, add the
`fastcgi_param HTTP_AUTHORIZATION` line after that include. Check the effective
configuration, test it, and reload:

```bash
sudo nginx -T 2>&1 | grep -n -E \
  'client_max_body_size|HTTP_AUTHORIZATION|fastcgi_pass'
sudo nginx -t
sudo systemctl reload nginx
```

A successful authenticated request in the live checks below is the required
end-to-end proof that Nginx forwards `Authorization`; an unauthenticated `401`
alone does not prove forwarding.

### Verify production CORS and configure a development origin

Production CORS permits only `https://app.myroadclub.com`. When browser testing
from the Next.js development server is required, add exactly the origin in use
to `wp-config.php` above the `/* That's all, stop editing! */` line:

```php
define('MRC_REQUESTS_DEV_ORIGIN', 'http://localhost:3000');
```

Only one development origin is supported. Omit this constant in production
when local browser testing is not needed; never use `*`. Verify the production
origin preflight:

```bash
curl -i -X OPTIONS \
  'https://myroadclub.com/wp-json/myroadclub/v1/roadside-requests' \
  -H 'Origin: https://app.myroadclub.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Authorization, Content-Type'
```

When the development constant is set, verify its preflight separately:

```bash
curl -i -X OPTIONS \
  'https://myroadclub.com/wp-json/myroadclub/v1/roadside-requests' \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Authorization, Content-Type'
```

Expect `Access-Control-Allow-Origin` to equal the requesting allowed origin,
`Access-Control-Allow-Headers: Authorization, Content-Type`,
`Access-Control-Allow-Methods: GET, PATCH, POST, OPTIONS`, and `Vary: Origin`.
Repeat with an unlisted origin and confirm no `Access-Control-Allow-Origin` is
returned.

## Deploy the static app

1. Install, configure, and activate plugin version 1.1.1 or later as described
   above.
2. Verify the request endpoints and both member-profile methods, including an
   authenticated GET and PATCH, before deploying the dependent static app.
3. Confirm the protected routes reject requests without a token with HTTP
   `401`.
4. Set the production build values in `.env.production.local`:

   ```dotenv
   NEXT_PUBLIC_WORDPRESS_URL=https://myroadclub.com
   ```

5. Verify app-server access with `ssh deploy@64.225.43.219`.
6. Run:

   ```bash
   SSH_TARGET=deploy@64.225.43.219 ./scripts/deploy-static.sh
   ```

The script acquires an owner-checked remote lock before reading `current`,
builds locally, uploads a timestamped release, atomically switches the symlink,
checks HTTPS with bounded timeouts, rolls back on any failure before completion,
and retains the five newest timestamped releases.

`NEXT_PUBLIC_WORDPRESS_URL` is embedded in the static JavaScript at build time,
so changing it requires rebuilding and redeploying the app.

## Verify authenticated request submission

Obtain a JWT for a normal test member from the existing
`/wp-json/jwt-auth/v1/token` endpoint. The recipe below requires Bash, `curl`,
and PHP CLI. It prompts for both values without echo, passes credentials through
pipes rather than command arguments, extracts only the JSON `.token` value,
fails if the request or extraction fails, and never prints the password or
token. Run it without shell tracing (`set -x`) and do not paste credentials into
source control, shell history, or logs:

```bash
get_wp_token() {
  local WP_USER WP_PASS AUTH_RESPONSE

  command -v curl >/dev/null || {
    printf 'curl is required.\n' >&2
    return 1
  }
  command -v php >/dev/null || {
    printf 'PHP CLI is required for safe JSON encoding and token extraction.\n' >&2
    return 1
  }

  read -rsp 'Normal member username: ' WP_USER
  printf '\n'
  read -rsp 'Normal member password: ' WP_PASS
  printf '\n'

  unset WP_TOKEN
  if ! AUTH_RESPONSE="$(
    printf '%s\0%s\0' "$WP_USER" "$WP_PASS" |
      php -r '
        $raw = stream_get_contents(STDIN);
        $parts = explode("\0", $raw, 3);
        if (count($parts) < 2) {
            exit(1);
        }
        echo json_encode(
            array("username" => $parts[0], "password" => $parts[1]),
            JSON_THROW_ON_ERROR
        );
      ' |
      curl --fail-with-body --silent --show-error \
        -X POST 'https://myroadclub.com/wp-json/jwt-auth/v1/token' \
        -H 'Content-Type: application/json' \
        --data-binary @-
  )"; then
    unset WP_PASS WP_USER AUTH_RESPONSE
    printf 'JWT request failed.\n' >&2
    return 1
  fi
  unset WP_PASS

  if ! WP_TOKEN="$(
    printf '%s' "$AUTH_RESPONSE" |
      php -r '
        $data = json_decode(stream_get_contents(STDIN), true);
        if (
            ! is_array($data) ||
            ! isset($data["token"]) ||
            ! is_string($data["token"]) ||
            "" === $data["token"]
        ) {
            exit(1);
        }
        echo $data["token"];
      '
  )"; then
    unset WP_USER AUTH_RESPONSE WP_TOKEN
    printf 'JWT response did not contain a non-empty token.\n' >&2
    return 1
  fi

  unset WP_USER AUTH_RESPONSE
  export WP_TOKEN
}

if ! get_wp_token; then
  unset -f get_wp_token
  false
else
  unset -f get_wp_token
  export TEST_JPEG='/absolute/path/to/test.jpg'
  export TEST_PDF='/absolute/path/to/test.pdf'
  export INVALID_FILE='/absolute/path/to/test.txt'
fi
```

### Verify the member profile API

Use the normal member token obtained above. Keep shell tracing disabled. The
helper supplies the bearer header through an ephemeral curl configuration, so
the JWT is not copied into command history or a curl command-line argument:

```bash
set +x
wp_member_curl() {
  curl --config <(
    printf 'header = "Authorization: Bearer %s"\n' "$WP_TOKEN"
  ) "$@"
}

PROFILE_BEFORE="$(
  wp_member_curl --fail-with-body --silent --show-error \
    'https://myroadclub.com/wp-json/myroadclub/v1/member-profile'
)" || {
  printf 'Profile GET failed.\n' >&2
  unset WP_TOKEN
  return 1 2>/dev/null || exit 1
}

PATCH_BODY="$(
  printf '%s' "$PROFILE_BEFORE" |
    php -r '
      $profile = json_decode(stream_get_contents(STDIN), true);
      $keys = array("firstName", "lastName", "displayName", "email", "phone");
      if (!is_array($profile)) {
          exit(1);
      }
      $patch = array();
      foreach ($keys as $key) {
          if (!array_key_exists($key, $profile) || !is_string($profile[$key])) {
              exit(1);
          }
          $patch[$key] = $profile[$key];
      }
      echo json_encode($patch, JSON_THROW_ON_ERROR);
    '
)" || {
  printf 'Profile GET response did not match the editable contract.\n' >&2
  unset WP_TOKEN PROFILE_BEFORE
  return 1 2>/dev/null || exit 1
}

PROFILE_AFTER="$(
  printf '%s' "$PATCH_BODY" |
    wp_member_curl --fail-with-body --silent --show-error \
      -X PATCH \
      'https://myroadclub.com/wp-json/myroadclub/v1/member-profile' \
      -H 'Content-Type: application/json' \
      --data-binary @-
)" || {
  printf 'Profile PATCH failed.\n' >&2
  unset WP_TOKEN PROFILE_BEFORE PATCH_BODY
  return 1 2>/dev/null || exit 1
}

printf '%s\0%s\0' "$PROFILE_BEFORE" "$PROFILE_AFTER" |
  php -r '
    $parts = explode("\0", stream_get_contents(STDIN));
    $required = array(
        "id", "username", "firstName", "lastName", "displayName",
        "email", "phone", "membershipId"
    );
    foreach (array_slice($parts, 0, 2) as $json) {
        $profile = json_decode($json, true);
        if (!is_array($profile) || array_keys($profile) !== $required) {
            fwrite(STDERR, "Unexpected profile response contract.\n");
            exit(1);
        }
    }
    echo "Profile GET/PATCH contract verified.\n";
  '

unset PROFILE_BEFORE PROFILE_AFTER PATCH_BODY
unset -f wp_member_curl
```

This PATCH writes the member's existing editable values back unchanged, making
it safe for a production test account while still verifying authentication,
JSON handling, current-user scoping, and persistence. Do not print `WP_TOKEN`;
run `unset WP_TOKEN` after completing all authenticated checks.

Confirm rejection without credentials separately:

```bash
curl -i \
  'https://myroadclub.com/wp-json/myroadclub/v1/member-profile'

curl -i -X PATCH \
  'https://myroadclub.com/wp-json/myroadclub/v1/member-profile' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

Both responses must be HTTP `401`.

Verify roadside persistence and Authorization forwarding:

```bash
curl -i -X POST \
  'https://myroadclub.com/wp-json/myroadclub/v1/roadside-requests' \
  -H "Authorization: Bearer $WP_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"serviceType":"jump-start","serviceDetails":"Test request","customer":{"firstName":"Test","lastName":"Member","phone":"+15550100","email":"","isMember":true,"accountName":"","membershipId":""},"vehicle":{"year":"","make":"","model":"","color":"","vin":"","plate":"","safeLocation":true},"serviceLocation":{"address":"","city":"","state":"","zip":""},"dropOff":null,"additional":{"passengers":"1","driveType":"","withVehicle":true}}'
```

Expect HTTP `201`, a `pending` response, and an `RA-...` reference. In
WordPress Admin, confirm the pending Roadside Request is authored by the test
member. Confirm its front-end permalink is not public and that no standard
`wp/v2` route exposes the request post type.

Verify ticket persistence and Media Library attachment linkage using actual
JPEG and PDF fixtures:

```bash
curl -i -X POST \
  'https://myroadclub.com/wp-json/myroadclub/v1/ticket-requests' \
  -H "Authorization: Bearer $WP_TOKEN" \
  -F 'payload={"citationNumber":"TEST-001","violationDate":"","state":"","city":"","violationType":"","description":"Test ticket request","courtDate":"","firstName":"Test","lastName":"Member","phone":"+15550100","email":""}' \
  -F "attachments[]=@${TEST_JPEG};type=image/jpeg" \
  -F "attachments[]=@${TEST_PDF};type=application/pdf"
```

Expect HTTP `201`, a `pending` response, and a `TK-...` reference. In WordPress
Admin, confirm the pending Ticket Request is authored by the member and both
files appear as linked Media Library attachments.

Verify authentication and file validation failures:

```bash
curl -i -X POST \
  'https://myroadclub.com/wp-json/myroadclub/v1/roadside-requests' \
  -H 'Content-Type: application/json' \
  --data '{}'

curl -i -X POST \
  'https://myroadclub.com/wp-json/myroadclub/v1/ticket-requests' \
  -H "Authorization: Bearer $WP_TOKEN" \
  -F 'payload={"citationNumber":"","violationDate":"","state":"","city":"","violationType":"","description":"","courtDate":"","firstName":"Test","lastName":"Member","phone":"+15550100","email":""}' \
  -F "attachments[]=@${INVALID_FILE};type=text/plain"
```

Expect HTTP `401` without a token and HTTP `422` for the invalid file.

## Verify member profile and autofill in the app

After the plugin checks pass and the new static release is active:

1. Sign in as the same normal test member and open `/profile`.
2. Confirm username and membership ID are visible but read-only, while first
   name, last name, display name, email, and phone are editable.
3. Change an editable value, save, reload `/profile`, and confirm the saved
   value persists. Restore the test value afterward if required.
4. Open **Got a ticket?** and confirm empty first name, last name, phone, and
   email fields are prefilled from the profile.
5. Open **Roadside Assistance** and confirm those contact fields plus account
   name and membership ID are prefilled and **Member?** is selected.
6. Type into an empty request field before a delayed profile response can fill
   it, or edit a prefilled field, and confirm member-entered text is not
   overwritten. Navigate away and back after a successful profile save and
   confirm a newly mounted form uses the updated profile.
7. Sign out and confirm `/profile` is protected and profile requests without a
   JWT fail without exposing profile data.

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

If the request API must be rolled back, first switch the static app to a
release that does not depend on the incompatible plugin version. Back up the
database and `wp-content/uploads`, replace the plugin directory with the
previous known-good version, then activate and repeat all API checks:

```bash
WP_ROOT=/path/to/wordpress
sudo -u www-data wp --path="$WP_ROOT" plugin deactivate myroadclub-requests
# Restore the previous known-good myroadclub-requests directory here.
sudo -u www-data wp --path="$WP_ROOT" plugin activate myroadclub-requests
```

For an emergency shutdown after the app has been rolled back:

```bash
WP_ROOT=/path/to/wordpress
sudo -u www-data wp --path="$WP_ROOT" plugin deactivate myroadclub-requests
```

Deactivation does not delete stored request posts, meta, or Media Library
items, but their admin menus and request endpoints are unavailable until the
plugin is reactivated. Do not delete data or the plugin directory until a
backup and rollback decision are confirmed.

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
NEXT_PUBLIC_WORDPRESS_URL=https://myroadclub.com
```

These values are embedded at build time. The local production environment file
is ignored by Git.
