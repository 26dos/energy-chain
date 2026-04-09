#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
# Detect chain home and EVM RPC port
# Priority: energychaind (single) > production fullnode > evmnode (legacy workaround)
if [ -d "$HOME/.energychaind" ]; then
  KEY_HOME="$HOME/.energychaind"
elif [ -d "$HOME/.energychain-production/validator-0" ]; then
  KEY_HOME="$HOME/.energychain-production/validator-0"
elif [ -d "$HOME/.energychain-evmnode" ]; then
  KEY_HOME="$HOME/.energychain-evmnode"
else
  echo "ERROR: No chain data found"; exit 1
fi

# Detect EVM RPC - try single-node (8545), then production fullnode (8575)
if curl -s -o /dev/null http://127.0.0.1:8545 2>/dev/null; then
  EVM_RPC="http://127.0.0.1:8545"
elif curl -s -o /dev/null http://127.0.0.1:8575 2>/dev/null; then
  EVM_RPC="http://127.0.0.1:8575"
else
  EVM_RPC="http://127.0.0.1:8545"
fi

echo "=============================================="
echo "  Deploy DEX Contracts + Frontend"
echo "=============================================="
echo ""

command -v npx >/dev/null 2>&1 || { echo "ERROR: npx not found. Install Node.js first."; exit 1; }

# Verify EVM RPC is reachable
echo "Checking EVM RPC..."
if ! curl -s -o /dev/null "$EVM_RPC" 2>/dev/null; then
  echo "ERROR: EVM RPC at $EVM_RPC not reachable. Start chain nodes first."
  exit 1
fi
echo "  EVM RPC is reachable."
echo ""

# ====== Export dev0 private key ======
echo "[1/6] Exporting dev0 private key..."
DEV0_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test \
  --home "${KEY_HOME}" 2>/dev/null)

if [ -z "$DEV0_KEY" ]; then
  echo "ERROR: Could not export dev0 key. Make sure chain nodes were deployed."
  exit 1
fi
echo "  Private key exported."
echo ""

# ====== Fund dev0 if needed ======
echo "[2/6] Checking dev0 balance..."
DEV0_ADDR=$(energychaind keys show dev0 --keyring-backend test --home "${KEY_HOME}" --address 2>/dev/null)
DEV0_EVM_BAL=$(curl -s -X POST "$EVM_RPC" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$(energychaind keys show dev0 --keyring-backend test --home "${KEY_HOME}" --output json 2>/dev/null | jq -r '.address // empty' | sed 's/^energy/0x/' || echo '')\",\"latest\"],\"id\":1}" 2>/dev/null | jq -r '.result // "0x0"')

MIN_BALANCE="21000000000000000000000"  # 21,000 ECY in wei (enough for liquidity + gas)

if [ -d "$HOME/.energychain-production/validator-0" ]; then
  RPC_NODE="http://127.0.0.1:26687"
  [ -z "$RPC_NODE" ] && RPC_NODE="http://127.0.0.1:26657"
  FUNDER="validator0"
  CHAIN_ID="energychain_9001-1"
  
  echo "  Funding dev0 with 50,000 ECY from $FUNDER..."
  energychaind tx bank send "$FUNDER" "$DEV0_ADDR" \
    "50000000000000000000000uecy" \
    --fees "100000000000000uecy" \
    --keyring-backend test \
    --home "${KEY_HOME}" \
    --chain-id "$CHAIN_ID" \
    --node "$RPC_NODE" \
    --broadcast-mode sync -y > /dev/null 2>&1 || echo "  (transfer may have failed, continuing...)"
  sleep 6
  echo "  dev0 funded."
else
  echo "  Single-node mode, dev0 should have enough funds."
fi
echo ""

# ====== Deploy attestation contract ======
echo "[3/6] Deploying EnergyDataAttestation contract..."
cd "$ROOT_DIR/contracts"

if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install 2>&1 | tail -1
fi

echo "  Compiling contracts..."
PRIVATE_KEY="$DEV0_KEY" RPC_URL="$EVM_RPC" npx hardhat compile --quiet

echo "  Deploying attestation contract..."
PRIVATE_KEY="$DEV0_KEY" RPC_URL="$EVM_RPC" \
  npx hardhat run scripts/deploy.ts --network energychain_testnet
echo ""

# ====== Deploy DEX contracts ======
echo "[4/6] Deploying DEX contracts (WECY, Factory, Router, Multicall3, TokenFactory, TestUSDT)..."
PRIVATE_KEY="$DEV0_KEY" RPC_URL="$EVM_RPC" \
  npx hardhat run scripts/deploy_dex.ts --network energychain_testnet
echo ""

# ====== Add liquidity ======
echo "[5/6] Adding initial liquidity..."
PRIVATE_KEY="$DEV0_KEY" RPC_URL="$EVM_RPC" \
  npx hardhat run scripts/add_liquidity.ts --network energychain_testnet
echo ""

# ====== Update frontend config ======
echo "[6/6] Updating DEX frontend config..."
DEX_JSON="$ROOT_DIR/contracts/dex-deployment.json"
if [ ! -f "$DEX_JSON" ]; then
  echo "ERROR: dex-deployment.json not found."
  exit 1
fi

WECY=$(jq -r '.contracts.WECY' "$DEX_JSON")
FACTORY=$(jq -r '.contracts.UniswapV2Factory' "$DEX_JSON")
ROUTER=$(jq -r '.contracts.UniswapV2Router02' "$DEX_JSON")
MULTICALL=$(jq -r '.contracts.Multicall3' "$DEX_JSON")
TOKEN_FACTORY=$(jq -r '.contracts.ERC20TokenFactory' "$DEX_JSON")

cat > "$ROOT_DIR/dex-frontend/src/config/contracts.ts" << TSEOF
export const CHAIN_ID = 262144;

export const CHAIN_CONFIG = {
  id: CHAIN_ID,
  name: "EnergyChain",
  nativeCurrency: { name: "ECY", symbol: "ECY", decimals: 18 },
  rpcUrls: {
    default: { http: ["${EVM_RPC}"] },
    public: { http: ["${EVM_RPC}"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "http://localhost:4000" },
  },
} as const;

export const CONTRACTS = {
  WECY: "${WECY}",
  Factory: "${FACTORY}",
  Router: "${ROUTER}",
  Multicall3: "${MULTICALL}",
  TokenFactory: "${TOKEN_FACTORY}",
};

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_DEADLINE = 20;
TSEOF

echo "  Frontend contract addresses updated."
echo ""

# ====== Start DEX frontend ======
echo "Starting DEX frontend..."
cd "$ROOT_DIR/dex-frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install 2>&1 | tail -1
fi

# Kill any existing process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

nohup npx vite --host 0.0.0.0 --port 3000 > /tmp/dex-frontend.log 2>&1 &
DEX_PID=$!

echo "  DEX frontend running at http://127.0.0.1:3000 (PID: $DEX_PID)"
echo ""

echo "=============================================="
echo "  DEX Deployment Complete"
echo "=============================================="
echo ""
echo "  Contracts:"
echo "    WECY:          $WECY"
echo "    Factory:       $FACTORY"
echo "    Router:        $ROUTER"
echo "    Multicall3:    $MULTICALL"
echo "    TokenFactory:  $TOKEN_FACTORY"
echo ""
echo "  Frontend:        http://127.0.0.1:3000"
echo "  EVM RPC:         $EVM_RPC"
echo ""
echo "  Stop frontend:   kill $DEX_PID"
echo "=============================================="
