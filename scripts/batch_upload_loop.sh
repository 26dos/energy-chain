#!/bin/bash
set -e

echo "=============================================="
echo "  EnergyChain 持续批量数据上链"
echo "  按 Ctrl+C 停止"
echo "=============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Detect EVM RPC
if curl -s -o /dev/null http://127.0.0.1:8575 2>/dev/null; then
  EVM_RPC="http://127.0.0.1:8575"
elif curl -s -o /dev/null http://127.0.0.1:8545 2>/dev/null; then
  EVM_RPC="http://127.0.0.1:8545"
else
  echo "ERROR: EVM RPC 不可达，请先启动链节点"
  exit 1
fi

# Detect chain home for key export
if [ -d "$HOME/.energychain-production/validator-0" ]; then
  KEY_HOME="$HOME/.energychain-production/validator-0"
else
  KEY_HOME="$HOME/.energychaind"
fi

# Use data-submitter wallet if exists, otherwise use dev0
SUBMITTER_KEY=""
if energychaind keys show data-submitter --keyring-backend test --home "$KEY_HOME" > /dev/null 2>&1; then
  SUBMITTER_KEY=$(energychaind keys unsafe-export-eth-key data-submitter \
    --keyring-backend test --home "$KEY_HOME" 2>/dev/null)
  echo "  使用钱包: data-submitter"
else
  SUBMITTER_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
    --keyring-backend test --home "$KEY_HOME" 2>/dev/null)
  echo "  使用钱包: dev0"
fi

echo "  EVM RPC: $EVM_RPC"
echo ""

# Mode selection
MODE="${1:-contract}"
case "$MODE" in
  contract)
    UPLOAD_SCRIPT="$ROOT_DIR/scripts/upload_evm_contract.js"
    echo "  模式: 合约存证 (EnergyDataAttestation)"
    ;;
  rawtx)
    UPLOAD_SCRIPT="$ROOT_DIR/scripts/upload_evm_rawtx.js"
    echo "  模式: 原始交易存证 (Calldata)"
    ;;
  *)
    echo "用法: $0 [contract|rawtx]"
    echo "  contract - 通过智能合约上链 (默认)"
    echo "  rawtx    - 通过原始交易 calldata 上链"
    exit 1
    ;;
esac
echo ""

# Check xlsx exists
XLSX_FILE="$ROOT_DIR/docs/有功功率数据.xlsx"
if [ ! -f "$XLSX_FILE" ]; then
  echo "ERROR: 找不到数据文件 $XLSX_FILE"
  exit 1
fi
echo "  数据文件: $XLSX_FILE"

# Install deps if needed
cd "$ROOT_DIR/scripts"
if [ ! -d "node_modules" ] && [ -f "package.json" ]; then
  echo "  安装依赖..."
  npm install > /dev/null 2>&1
fi

# Check if contracts/deployment.json exists (needed for contract mode)
if [ "$MODE" = "contract" ] && [ ! -f "$ROOT_DIR/contracts/deployment.json" ]; then
  echo "ERROR: contracts/deployment.json 不存在，请先运行 scripts/deploy_dex.sh 部署合约"
  exit 1
fi

ROUND=0
TOTAL_SUCCESS=0
TOTAL_FAIL=0
START_TIME=$(date +%s)

trap 'echo ""; echo ""; echo "══════════════════════════════"; echo "  总计: ${ROUND} 轮, 上链中断"; echo "══════════════════════════════"; exit 0' INT

echo ""
echo "━━━ 开始持续上链 ━━━"
echo ""

while true; do
  ROUND=$((ROUND + 1))
  ROUND_START=$(date +%s)
  echo "╔══════════════════════════════════════════╗"
  echo "║  第 ${ROUND} 轮上链  $(date '+%Y-%m-%d %H:%M:%S')        ║"
  echo "╚══════════════════════════════════════════╝"

  if [ "$MODE" = "contract" ]; then
    RPC_URL="$EVM_RPC" PRIVATE_KEY="$SUBMITTER_KEY" \
      node "$UPLOAD_SCRIPT" 2>&1 || true
  else
    RPC_URL="$EVM_RPC" PRIVATE_KEY_B="$SUBMITTER_KEY" \
      node "$UPLOAD_SCRIPT" 2>&1 || true
  fi

  ROUND_END=$(date +%s)
  ROUND_ELAPSED=$((ROUND_END - ROUND_START))
  TOTAL_ELAPSED=$((ROUND_END - START_TIME))

  echo ""
  echo "  第 ${ROUND} 轮完成, 耗时 ${ROUND_ELAPSED}s, 累计运行 ${TOTAL_ELAPSED}s"
  echo ""

  # Brief pause between rounds
  echo "  等待 5s 后开始第 $((ROUND + 1)) 轮..."
  sleep 5
done
