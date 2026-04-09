#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_DIR/contracts"
LOG_FILE="/tmp/trades.log"
MAX_RETRIES=0  # 0 = infinite
RETRY_DELAY=10

export PRIVATE_KEY="${PRIVATE_KEY:-$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test --home ~/.energychain-production/validator-0 2>/dev/null || echo "")}"
export RPC_URL="${RPC_URL:-http://127.0.0.1:8575}"

if [ -z "$PRIVATE_KEY" ]; then
  echo "ERROR: PRIVATE_KEY not set and cannot auto-export from keyring"
  exit 1
fi

echo "╔══════════════════════════════════════════╗"
echo "║  DEX Trade Bot Supervisor                ║"
echo "║  Auto-restart on crash                   ║"
echo "╚══════════════════════════════════════════╝"
echo "  RPC: $RPC_URL"
echo "  Log: $LOG_FILE"
echo ""

attempt=0
while true; do
  attempt=$((attempt + 1))
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting trade bot (attempt #$attempt)..."

  cd "$CONTRACTS_DIR"
  npx hardhat run scripts/simulate_trades.ts --network energychain_testnet 2>&1 | tee -a "$LOG_FILE" || true

  exit_code=${PIPESTATUS[0]}
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Trade bot exited with code $exit_code"

  if [ "$MAX_RETRIES" -gt 0 ] && [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "Max retries ($MAX_RETRIES) reached. Stopping."
    exit 1
  fi

  echo "Restarting in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
done
