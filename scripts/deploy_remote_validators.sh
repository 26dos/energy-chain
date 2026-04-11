#!/bin/bash
set -e

# ============================================================
#  EnergyChain 远程验证者节点部署脚本
#  在新机器上部署 validator-4 和 validator-5 并加入已有网络
# ============================================================

usage() {
  echo "用法: $0 --seed-id <ID> --sentry0-id <ID> --sentry1-id <ID> --seed-ip <IP> --genesis <PATH>"
  echo ""
  echo "必须参数:"
  echo "  --seed-id     Ubuntu seed 节点 ID"
  echo "  --sentry0-id  Ubuntu sentry-0 节点 ID"
  echo "  --sentry1-id  Ubuntu sentry-1 节点 ID"
  echo "  --genesis     从 Ubuntu 拷贝来的 genesis.json 文件路径"
  echo ""
  echo "可选参数:"
  echo "  --seed-ip     Ubuntu 机器内网 IP (默认: 192.168.31.71)"
  echo "  --state-sync  开启 State Sync 快速同步 (需要 fullnode 已开启快照)"
  echo "  --skip-start  只初始化和配置, 不启动节点"
  echo "  --help        显示帮助"
  echo ""
  echo "获取节点 ID (在 Ubuntu 上执行):"
  echo "  energychaind comet show-node-id --home ~/.energychain-production/seed"
  echo "  energychaind comet show-node-id --home ~/.energychain-production/sentry-0"
  echo "  energychaind comet show-node-id --home ~/.energychain-production/sentry-1"
  exit 1
}

SEED_ID=""
SEED_IP="192.168.31.71"
GENESIS_PATH=""
SENTRY0_ID=""
SENTRY1_ID=""
STATE_SYNC=false
SKIP_START=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --seed-id) SEED_ID="$2"; shift 2 ;;
    --seed-ip) SEED_IP="$2"; shift 2 ;;
    --genesis) GENESIS_PATH="$2"; shift 2 ;;
    --sentry0-id) SENTRY0_ID="$2"; shift 2 ;;
    --sentry1-id) SENTRY1_ID="$2"; shift 2 ;;
    --state-sync) STATE_SYNC=true; shift ;;
    --skip-start) SKIP_START=true; shift ;;
    --help) usage ;;
    *) echo "未知参数: $1"; usage ;;
  esac
done

if [ -z "$SEED_ID" ]; then
  echo "错误: 必须提供 --seed-id"; usage
fi
if [ -z "$SENTRY0_ID" ]; then
  echo "错误: 必须提供 --sentry0-id (跨机连接必须通过 sentry)"; usage
fi
if [ -z "$SENTRY1_ID" ]; then
  echo "错误: 必须提供 --sentry1-id (跨机连接必须通过 sentry)"; usage
fi
if [ -z "$GENESIS_PATH" ] || [ ! -f "$GENESIS_PATH" ]; then
  echo "错误: genesis.json 文件不存在: ${GENESIS_PATH}"; usage
fi

sedi() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

BINARY="energychaind"
BASE_HOME="$HOME/.energychain-production"
CHAIN_ID="energychain_9001-1"
DENOM="uecy"
KEYRING="test"
KEYALGO="eth_secp256k1"

command -v $BINARY >/dev/null 2>&1 || {
  echo "错误: $BINARY 未找到。请先编译:"
  echo "  cd chain && go install ./cmd/energychaind && cd .."
  echo "  export PATH=\"\$HOME/go/bin:\$PATH\""
  exit 1
}
command -v jq >/dev/null 2>&1 || {
  echo "错误: jq 未找到。请安装: brew install jq (Mac) / sudo apt install jq (Linux)"
  exit 1
}

echo "=============================================="
echo "  EnergyChain 远程验证者节点部署"
echo "  目标: validator-4, validator-5"
echo "=============================================="
echo ""
echo "  Seed:     ${SEED_ID}@${SEED_IP}:26656"
echo "  Sentry-0: ${SENTRY0_ID}@${SEED_IP}:26666"
echo "  Sentry-1: ${SENTRY1_ID}@${SEED_IP}:26676"
echo "  Genesis:  ${GENESIS_PATH}"
echo ""

if pgrep -f "energychaind start" > /dev/null 2>&1; then
  echo "警告: 检测到已运行的 energychaind 进程"
  echo "继续将覆盖已有配置。是否继续? (y/N)"
  read -r REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "已取消"; exit 0
  fi
  echo "停止已有节点..."
  pkill -f "energychaind start" || true
  sleep 3
fi

# ====== 第 1 步: 初始化节点 ======
echo "[1/5] 初始化节点..."
rm -rf "${BASE_HOME}/validator-4" "${BASE_HOME}/validator-5"

for idx in 4 5; do
  $BINARY init "validator-${idx}" --chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-${idx}" > /dev/null 2>&1
  $BINARY config set client chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-${idx}"
  $BINARY config set client keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-${idx}"
  echo "  -> validator-${idx} 初始化完成"
done

# ====== 第 2 步: 复制 Genesis ======
echo ""
echo "[2/5] 复制 genesis.json..."
cp "$GENESIS_PATH" "${BASE_HOME}/validator-4/config/genesis.json"
cp "$GENESIS_PATH" "${BASE_HOME}/validator-5/config/genesis.json"
echo "  Genesis 已分发到 2 个节点"

# ====== 第 3 步: 创建密钥 ======
echo ""
echo "[3/5] 创建验证者密钥..."
declare -a VAL_ADDRS

for idx in 4 5; do
  $BINARY keys add "validator${idx}" \
    --keyring-backend "$KEYRING" \
    --algo "$KEYALGO" \
    --home "${BASE_HOME}/validator-${idx}" > /dev/null 2>&1

  ADDR=$($BINARY keys show "validator${idx}" --keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-${idx}" --address)
  VAL_ADDRS+=("$ADDR")
  echo "  validator-${idx}: ${ADDR}"
done

# ====== 第 4 步: 配置网络 ======
echo ""
echo "[4/5] 配置网络连接..."

SEED_PEER="${SEED_ID}@${SEED_IP}:26656"
SENTRY_PEERS="${SENTRY0_ID}@${SEED_IP}:26666,${SENTRY1_ID}@${SEED_IP}:26676"

# --- validator-4: P2P=26656, RPC=26657, EVM=8545 ---
V4_CFG="${BASE_HOME}/validator-4/config/config.toml"
V4_APP="${BASE_HOME}/validator-4/config/app.toml"

sedi "s|seeds = \"\"|seeds = \"${SEED_PEER}\"|" "$V4_CFG"
sedi "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY_PEERS}\"|" "$V4_CFG"
sedi 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$V4_CFG"
sedi 's|addr_book_strict = true|addr_book_strict = false|' "$V4_CFG"
sedi 's|prometheus = false|prometheus = true|' "$V4_CFG"
sedi '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$V4_APP"
sedi '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$V4_APP"
sedi "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$V4_APP"

echo "  validator-4: P2P=26656  RPC=26657  EVM=8545"

# --- validator-5: P2P=26666, RPC=26667, EVM=8555 ---
V5_CFG="${BASE_HOME}/validator-5/config/config.toml"
V5_APP="${BASE_HOME}/validator-5/config/app.toml"

sedi "s|laddr = \"tcp://0.0.0.0:26656\"|laddr = \"tcp://0.0.0.0:26666\"|" "$V5_CFG"
sedi "s|laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://127.0.0.1:26667\"|" "$V5_CFG"
sedi "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:6061\"|" "$V5_CFG"
sedi "s|seeds = \"\"|seeds = \"${SEED_PEER}\"|" "$V5_CFG"
sedi "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY_PEERS}\"|" "$V5_CFG"
sedi 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$V5_CFG"
sedi 's|addr_book_strict = true|addr_book_strict = false|' "$V5_CFG"
sedi 's|prometheus = false|prometheus = true|' "$V5_CFG"
sedi "s|address = \"tcp://localhost:1317\"|address = \"tcp://127.0.0.1:1318\"|" "$V5_APP"
sedi "s|address = \"localhost:9090\"|address = \"127.0.0.1:9190\"|" "$V5_APP"
sedi "s|address = \"127.0.0.1:8545\"|address = \"127.0.0.1:8555\"|" "$V5_APP"
sedi "s|ws-address = \"127.0.0.1:8546\"|ws-address = \"127.0.0.1:8556\"|" "$V5_APP"
sedi '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$V5_APP"
sedi '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$V5_APP"
sedi "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$V5_APP"

echo "  validator-5: P2P=26666  RPC=26667  EVM=8555"

# ====== State Sync (可选) ======
if [ "$STATE_SYNC" = true ]; then
  echo ""
  echo "[4.5/5] 配置 State Sync..."
  FULLNODE_RPC="http://${SEED_IP}:26687"

  LATEST_HEIGHT=$(curl -s ${FULLNODE_RPC}/block | jq -r '.result.block.header.height')
  if [ -z "$LATEST_HEIGHT" ] || [ "$LATEST_HEIGHT" = "null" ]; then
    echo "  警告: 无法获取区块高度, 跳过 State Sync"
  else
    TRUST_HEIGHT=$((LATEST_HEIGHT - 1000))
    [ "$TRUST_HEIGHT" -lt 1 ] && TRUST_HEIGHT=1
    TRUST_HASH=$(curl -s "${FULLNODE_RPC}/block?height=${TRUST_HEIGHT}" | jq -r '.result.block_id.hash')

    echo "  信任高度: ${TRUST_HEIGHT}  哈希: ${TRUST_HASH}"

    for idx in 4 5; do
      CFG="${BASE_HOME}/validator-${idx}/config/config.toml"
      sedi '/^\[statesync\]$/,/^\[/ s|enable = false|enable = true|' "$CFG"
      sedi "s|rpc_servers = \"\"|rpc_servers = \"${SEED_IP}:26687,${SEED_IP}:26667\"|" "$CFG"
      sedi "s|trust_height = 0|trust_height = ${TRUST_HEIGHT}|" "$CFG"
      sedi "s|trust_hash = \"\"|trust_hash = \"${TRUST_HASH}\"|" "$CFG"
      echo "  validator-${idx} State Sync 已开启"
    done
  fi
fi

# ====== 第 5 步: 启动 ======
if [ "$SKIP_START" = true ]; then
  echo ""
  echo "已跳过启动 (--skip-start)"
else
  echo ""
  echo "[5/5] 启动节点..."
  LOG_DIR="${BASE_HOME}/logs"
  mkdir -p "$LOG_DIR"

  nohup $BINARY start --home "${BASE_HOME}/validator-4" --chain-id "$CHAIN_ID" \
    --minimum-gas-prices="10000000000${DENOM}" --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-4.log" 2>&1 &
  echo "  validator-4  PID: $!"
  sleep 3

  nohup $BINARY start --home "${BASE_HOME}/validator-5" --chain-id "$CHAIN_ID" \
    --minimum-gas-prices="10000000000${DENOM}" --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-5.log" 2>&1 &
  echo "  validator-5  PID: $!"

  sleep 8
  RUNNING=$(ps aux | grep "energychaind start" | grep -v grep | wc -l | tr -d ' ')
  echo "  运行中节点: ${RUNNING}/2"
fi

echo ""
echo "=============================================="
echo "  部署完成"
echo "=============================================="
echo ""
echo "  validator-4: RPC=26657 EVM=8545 地址=${VAL_ADDRS[0]}"
echo "  validator-5: RPC=26667 EVM=8555 地址=${VAL_ADDRS[1]}"
echo ""
echo "  ── 下一步 ──"
echo ""
echo "  1. 等待同步 (catching_up = false):"
echo "     curl -s http://127.0.0.1:26657/status | jq '.result.sync_info'"
echo ""
echo "  2. 在 Ubuntu 上转账 (每个 2M ECY):"
echo "     energychaind tx bank send validator0 ${VAL_ADDRS[0]} 2000000000000000000000000uecy \\"
echo "       --fees 500000000000000000uecy --gas 500000 --chain-id ${CHAIN_ID} \\"
echo "       --keyring-backend test --home ~/.energychain-production/validator-0 --node tcp://127.0.0.1:26697 -y"
echo ""
echo "     energychaind tx bank send validator0 ${VAL_ADDRS[1]} 2000000000000000000000000uecy \\"
echo "       --fees 500000000000000000uecy --gas 500000 --chain-id ${CHAIN_ID} \\"
echo "       --keyring-backend test --home ~/.energychain-production/validator-0 --node tcp://127.0.0.1:26697 -y"
echo ""
echo "  3. 回到本机注册验证者 (JSON 文件格式):"
echo ""
echo "     cat > /tmp/validator4.json << 'ENDJSON'"
echo "     {"
echo "       \"pubkey\": \$(energychaind comet show-validator --home ${BASE_HOME}/validator-4),"
echo "       \"amount\": \"1000000000000000000000000uecy\","
echo "       \"moniker\": \"validator-4\","
echo "       \"commission-rate\": \"0.10\","
echo "       \"commission-max-rate\": \"0.20\","
echo "       \"commission-max-change-rate\": \"0.01\","
echo "       \"min-self-delegation\": \"1\""
echo "     }"
echo "     ENDJSON"
echo ""
echo "     energychaind tx staking create-validator /tmp/validator4.json \\"
echo "       --from validator4 --fees 500000000000000000uecy --gas 500000 \\"
echo "       --chain-id ${CHAIN_ID} --keyring-backend test \\"
echo "       --home ${BASE_HOME}/validator-4 --node tcp://${SEED_IP}:26687 -y"
echo ""
echo "  注意: 注册后两台机器的验证者都必须保持运行!"
echo "=============================================="
