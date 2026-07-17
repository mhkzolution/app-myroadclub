#!/usr/bin/env bash
set -euo pipefail

while IFS= read -r -d '' file; do
  php -l "$file"
done < <(printf '%s\0' wordpress/myroadclub-requests/*.php wordpress/myroadclub-requests/includes/*.php)
php wordpress/myroadclub-requests/tests/validator-test.php
