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
LOCK_DIR="${REMOTE_ROOT}/.deploy-lock"
LOCK_OWNER="${LOCK_DIR}/owner"
LOCK_TOKEN="${RELEASE_ID}"

LOCK_ACQUIRED=false
DEPLOYMENT_COMPLETE=false
PREVIOUS_RELEASE=""

cleanup_on_exit() {
  local status=$?
  trap - EXIT HUP INT TERM

  if [[ "${LOCK_ACQUIRED}" == true ]]; then
    local remote_cleanup
    if [[ "${DEPLOYMENT_COMPLETE}" == true ]]; then
      remote_cleanup="
       owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
       if [ \"\${owner}\" != '${LOCK_TOKEN}' ]; then
         exit 0
       fi
       cleanup_ok=true
       rm -f -- '${CURRENT_TEMP}' '${ROLLBACK_TEMP}' || cleanup_ok=false
       if [ \"\${cleanup_ok}\" = true ]; then
         rm -f -- '${LOCK_OWNER}' &&
           rmdir -- '${LOCK_DIR}'
       else
         exit 1
       fi"
    else
      local rollback_commands=""
      if [[ -n "${PREVIOUS_RELEASE}" ]]; then
        rollback_commands="
        if [ \"\${current_target}\" = '${REMOTE_RELEASE}' ]; then
          rm -f -- '${ROLLBACK_TEMP}'
          if ln -s '${PREVIOUS_RELEASE}' '${ROLLBACK_TEMP}' &&
             mv -Tf '${ROLLBACK_TEMP}' '${REMOTE_ROOT}/current'; then
            current_target='${PREVIOUS_RELEASE}'
          else
            cleanup_ok=false
          fi
        fi"
      fi

      remote_cleanup="
       owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
       if [ \"\${owner}\" != '${LOCK_TOKEN}' ]; then
         exit 0
       fi
       cleanup_ok=true
       current_target=\"\$(readlink -f '${REMOTE_ROOT}/current' 2>/dev/null || true)\"
       ${rollback_commands}
       if [ \"\${current_target}\" != '${REMOTE_RELEASE}' ]; then
         rm -rf -- '${REMOTE_RELEASE}' || cleanup_ok=false
       fi
       rm -f -- '${CURRENT_TEMP}' '${ROLLBACK_TEMP}' || cleanup_ok=false
       if [ \"\${cleanup_ok}\" = true ]; then
         rm -f -- '${LOCK_OWNER}' &&
           rmdir -- '${LOCK_DIR}'
       else
         exit 1
       fi"
    fi

    if ! ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" "${remote_cleanup}" >/dev/null 2>&1; then
      if [[ "${DEPLOYMENT_COMPLETE}" == true ]]; then
        echo "Healthy release remains active; final cleanup did not finish and the owner lock may still be held." >&2
      else
        echo "Deployment cleanup did not complete; the owner lock was retained for safe recovery." >&2
      fi
    fi
  fi

  exit "${status}"
}
trap cleanup_on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

LOCK_ACQUIRED=true
if ! ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "if mkdir '${LOCK_DIR}' 2>/dev/null; then
     trap 'owner=\$(cat \"${LOCK_OWNER}\" 2>/dev/null || true); if [ -z \"\${owner}\" ] || [ \"\${owner}\" = \"${LOCK_TOKEN}\" ]; then rm -f -- \"${LOCK_OWNER}\"; rmdir -- \"${LOCK_DIR}\" 2>/dev/null || true; fi' EXIT HUP INT TERM
     if ! printf '%s\n' '${LOCK_TOKEN}' >'${LOCK_OWNER}'; then
       exit 1
     fi
     trap - EXIT HUP INT TERM
   else
     owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || printf '%s' unknown)\"
     printf 'Deployment lock is held by %s\n' \"\${owner}\" >&2
     exit 75
   fi"; then
  echo "Unable to acquire the remote deployment lock." >&2
  exit 1
fi

if ! PREVIOUS_RELEASE="$(
  ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
    "owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
     [ \"\${owner}\" = '${LOCK_TOKEN}' ] &&
       readlink -f '${REMOTE_ROOT}/current'" 2>/dev/null
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

npm ci
npm run lint
npm run build
test -f out/index.html
test -f out/404.html

ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
   [ \"\${owner}\" = '${LOCK_TOKEN}' ] &&
     mkdir -p '${REMOTE_RELEASE}'"
rsync -az --delete --checksum -e "${RSYNC_RSH}" \
  out/ "${SSH_TARGET}:${REMOTE_RELEASE}/"
ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
   [ \"\${owner}\" = '${LOCK_TOKEN}' ] &&
     test -f '${REMOTE_RELEASE}/index.html' &&
     test -f '${REMOTE_RELEASE}/404.html'"

ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
   current_target=\"\$(readlink -f '${REMOTE_ROOT}/current' 2>/dev/null || true)\"
   [ \"\${owner}\" = '${LOCK_TOKEN}' ] &&
     [ \"\${current_target}\" = '${PREVIOUS_RELEASE}' ] &&
     rm -f -- '${CURRENT_TEMP}' &&
     ln -s '${REMOTE_RELEASE}' '${CURRENT_TEMP}' &&
     mv -Tf '${CURRENT_TEMP}' '${REMOTE_ROOT}/current'"

if ! curl --fail --silent --show-error --retry 5 --retry-delay 2 \
  --connect-timeout 10 --max-time 30 "https://${DOMAIN}/" >/dev/null; then
  echo "Health check failed. Restoring the previous release." >&2
  exit 1
fi

# Health passed: never roll back or delete this active release from EXIT cleanup.
DEPLOYMENT_COMPLETE=true

ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
   [ \"\${owner}\" = '${LOCK_TOKEN}' ] &&
   cd '${RELEASES_ROOT}' &&
   find . -mindepth 1 -maxdepth 1 -type d -printf '%f\n' |
   LC_ALL=C sort -r |
   awk '/^[0-9]{14}-[0-9]+$/ { count++; if (count > ${KEEP_RELEASES}) print }' |
   while IFS= read -r release; do rm -rf -- \"./\${release}\"; done"

ssh "${SSH_OPTIONS[@]}" "${SSH_TARGET}" \
  "owner=\"\$(cat '${LOCK_OWNER}' 2>/dev/null || true)\"
   [ \"\${owner}\" = '${LOCK_TOKEN}' ] &&
     rm -f -- '${LOCK_OWNER}' &&
     rmdir -- '${LOCK_DIR}'"
LOCK_ACQUIRED=false

echo "Deployed release ${RELEASE_ID} to https://${DOMAIN}/"
