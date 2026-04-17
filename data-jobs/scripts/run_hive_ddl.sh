#!/usr/bin/env bash
# Apply the Hive DDL files in numeric order via Beeline.
#
# Env:
#   HIVE_JDBC  default: jdbc:hive2://hive-server:10000/default
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HIVE_DIR="$(cd "${SCRIPT_DIR}/../hive" && pwd)"

: "${HIVE_JDBC:=jdbc:hive2://hive-server:10000/default}"

for sql in "${HIVE_DIR}"/[0-9][0-9]_*.sql; do
    echo ">>> applying $(basename "${sql}")"
    beeline -u "${HIVE_JDBC}" -f "${sql}"
done

echo "Hive DDL applied successfully."
