#!/bin/bash
set -e

echo "=============================================="
echo "  EnergyChain 业务钱包创建与资金分配"
echo "=============================================="
echo ""

BINARY="energychaind"
CHAIN_ID="energychain_9001-1"
DENOM="uecy"
KEYRING="test"
KEYALGO="eth_secp256k1"
FEES="100000000000000uecy"

# Detect chain home
if [ -d "$HOME/.energychain-production/validator-0" ]; then
  KEY_HOME="$HOME/.energychain-production/validator-0"
  FUNDER="validator0"
  echo "  模式: 生产多节点"
else
  KEY_HOME="$HOME/.energychaind"
  FUNDER="validator"
  echo "  模式: 单节点开发"
fi

# Detect RPC
if curl -s -o /dev/null http://127.0.0.1:26687 2>/dev/null; then
  RPC="http://127.0.0.1:26687"
elif curl -s -o /dev/null http://127.0.0.1:26657 2>/dev/null; then
  RPC="http://127.0.0.1:26657"
else
  echo "ERROR: 链节点未启动，无法连接 RPC"
  exit 1
fi
echo "  RPC: $RPC"
echo "  资金来源: $FUNDER"
echo ""

WALLETS=("data-submitter" "dex-trader" "dex-lp" "test-user-1" "test-user-2" "test-user-3")

# ====== 创建钱包 ======
echo "[1/3] 创建业务钱包..."
declare -a ADDRS
for name in "${WALLETS[@]}"; do
  if $BINARY keys show "$name" --keyring-backend "$KEYRING" --home "$KEY_HOME" > /dev/null 2>&1; then
    echo "  $name: 已存在 (跳过)"
  else
    $BINARY keys add "$name" \
      --keyring-backend "$KEYRING" \
      --algo "$KEYALGO" \
      --home "$KEY_HOME" > /dev/null 2>&1
    echo "  $name: 已创建"
  fi
  ADDR=$($BINARY keys show "$name" --keyring-backend "$KEYRING" --home "$KEY_HOME" --address)
  ADDRS+=("$ADDR")
done
echo ""

# ====== 分配资金 ======
echo "[2/3] 分配 ECY 到各钱包..."

AMOUNTS=(
  "50000000000000000000000"   # data-submitter: 50,000 ECY
  "100000000000000000000000"  # dex-trader: 100,000 ECY
  "200000000000000000000000"  # dex-lp: 200,000 ECY
  "10000000000000000000000"   # test-user-1: 10,000 ECY
  "10000000000000000000000"   # test-user-2: 10,000 ECY
  "10000000000000000000000"   # test-user-3: 10,000 ECY
)

LABELS=(
  "50,000 ECY"
  "100,000 ECY"
  "200,000 ECY"
  "10,000 ECY"
  "10,000 ECY"
  "10,000 ECY"
)

for i in "${!WALLETS[@]}"; do
  echo "  转账 ${LABELS[$i]} -> ${WALLETS[$i]} (${ADDRS[$i]})..."
  $BINARY tx bank send "$FUNDER" "${ADDRS[$i]}" "${AMOUNTS[$i]}${DENOM}" \
    --fees "$FEES" \
    --keyring-backend "$KEYRING" \
    --home "$KEY_HOME" \
    --chain-id "$CHAIN_ID" \
    --node "$RPC" \
    --broadcast-mode sync \
    -y > /dev/null 2>&1
  sleep 2
done
echo ""

# ====== 导出私钥 ======
echo "[3/3] 钱包信息汇总..."
echo ""
echo "┌─────────────────┬─────────────────────────────────────────────────┬───────────────┐"
echo "│ 钱包名称        │ 地址                                            │ 用途          │"
echo "├─────────────────┼─────────────────────────────────────────────────┼───────────────┤"
for i in "${!WALLETS[@]}"; do
  printf "│ %-15s │ %-47s │ " "${WALLETS[$i]}" "${ADDRS[$i]}"
  case "${WALLETS[$i]}" in
    data-submitter) printf "%-13s │\n" "数据上链";;
    dex-trader)     printf "%-13s │\n" "DEX交易";;
    dex-lp)         printf "%-13s │\n" "流动性提供";;
    test-user-*)    printf "%-13s │\n" "测试转账";;
  esac
done
echo "└─────────────────┴─────────────────────────────────────────────────┴───────────────┘"
echo ""

echo "导出 EVM 私钥 (用于 MetaMask 导入):"
for name in "${WALLETS[@]}"; do
  ETH_KEY=$($BINARY keys unsafe-export-eth-key "$name" \
    --keyring-backend "$KEYRING" \
    --home "$KEY_HOME" 2>/dev/null || echo "FAILED")
  echo "  $name: $ETH_KEY"
done
echo ""

echo "=============================================="
echo "  钱包创建完成！"
echo "=============================================="
echo ""
echo "  查询余额:"
echo "    energychaind query bank balances <地址> --node $RPC"
echo ""
echo "  手动转账:"
echo "    energychaind tx bank send <from> <to> 1000000000000000000uecy \\"
echo "      --fees $FEES --keyring-backend test --home $KEY_HOME \\"
echo "      --chain-id $CHAIN_ID --node $RPC -y"
echo "=============================================="
