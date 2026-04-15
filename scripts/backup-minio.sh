#!/usr/bin/env bash
set -euo pipefail

# MinIO backup script using mc (MinIO Client)
# Requires mc to be installed and configured with alias "local"

BACKUP_DIR="${BACKUP_DIR:-./backups/minio}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TARGET="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${TARGET}"

echo "Starting MinIO backup to ${TARGET}..."
mc mirror local/smartmedcare "${TARGET}" --overwrite

echo "Backup completed: ${TARGET}"
