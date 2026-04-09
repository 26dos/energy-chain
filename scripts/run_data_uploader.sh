#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/batch_upload.log"
MODE="${1:-rawtx}"
MAX_RETRIES=0  # 0 = infinite
RETRY_DELAY=10

echo "╔══════════════════════════════════════════╗"
echo "║  Data Uploader Supervisor                ║"
echo "║  Auto-restart on crash                   ║"
echo "╚══════════════════════════════════════════╝"
echo "  Mode: $MODE"
echo "  Log:  $LOG_FILE"
echo ""

attempt=0
while true; do
  attempt=$((attempt + 1))
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting data uploader (attempt #$attempt, mode=$MODE)..."

  bash "$SCRIPT_DIR/batch_upload_loop.sh" "$MODE" 2>&1 | tee -a "$LOG_FILE" || true

  exit_code=${PIPESTATUS[0]}
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Data uploader exited with code $exit_code"

  if [ "$MAX_RETRIES" -gt 0 ] && [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "Max retries ($MAX_RETRIES) reached. Stopping."
    exit 1
  fi

  echo "Restarting in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
done
