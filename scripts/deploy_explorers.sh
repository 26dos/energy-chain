#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "  Deploy Blockscout + Ping.pub Explorers"
echo "=============================================="
echo ""

# ====== Blockscout (Docker) ======
echo "[1/2] Starting Blockscout..."

command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found. Install Docker Desktop first."; exit 1; }

cd "$ROOT_DIR/blockscout"

# Verify EVM RPC is reachable (try production port first, then single-node default)
EVM_PORT=""
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8575 2>/dev/null | grep -q "200\|405"; then
  EVM_PORT=8575
  echo "  EVM RPC (port 8575) is reachable."
elif curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8545 2>/dev/null | grep -q "200\|405"; then
  EVM_PORT=8545
  echo "  EVM RPC (port 8545) is reachable."
else
  echo "  WARNING: EVM RPC not reachable. Blockscout may not index."
  echo "  Make sure chain nodes are running first."
  EVM_PORT=8545
fi

docker compose down 2>/dev/null || true
export EVM_HTTP_URL="http://host.docker.internal:${EVM_PORT}"
export EVM_WS_URL="ws://host.docker.internal:$((EVM_PORT + 1))"
docker compose up -d

echo "  Blockscout starting at http://127.0.0.1:4000"
echo "  (First startup takes 1-2 minutes to initialize DB)"
echo ""

# ====== Ping.pub ======
echo "[2/2] Building & starting Ping.pub..."

cd "$ROOT_DIR/ping-explorer"

# Detect correct API/RPC ports (production vs single-node)
API_PORT=1317
RPC_PORT=26657
if curl -s -o /dev/null http://127.0.0.1:1320 2>/dev/null; then
  API_PORT=1320; RPC_PORT=26687
fi

cat > chains/mainnet/energychain.json << EOF
{
  "chain_name": "energychain",
  "api": [
    { "provider": "local", "address": "http://localhost:${API_PORT}" }
  ],
  "rpc": [
    { "provider": "local", "address": "http://localhost:${RPC_PORT}" }
  ],
  "sdk_version": "0.54.0",
  "coin_type": "60",
  "min_tx_fee": "10000000000",
  "addr_prefix": "energy",
  "logo": "/energychain-logo.svg",
  "theme_color": "#00b894",
  "assets": [
    {
      "base": "uecy",
      "symbol": "ECY",
      "exponent": "18",
      "coingecko_id": "",
      "logo": "/energychain-logo.svg"
    }
  ]
}
EOF

echo "  Chain config updated."

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install --legacy-peer-deps 2>&1 | tail -1
fi

echo "  Building Ping.pub..."
npm run build 2>&1 | tail -3

# Kill any existing serve process on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

cd dist
nohup npx serve -s -l 8080 > /tmp/pingpub.log 2>&1 &
PING_PID=$!
cd ..

echo "  Ping.pub running at http://127.0.0.1:8080/energychain (PID: $PING_PID)"
echo ""

echo "=============================================="
echo "  Explorers Deployed"
echo "=============================================="
echo ""
echo "  Blockscout (EVM):   http://127.0.0.1:4000"
echo "  Ping.pub (Cosmos):  http://127.0.0.1:8080/energychain"
echo ""
echo "  Stop Blockscout:    cd blockscout && docker compose down"
echo "  Stop Ping.pub:      kill $PING_PID"
echo "=============================================="
