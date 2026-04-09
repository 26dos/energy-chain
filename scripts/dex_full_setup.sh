#!/bin/bash
set -e

echo "=============================================="
echo "  EnergyChain DEX 完整设置"
echo "  添加流动性 + 启动交易机器人"
echo "=============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Detect chain home and EVM RPC
if [ -d "$HOME/.energychain-production/validator-0" ]; then
  KEY_HOME="$HOME/.energychain-production/validator-0"
else
  KEY_HOME="$HOME/.energychaind"
fi

if curl -s -o /dev/null http://127.0.0.1:8575 2>/dev/null; then
  EVM_RPC="http://127.0.0.1:8575"
else
  EVM_RPC="http://127.0.0.1:8545"
fi

echo "  EVM RPC: $EVM_RPC"
echo "  Key Home: $KEY_HOME"
echo ""

# Check dex-deployment.json
DEX_JSON="$ROOT_DIR/contracts/dex-deployment.json"
if [ ! -f "$DEX_JSON" ]; then
  echo "ERROR: dex-deployment.json 不存在，请先运行 scripts/deploy_dex.sh"
  exit 1
fi

cd "$ROOT_DIR/contracts"

# Use dex-lp wallet for liquidity, dex-trader for trading
LP_KEY=""
TRADER_KEY=""

if energychaind keys show dex-lp --keyring-backend test --home "$KEY_HOME" > /dev/null 2>&1; then
  LP_KEY=$(energychaind keys unsafe-export-eth-key dex-lp \
    --keyring-backend test --home "$KEY_HOME" 2>/dev/null)
  echo "  流动性钱包: dex-lp"
else
  LP_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
    --keyring-backend test --home "$KEY_HOME" 2>/dev/null)
  echo "  流动性钱包: dev0 (未找到 dex-lp)"
fi

if energychaind keys show dex-trader --keyring-backend test --home "$KEY_HOME" > /dev/null 2>&1; then
  TRADER_KEY=$(energychaind keys unsafe-export-eth-key dex-trader \
    --keyring-backend test --home "$KEY_HOME" 2>/dev/null)
  echo "  交易钱包: dex-trader"
else
  TRADER_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
    --keyring-backend test --home "$KEY_HOME" 2>/dev/null)
  echo "  交易钱包: dev0 (未找到 dex-trader)"
fi
echo ""

# Parse mode from arguments
MODE="${1:-all}"

case "$MODE" in
  liquidity)
    echo "━━━ 仅添加流动性 ━━━"
    echo ""
    PRIVATE_KEY="$LP_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/add_liquidity.ts --network energychain_testnet
    ;;

  trade)
    echo "━━━ 仅启动交易机器人 (Ctrl+C 停止) ━━━"
    echo ""
    PRIVATE_KEY="$TRADER_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/simulate_trades.ts --network energychain_testnet
    ;;

  fund)
    echo "━━━ 给 dex-trader 分配 USDT ━━━"
    echo ""
    PRIVATE_KEY="$LP_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/fund_dev0.ts --network energychain_testnet
    ;;

  test)
    echo "━━━ DEX 完整合约测试 (10 项) ━━━"
    echo ""
    PRIVATE_KEY="$LP_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/test_all_dex.ts --network energychain_testnet
    ;;

  all)
    echo "[1/3] 添加流动性 (USDT/ECY)..."
    echo ""
    PRIVATE_KEY="$LP_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/add_liquidity.ts --network energychain_testnet
    echo ""

    echo "[2/3] 给交易钱包分配 USDT..."
    echo ""
    PRIVATE_KEY="$LP_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/fund_dev0.ts --network energychain_testnet
    echo ""

    echo "[3/3] 启动交易机器人 (Ctrl+C 停止)..."
    echo ""
    PRIVATE_KEY="$TRADER_KEY" RPC_URL="$EVM_RPC" \
      npx hardhat run scripts/simulate_trades.ts --network energychain_testnet
    ;;

  *)
    echo "用法: $0 [all|liquidity|trade|fund|test]"
    echo ""
    echo "  all       - 添加流动性 + 分配 USDT + 启动交易 (默认)"
    echo "  liquidity - 仅添加流动性 (100K USDT + 10K ECY)"
    echo "  trade     - 仅启动自动交易机器人 (无限循环)"
    echo "  fund      - 给交易钱包分配 USDT"
    echo "  test      - 运行 10 项 DEX 合约完整测试"
    exit 0
    ;;
esac
