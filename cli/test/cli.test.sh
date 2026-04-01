#!/bin/bash
# CLI smoke tests — requires a running local node with a deployed contract
# Usage: CONTRACT=0x... bash cli/test/cli.test.sh

set -e

CLI="node cli/bin/energy-cli.js"
RPC="${ENERGY_RPC_URL:-http://127.0.0.1:8545}"
KEY="${ENERGY_PRIVATE_KEY:-0x8be1e5311e4cb31002c5c84cea459b5e598592f1d00c796e3de2880d55fe9990}"
CONTRACT="${CONTRACT:?ERROR: Set CONTRACT=<deployed address>}"

PASS=0
FAIL=0

assert_ok() {
  if [ $? -eq 0 ]; then
    echo "  PASS: $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== CLI Smoke Tests ==="
echo "RPC: ${RPC}"
echo "Contract: ${CONTRACT}"
echo ""

# Test 1: hash
echo "[1] hash command"
HASH_OUT=$($CLI hash -d '{"test":"data"}' 2>&1)
echo "$HASH_OUT" | grep -q "0x" && assert_ok "hash produces 0x-prefixed result" || assert_ok "hash produces 0x-prefixed result"

# Test 2: info
echo "[2] info command"
INFO_OUT=$($CLI info --rpc "$RPC" --contract "$CONTRACT" 2>&1)
echo "$INFO_OUT" | grep -q "Owner" && assert_ok "info returns owner" || assert_ok "info returns owner"

# Test 3: attest
echo "[3] attest command"
ATTEST_OUT=$($CLI attest \
  --rpc "$RPC" \
  --contract "$CONTRACT" \
  --key "$KEY" \
  --category "meter" \
  --source-id "test-meter-001" \
  --data '{"reading":42}' 2>&1)
echo "$ATTEST_OUT" | grep -qi "tx\|hash\|success" && assert_ok "attest submits transaction" || assert_ok "attest submits transaction"

# Test 4: query
echo "[4] query command"
QUERY_OUT=$($CLI query --rpc "$RPC" --contract "$CONTRACT" --index 0 2>&1)
echo "$QUERY_OUT" | grep -q "dataHash" && assert_ok "query returns data hash" || assert_ok "query returns data hash"

# Test 5: verify
echo "[5] verify command"
VERIFY_OUT=$($CLI verify \
  --rpc "$RPC" \
  --contract "$CONTRACT" \
  --data '{"reading":42}' 2>&1)
assert_ok "verify command runs"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
