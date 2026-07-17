#!/usr/bin/env bash
set -uo pipefail

DEPLOY_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deploy-static.sh"
TESTS_RUN=0
TESTS_FAILED=0

pass() {
  TESTS_RUN=$((TESTS_RUN + 1))
  printf 'ok %d - %s\n' "${TESTS_RUN}" "$1"
}

fail() {
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_FAILED=$((TESTS_FAILED + 1))
  printf 'not ok %d - %s\n' "${TESTS_RUN}" "$1" >&2
}

assert() {
  local description=$1
  shift
  if "$@"; then
    pass "${description}"
  else
    fail "${description}"
  fi
}

new_fixture() {
  FIXTURE="$(cd "$(mktemp -d)" && pwd -P)"
  REMOTE="${FIXTURE}/remote"
  WORK="${FIXTURE}/work"
  MOCK_BIN="${FIXTURE}/bin"
  LOG="${FIXTURE}/calls.log"
  KEEP_RELEASES=5
  MOCK_CURL_MODE=success
  MOCK_RSYNC_FAIL=0
  MOCK_SSH_FAIL_MATCH=""
  MOCK_SSH_FAIL_ONCE=0
  MOCK_SSH_FAIL_ONCE_FILE="${FIXTURE}/ssh-fail-once"
  mkdir -p "${REMOTE}/releases/bootstrap" "${WORK}" "${MOCK_BIN}"
  printf '<!doctype html><title>bootstrap</title>\n' >"${REMOTE}/releases/bootstrap/index.html"
  ln -s "${REMOTE}/releases/bootstrap" "${REMOTE}/current"
  : >"${LOG}"

  cat >"${MOCK_BIN}/npm" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'npm %s\n' "$*" >>"${MOCK_LOG}"
if [[ "${1:-}" == "run" && "${2:-}" == "build" ]]; then
  mkdir -p out
  printf '<!doctype html><title>release</title>\n' >out/index.html
  printf '<!doctype html><title>not found</title>\n' >out/404.html
fi
EOF

  cat >"${MOCK_BIN}/rsync" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'rsync %s\n' "$*" >>"${MOCK_LOG}"
[[ "${MOCK_RSYNC_FAIL:-0}" != 1 ]] || exit 23
source_path="${@: -2:1}"
destination="${@: -1}"
remote_path="${destination#*:}"
mkdir -p "${remote_path}"
cp -R "${source_path%/}/." "${remote_path}/"
EOF

  cat >"${MOCK_BIN}/curl" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'curl %s\n' "$*" >>"${MOCK_LOG}"
case "${MOCK_CURL_MODE:-success}" in
  failure) exit 22 ;;
  signal)
    kill -TERM "${PPID}"
    sleep 1
    ;;
  takeover)
    printf 'replacement-owner\n' >"${REMOTE_ROOT}/.deploy-lock/owner"
    kill -TERM "${PPID}"
    sleep 1
    ;;
esac
EOF

  cat >"${MOCK_BIN}/ssh" <<'EOF'
#!/usr/bin/env bash
set -eu
command="${@: -1}"
printf 'ssh %s\n' "${command}" >>"${MOCK_LOG}"
if [[ -n "${MOCK_SSH_FAIL_MATCH:-}" && "${command}" == *"${MOCK_SSH_FAIL_MATCH}"* ]]; then
  if [[ "${MOCK_SSH_FAIL_ONCE:-0}" == 1 ]]; then
    if [[ -f "${MOCK_SSH_FAIL_ONCE_FILE}" ]]; then
      rm -f -- "${MOCK_SSH_FAIL_ONCE_FILE}"
      exit 255
    fi
  else
    exit 255
  fi
fi
bash -c "${command}"
EOF

  cat >"${MOCK_BIN}/find" <<'EOF'
#!/usr/bin/env bash
set -eu
for path in ./*; do
  [[ -d "${path}" ]] && printf '%s\n' "${path#./}"
done
EOF

  cat >"${MOCK_BIN}/mv" <<'EOF'
#!/usr/bin/env bash
set -eu
if [[ "${1:-}" == "-Tf" ]]; then
  rm -f -- "$3"
  exec /bin/mv -f "$2" "$3"
fi
exec /bin/mv "$@"
EOF

  chmod +x "${MOCK_BIN}/npm" "${MOCK_BIN}/rsync" "${MOCK_BIN}/curl" \
    "${MOCK_BIN}/ssh" "${MOCK_BIN}/find" "${MOCK_BIN}/mv"
}

run_deploy() {
  (
    cd "${WORK}"
    PATH="${MOCK_BIN}:${PATH}" \
      MOCK_LOG="${LOG}" \
      REMOTE_ROOT="${REMOTE}" \
      SSH_TARGET="deploy@example.com" \
      DOMAIN="app.example.com" \
      KEEP_RELEASES="${KEEP_RELEASES:-5}" \
      MOCK_CURL_MODE="${MOCK_CURL_MODE:-success}" \
      MOCK_RSYNC_FAIL="${MOCK_RSYNC_FAIL:-0}" \
      MOCK_SSH_FAIL_MATCH="${MOCK_SSH_FAIL_MATCH:-}" \
      MOCK_SSH_FAIL_ONCE="${MOCK_SSH_FAIL_ONCE:-0}" \
      MOCK_SSH_FAIL_ONCE_FILE="${MOCK_SSH_FAIL_ONCE_FILE:-}" \
      "${DEPLOY_SCRIPT}"
  )
}

current_target() {
  readlink -f "${REMOTE}/current"
}

release_count() {
  local count=0
  local path
  for path in "${REMOTE}"/releases/[0-9]*; do
    [[ -d "${path}" ]] && count=$((count + 1))
  done
  printf '%s\n' "${count}"
}

test_lock_contention() {
  new_fixture
  mkdir "${REMOTE}/.deploy-lock"
  printf 'another-owner\n' >"${REMOTE}/.deploy-lock/owner"
  if run_deploy >"${FIXTURE}/output" 2>&1; then
    fail "lock contention stops deployment"
  elif [[ "$(current_target)" == "${REMOTE}/releases/bootstrap" ]] &&
       [[ "$(cat "${REMOTE}/.deploy-lock/owner")" == "another-owner" ]] &&
       ! grep -q '^npm ' "${LOG}"; then
    pass "lock contention stops deployment"
  else
    fail "lock contention stops deployment"
  fi
  rm -rf "${FIXTURE}"
}

test_success_releases_lock() {
  new_fixture
  if run_deploy >/dev/null 2>&1 &&
     [[ ! -e "${REMOTE}/.deploy-lock" ]] &&
     [[ "$(current_target)" == "${REMOTE}/releases/"* ]]; then
    pass "successful deploy releases its lock"
  else
    fail "successful deploy releases its lock"
  fi
  rm -rf "${FIXTURE}"
}

test_signal_rolls_back() {
  new_fixture
  MOCK_CURL_MODE=signal
  run_deploy >/dev/null 2>&1
  status=$?
  if [[ "${status}" -eq 143 ]] &&
     [[ "$(current_target)" == "${REMOTE}/releases/bootstrap" ]] &&
     [[ ! -e "${REMOTE}/.deploy-lock" ]] &&
     [[ "$(release_count)" -eq 0 ]]; then
    pass "termination after activation rolls back"
  else
    fail "termination after activation rolls back"
  fi
  rm -rf "${FIXTURE}"
}

test_retention_failure_after_health_keeps_release() {
  new_fixture
  MOCK_SSH_FAIL_MATCH="cd '${REMOTE}/releases'"
  MOCK_SSH_FAIL_ONCE=1
  : >"${MOCK_SSH_FAIL_ONCE_FILE}"
  if run_deploy >/dev/null 2>&1; then
    fail "retention failure after health keeps new release"
  else
    local active
    active="$(current_target)"
    if [[ "${active}" == "${REMOTE}/releases/"* ]] &&
       [[ "${active}" != "${REMOTE}/releases/bootstrap" ]] &&
       [[ -d "${active}" ]] &&
       [[ -f "${active}/index.html" ]]; then
      pass "retention failure after health keeps new release"
    else
      fail "retention failure after health keeps new release"
    fi
  fi
  rm -rf "${FIXTURE}"
}

test_unlock_failure_after_health_keeps_release() {
  new_fixture
  MOCK_SSH_FAIL_MATCH="rmdir -- '${REMOTE}/.deploy-lock'"
  MOCK_SSH_FAIL_ONCE=1
  : >"${MOCK_SSH_FAIL_ONCE_FILE}"
  if run_deploy >/dev/null 2>&1; then
    fail "unlock failure after health keeps new release"
  else
    local active
    active="$(current_target)"
    if [[ "${active}" == "${REMOTE}/releases/"* ]] &&
       [[ "${active}" != "${REMOTE}/releases/bootstrap" ]] &&
       [[ -d "${active}" ]] &&
       [[ -f "${active}/index.html" ]]; then
      pass "unlock failure after health keeps new release"
    else
      fail "unlock failure after health keeps new release"
    fi
  fi
  rm -rf "${FIXTURE}"
}

test_owner_change_prevents_foreign_rollback() {
  new_fixture
  MOCK_CURL_MODE=takeover
  run_deploy >/dev/null 2>&1
  status=$?
  if [[ "${status}" -eq 143 ]] &&
     [[ "$(current_target)" == "${REMOTE}/releases/"* ]] &&
     [[ "$(cat "${REMOTE}/.deploy-lock/owner")" == "replacement-owner" ]]; then
    pass "lost ownership cannot roll back another deployment"
  else
    fail "lost ownership cannot roll back another deployment"
  fi
  rm -rf "${FIXTURE}"
}

test_health_failure_rolls_back() {
  new_fixture
  MOCK_CURL_MODE=failure
  if run_deploy >/dev/null 2>&1; then
    fail "health failure restores prior release"
  elif [[ "$(current_target)" == "${REMOTE}/releases/bootstrap" ]] &&
       [[ ! -e "${REMOTE}/.deploy-lock" ]] &&
       [[ "$(release_count)" -eq 0 ]]; then
    pass "health failure restores prior release"
  else
    fail "health failure restores prior release"
  fi
  rm -rf "${FIXTURE}"
}

test_upload_failure_keeps_current() {
  new_fixture
  MOCK_RSYNC_FAIL=1
  if run_deploy >/dev/null 2>&1; then
    fail "upload failure keeps current and removes partial release"
  elif [[ "$(current_target)" == "${REMOTE}/releases/bootstrap" ]] &&
       [[ ! -e "${REMOTE}/.deploy-lock" ]] &&
       [[ "$(release_count)" -eq 0 ]]; then
    pass "upload failure keeps current and removes partial release"
  else
    fail "upload failure keeps current and removes partial release"
  fi
  rm -rf "${FIXTURE}"
}

test_bootstrap_deploy() {
  new_fixture
  if run_deploy >/dev/null 2>&1 &&
     [[ "$(current_target)" == "${REMOTE}/releases/"* ]] &&
     [[ -d "${REMOTE}/releases/bootstrap" ]]; then
    pass "bootstrap release remains available for first-deploy rollback"
  else
    fail "bootstrap release remains available for first-deploy rollback"
  fi
  rm -rf "${FIXTURE}"
}

test_retention() {
  new_fixture
  local i
  for i in 1 2 3 4 5 6; do
    mkdir -p "${REMOTE}/releases/2026071700000${i}-${i}"
  done
  KEEP_RELEASES=5
  if run_deploy >/dev/null 2>&1 && [[ "$(release_count)" -eq 5 ]]; then
    pass "successful deploy retains five timestamped releases"
  else
    fail "successful deploy retains five timestamped releases"
  fi
  rm -rf "${FIXTURE}"
}

test_curl_timeouts() {
  new_fixture
  if run_deploy >/dev/null 2>&1 &&
     grep -q 'curl .*--connect-timeout 10' "${LOG}" &&
     grep -q 'curl .*--max-time 30' "${LOG}"; then
    pass "health request has connect and total timeouts"
  else
    fail "health request has connect and total timeouts"
  fi
  rm -rf "${FIXTURE}"
}

test_invalid_target_fails_before_remote_access() {
  new_fixture
  if (
    cd "${WORK}"
    PATH="${MOCK_BIN}:${PATH}" MOCK_LOG="${LOG}" SSH_TARGET='root@example.com -o ProxyCommand=x' \
      "${DEPLOY_SCRIPT}"
  ) >/dev/null 2>&1; then
    fail "unsafe SSH target is rejected before remote access"
  elif [[ ! -s "${LOG}" ]]; then
    pass "unsafe SSH target is rejected before remote access"
  else
    fail "unsafe SSH target is rejected before remote access"
  fi
  rm -rf "${FIXTURE}"
}

printf 'TAP version 13\n'
test_lock_contention
test_success_releases_lock
test_signal_rolls_back
test_retention_failure_after_health_keeps_release
test_unlock_failure_after_health_keeps_release
test_owner_change_prevents_foreign_rollback
test_health_failure_rolls_back
test_upload_failure_keeps_current
test_bootstrap_deploy
test_retention
test_curl_timeouts
test_invalid_target_fails_before_remote_access
printf '1..%d\n' "${TESTS_RUN}"

if [[ "${TESTS_FAILED}" -ne 0 ]]; then
  printf '%d test(s) failed\n' "${TESTS_FAILED}" >&2
  exit 1
fi
