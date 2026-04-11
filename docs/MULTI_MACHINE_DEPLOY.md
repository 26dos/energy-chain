# EnergyChain 多机部署指南 — 新增验证者节点

## 目录

- [概述](#概述)
- [扩展后网络拓扑](#扩展后网络拓扑)
- [端口分配总览](#端口分配总览)
- [第一部分: Ubuntu 机器操作](#第一部分-ubuntu-机器操作)
- [第二部分: iMac 机器操作](#第二部分-imac-机器操作)
- [第三部分: 跨机注册验证者](#第三部分-跨机注册验证者)
- [第四部分: 验证与监控](#第四部分-验证与监控)
- [停止与重启](#停止与重启)
- [故障排除](#故障排除)

---

## 概述

在已有的 Ubuntu 单机 8 节点网络基础上，于另一台 iMac 上新增 2 个验证者节点 (validator-4, validator-5)，使其加入现有网络参与共识出块。

| 机器 | 内网 IP | 角色 |
|------|---------|------|
| Ubuntu 服务器 | 192.168.31.71 | seed, sentry-0, sentry-1, fullnode, validator-0~3 (已部署) |
| Apple iMac | 192.168.31.39 | validator-4, validator-5 (待部署) |

**核心原理**: 新验证者不需要参与创世 (gentx)，而是在链运行后通过 `create-validator` 交易动态加入验证者集合。步骤为:

1. 使用相同的 genesis.json 启动节点并同步区块
2. 从已有账户转入质押代币
3. 提交 `create-validator` 交易注册为验证者

> **重要警告**: 新验证者加入后，活跃验证者变为 6 个。BFT 共识要求在线投票权 > 2/3，即至少 5/6 的验证者必须在线。**这意味着 Ubuntu 和 iMac 两台机器都必须保持运行，任何一台完全关机都会导致链停止出块。** 如果需要维护某台机器，必须先将其验证者 unbond 或确保剩余在线投票权 > 2/3。

---

## 扩展后网络拓扑

```
                     ┌───────────────────────────────────────────────────────────────┐
                     │               Ubuntu (192.168.31.71)                          │
                     │                                                               │
                     │   ┌──────────┐                                                │
                     │   │   Seed   │ P2P: 26656 (0.0.0.0)                           │
                     │   └────┬─────┘                                                │
                     │        │                                                      │
                     │   ┌────┴──────────────┐                                       │
                     │   │                   │                                       │
                     │   ▼                   ▼                                       │
                     │ ┌──────────┐   ┌──────────┐                                   │
                     │ │ Sentry-0 │   │ Sentry-1 │                                   │
                     │ │ P2P:26666│   │ P2P:26676│                                   │
                     │ └──┬───┬──┘   └──┬───┬──┘                                    │
                     │    │   │         │   │                                        │
                     │    ▼   ▼         ▼   ▼                                        │
                     │  Val-0 Val-1   Val-2 Val-3   Fullnode                          │
                     │  :26696 :26706  :26716 :26726  :26686                          │
                     │                                                               │
                     └───────────────────────┬───────────────────────────────────────┘
                                             │
                                   LAN (192.168.31.x)
                                             │
                     ┌───────────────────────┴───────────────────────────────────────┐
                     │               iMac (192.168.31.39)                            │
                     │                                                               │
                     │         ┌──────────┐     ┌──────────┐                         │
                     │         │ Val-4    │     │ Val-5    │                          │
                     │         │ P2P:26656│     │ P2P:26666│                          │
                     │         │ EVM:8545 │     │ EVM:8555 │                          │
                     │         └──────────┘     └──────────┘                         │
                     │                                                               │
                     │  连接方式: persistent_peers 直连 Ubuntu 的 sentry 节点          │
                     └───────────────────────────────────────────────────────────────┘
```

---

## 端口分配总览

### Ubuntu (192.168.31.71) — 已有节点

| 节点 | P2P | RPC | EVM | WS | API | gRPC |
|------|-----|-----|-----|----|-----|------|
| seed | 26656 | — | — | — | — | — |
| sentry-0 | 26666 | 26667 | 8555 | 8556 | 1318 | 9190 |
| sentry-1 | 26676 | 26677 | 8565 | 8566 | 1319 | 9290 |
| fullnode | 26686 | 26687 | 8575 | 8576 | 1320 | 9390 |
| validator-0 | 26696 | 26697 | 8585 | 8586 | 1321 | 9490 |
| validator-1 | 26706 | 26707 | 8595 | 8596 | 1322 | 9590 |
| validator-2 | 26716 | 26717 | 8605 | 8606 | 1323 | 9690 |
| validator-3 | 26726 | 26727 | 8615 | 8616 | 1324 | 9790 |

### iMac (192.168.31.39) — 新增节点

| 节点 | P2P | RPC | EVM | WS | API | gRPC |
|------|-----|-----|-----|----|-----|------|
| validator-4 | 26656 | 26657 | 8545 | 8546 | 1317 | 9090 |
| validator-5 | 26666 | 26667 | 8555 | 8556 | 1318 | 9190 |

---

## 第一部分: Ubuntu 机器操作

> 以下命令在 Ubuntu (192.168.31.71) 上执行

### 1.1 获取节点信息 (必须)

```bash
# Seed 节点 ID
SEED_ID=$(energychaind comet show-node-id --home ~/.energychain-production/seed)
echo "Seed: ${SEED_ID}@192.168.31.71:26656"

# Sentry 节点 ID (跨机连接必须使用, 不是可选!)
SENTRY0_ID=$(energychaind comet show-node-id --home ~/.energychain-production/sentry-0)
SENTRY1_ID=$(energychaind comet show-node-id --home ~/.energychain-production/sentry-1)
echo "Sentry-0: ${SENTRY0_ID}@192.168.31.71:26666"
echo "Sentry-1: ${SENTRY1_ID}@192.168.31.71:26676"
```

**务必记下以上三个 ID**，iMac 配置时需要。Sentry ID 是跨机连接的关键 — seed 节点返回的对等地址是 127.0.0.1，iMac 无法通过 seed 发现其他节点，必须通过 persistent_peers 直连 sentry。

### 1.2 导出 Genesis 文件

```bash
# 从 iMac 终端拉取 (推荐, 因为 iMac 可能未开 SSH)
# 在 iMac 上执行:
scp oem@192.168.31.71:~/.energychain-production/validator-0/config/genesis.json ~/genesis.json
```

### 1.3 确认防火墙允许 P2P 端口

```bash
sudo ufw status
# 如果 active, 放行 sentry 端口:
sudo ufw allow from 192.168.31.0/24 to any port 26666 proto tcp
sudo ufw allow from 192.168.31.0/24 to any port 26676 proto tcp
```

---

## 第二部分: iMac 机器操作

> 以下命令在 iMac (192.168.31.39) 上执行

### 2.1 安装前置依赖

```bash
brew install go jq
go version  # 确认 >= 1.23
```

### 2.2 拉取代码并编译

```bash
cd ~/Desktop
git clone https://github.com/YOUR_ORG/energy-chain.git
cd energy-chain
cd chain && go install ./cmd/energychaind && cd ..
export PATH="$HOME/go/bin:$PATH"
energychaind version
```

> 建议将 `export PATH="$HOME/go/bin:$PATH"` 加入 `~/.zshrc` 以永久生效。

### 2.3 使用脚本部署 (推荐)

```bash
# 确保 genesis.json 已拷贝到 ~/genesis.json
# SENTRY0_ID 和 SENTRY1_ID 是必须参数!

bash scripts/deploy_remote_validators.sh \
    --seed-id "<SEED_ID>" \
    --seed-ip "192.168.31.71" \
    --genesis ~/genesis.json \
    --sentry0-id "<SENTRY0_ID>" \
    --sentry1-id "<SENTRY1_ID>"
```

### 2.4 手动部署步骤 (替代 2.3 脚本)

#### 2.4.1 初始化节点

```bash
BINARY="energychaind"
BASE_HOME="$HOME/.energychain-production"
CHAIN_ID="energychain_9001-1"
KEYRING="test"
KEYALGO="eth_secp256k1"

for idx in 4 5; do
    $BINARY init "validator-${idx}" --chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-${idx}"
    $BINARY config set client chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-${idx}"
    $BINARY config set client keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-${idx}"
done
```

#### 2.4.2 复制 Genesis 文件

```bash
cp ~/genesis.json "${BASE_HOME}/validator-4/config/genesis.json"
cp ~/genesis.json "${BASE_HOME}/validator-5/config/genesis.json"
```

#### 2.4.3 创建验证者密钥

```bash
for idx in 4 5; do
    $BINARY keys add "validator${idx}" \
        --keyring-backend "$KEYRING" \
        --algo "$KEYALGO" \
        --home "${BASE_HOME}/validator-${idx}"
done

VAL4_ADDR=$($BINARY keys show validator4 --keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-4" --address)
VAL5_ADDR=$($BINARY keys show validator5 --keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-5" --address)
echo "Validator-4 地址: ${VAL4_ADDR}"
echo "Validator-5 地址: ${VAL5_ADDR}"
```

**务必记录这两个地址**, 后续在 Ubuntu 上转账时需要。

#### 2.4.4 配置网络连接

```bash
UBUNTU_IP="192.168.31.71"
SEED_ID="<seed-node-id>"
SENTRY0_ID="<sentry-0-node-id>"
SENTRY1_ID="<sentry-1-node-id>"

sedi() { sed -i '' "$@"; }

SENTRY_PEERS="${SENTRY0_ID}@${UBUNTU_IP}:26666,${SENTRY1_ID}@${UBUNTU_IP}:26676"

# ── validator-4: P2P=26656, RPC=26657, EVM=8545 ──
V4_CFG="${BASE_HOME}/validator-4/config/config.toml"
V4_APP="${BASE_HOME}/validator-4/config/app.toml"

sedi "s|seeds = \"\"|seeds = \"${SEED_ID}@${UBUNTU_IP}:26656\"|" "$V4_CFG"
sedi "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY_PEERS}\"|" "$V4_CFG"
sedi 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$V4_CFG"
sedi 's|addr_book_strict = true|addr_book_strict = false|' "$V4_CFG"
sedi 's|prometheus = false|prometheus = true|' "$V4_CFG"
sedi '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$V4_APP"
sedi '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$V4_APP"
sedi "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000uecy\"|" "$V4_APP"

echo "validator-4 配置完成: P2P=26656 RPC=26657 EVM=8545"

# ── validator-5: P2P=26666, RPC=26667, EVM=8555 ──
V5_CFG="${BASE_HOME}/validator-5/config/config.toml"
V5_APP="${BASE_HOME}/validator-5/config/app.toml"

sedi "s|laddr = \"tcp://0.0.0.0:26656\"|laddr = \"tcp://0.0.0.0:26666\"|" "$V5_CFG"
sedi "s|laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://127.0.0.1:26667\"|" "$V5_CFG"
sedi "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:6061\"|" "$V5_CFG"
sedi "s|seeds = \"\"|seeds = \"${SEED_ID}@${UBUNTU_IP}:26656\"|" "$V5_CFG"
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
sedi "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000uecy\"|" "$V5_APP"

echo "validator-5 配置完成: P2P=26666 RPC=26667 EVM=8555"
```

#### 2.4.5 快速同步 (首次部署链已运行较久时)

如果链已积累大量区块，逐块重放会很慢。可以直接从 Ubuntu 拷贝数据:

```bash
# 先备份 iMac 各节点自己的密钥
for idx in 4 5; do
    cp ${BASE_HOME}/validator-${idx}/config/priv_validator_key.json /tmp/val${idx}_key.json
    cp ${BASE_HOME}/validator-${idx}/config/node_key.json /tmp/val${idx}_nodekey.json
done

# 从 Ubuntu 拷贝 fullnode 数据
scp -r oem@192.168.31.71:~/.energychain-production/fullnode/data ${BASE_HOME}/validator-4/data
cp -r ${BASE_HOME}/validator-4/data ${BASE_HOME}/validator-5/data

# 恢复各自的密钥
for idx in 4 5; do
    cp /tmp/val${idx}_key.json ${BASE_HOME}/validator-${idx}/config/priv_validator_key.json
    cp /tmp/val${idx}_nodekey.json ${BASE_HOME}/validator-${idx}/config/node_key.json
    # 重置签名状态避免双签
    echo '{"height":"0","round":0,"step":0}' > ${BASE_HOME}/validator-${idx}/data/priv_validator_state.json
done
```

#### 2.4.6 启动节点

```bash
LOG_DIR="${BASE_HOME}/logs"
mkdir -p "$LOG_DIR"

nohup energychaind start \
    --home "${BASE_HOME}/validator-4" \
    --chain-id "energychain_9001-1" \
    --minimum-gas-prices="10000000000uecy" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-4.log" 2>&1 &
echo "validator-4 PID: $!"

sleep 3

nohup energychaind start \
    --home "${BASE_HOME}/validator-5" \
    --chain-id "energychain_9001-1" \
    --minimum-gas-prices="10000000000uecy" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-5.log" 2>&1 &
echo "validator-5 PID: $!"
```

#### 2.4.7 等待区块同步

```bash
# 通过 Ubuntu fullnode RPC 查询 (更可靠)
watch -n 5 'echo "=== validator-4 ===" && curl -s http://127.0.0.1:26657/status | jq "{height: .result.sync_info.latest_block_height, catching_up: .result.sync_info.catching_up}" && echo "=== validator-5 ===" && curl -s http://127.0.0.1:26667/status | jq "{height: .result.sync_info.latest_block_height, catching_up: .result.sync_info.catching_up}"'
```

**等到两个节点的 `catching_up` 都变为 `false` 后再继续下一步。**

---

## 第三部分: 跨机注册验证者

### 3.1 从 Ubuntu 向新验证者转账 (Ubuntu 上执行)

```bash
# 将 <VAL4_ADDR> 和 <VAL5_ADDR> 替换为第 2.4.3 步记录的地址

# 向 validator-4 转 2,000,000 ECY
energychaind tx bank send validator0 <VAL4_ADDR> \
    2000000000000000000000000uecy \
    --fees 500000000000000000uecy \
    --gas 500000 \
    --chain-id energychain_9001-1 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-0 \
    --node tcp://127.0.0.1:26697 \
    -y

sleep 6

# 向 validator-5 转 2,000,000 ECY
energychaind tx bank send validator0 <VAL5_ADDR> \
    2000000000000000000000000uecy \
    --fees 500000000000000000uecy \
    --gas 500000 \
    --chain-id energychain_9001-1 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-0 \
    --node tcp://127.0.0.1:26697 \
    -y
```

### 3.2 确认到账 (iMac 上执行)

```bash
# 使用 Ubuntu fullnode RPC 查询 (更可靠)
energychaind query bank balances \
    $(energychaind keys show validator4 --keyring-backend test --home ~/.energychain-production/validator-4 --address) \
    --node tcp://192.168.31.71:26687

energychaind query bank balances \
    $(energychaind keys show validator5 --keyring-backend test --home ~/.energychain-production/validator-5 --address) \
    --node tcp://192.168.31.71:26687
```

### 3.3 提交 create-validator 交易 (iMac 上执行)

> **注意**: 此版本 Cosmos SDK 的 `create-validator` 命令需要传入 JSON 文件，不支持命令行参数。

```bash
# ── 创建 validator-4 配置文件并注册 ──
cat > /tmp/validator4.json << EOF
{
  "pubkey": $(energychaind comet show-validator --home ~/.energychain-production/validator-4),
  "amount": "1000000000000000000000000uecy",
  "moniker": "validator-4",
  "commission-rate": "0.10",
  "commission-max-rate": "0.20",
  "commission-max-change-rate": "0.01",
  "min-self-delegation": "1"
}
EOF

energychaind tx staking create-validator /tmp/validator4.json \
    --from validator4 \
    --fees 500000000000000000uecy \
    --gas 500000 \
    --chain-id energychain_9001-1 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-4 \
    --node tcp://192.168.31.71:26687 \
    -y

echo "等待交易确认..."
sleep 6

# ── 创建 validator-5 配置文件并注册 ──
cat > /tmp/validator5.json << EOF
{
  "pubkey": $(energychaind comet show-validator --home ~/.energychain-production/validator-5),
  "amount": "1000000000000000000000000uecy",
  "moniker": "validator-5",
  "commission-rate": "0.10",
  "commission-max-rate": "0.20",
  "commission-max-change-rate": "0.01",
  "min-self-delegation": "1"
}
EOF

energychaind tx staking create-validator /tmp/validator5.json \
    --from validator5 \
    --fees 500000000000000000uecy \
    --gas 500000 \
    --chain-id energychain_9001-1 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-5 \
    --node tcp://192.168.31.71:26687 \
    -y
```

### 3.4 验证交易是否成功

```bash
# 用返回的 txhash 查询, 确认 code 为 0
energychaind query tx <TXHASH> --node tcp://192.168.31.71:26687 | grep -E "code|raw_log"
# code: 0 表示成功
```

---

## 第四部分: 验证与监控

### 4.1 确认验证者已加入

```bash
# 查看所有活跃验证者 (URL 加引号, zsh 中 ? 是特殊字符)
curl -s "http://192.168.31.71:1320/cosmos/staking/v1beta1/validators" \
    | jq '.validators[] | {moniker: .description.moniker, status: .status}'
# 应该看到 6 个 BOND_STATUS_BONDED 的验证者
```

### 4.2 检查 voting_power

```bash
curl -s http://127.0.0.1:26657/status | jq '{
  moniker: .result.node_info.moniker,
  height: .result.sync_info.latest_block_height,
  catching_up: .result.sync_info.catching_up,
  voting_power: .result.validator_info.voting_power
}'
```

`voting_power` 大于 0 表示已成功参与共识。

### 4.3 iMac 节点状态一览

```bash
echo "========== iMac 验证者节点状态 =========="
for node in validator-4 validator-5; do
    PID=$(pgrep -f "energychaind start.*${node}" || true)
    if [ -n "$PID" ]; then
        echo "  [运行中] ${node} (PID: ${PID})"
    else
        echo "  [已停止] ${node}"
    fi
done
echo ""
echo "--- validator-4 (RPC 26657) ---"
curl -s http://127.0.0.1:26657/status 2>/dev/null | jq '{height: .result.sync_info.latest_block_height, catching_up: .result.sync_info.catching_up, voting_power: .result.validator_info.voting_power}' 2>/dev/null || echo "  无法连接"
echo ""
echo "--- validator-5 (RPC 26667) ---"
curl -s http://127.0.0.1:26667/status 2>/dev/null | jq '{height: .result.sync_info.latest_block_height, catching_up: .result.sync_info.catching_up, voting_power: .result.validator_info.voting_power}' 2>/dev/null || echo "  无法连接"
echo "========================================"
```

---

## 停止与重启

> **警告**: 6 个验证者全部 BONDED 后，至少需要 5 个在线才能出块。停止 iMac 节点前必须确认不会导致链停。

### 停止 iMac 上的节点

```bash
pkill -f "energychaind start" || true
```

### 重启 iMac 上的节点

```bash
LOG_DIR="$HOME/.energychain-production/logs"

nohup energychaind start \
    --home ~/.energychain-production/validator-4 \
    --chain-id energychain_9001-1 \
    --minimum-gas-prices="10000000000uecy" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-4.log" 2>&1 &

sleep 3

nohup energychaind start \
    --home ~/.energychain-production/validator-5 \
    --chain-id energychain_9001-1 \
    --minimum-gas-prices="10000000000uecy" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-5.log" 2>&1 &
```

已注册的验证者重启后会自动恢复出块，无需再次执行 `create-validator`。

### 全网停止与重启 (两台机器都要操作)

如果需要全网重启，**必须两台机器的节点都启动后链才能恢复**:

```bash
# 1. Ubuntu: 启动 8 个节点 (参考 DEPLOYMENT.md)
# 2. iMac: 启动 2 个节点 (上面的重启命令)
# 3. 等待所有节点连接, 链自动恢复出块
```

---

## 故障排除

### 节点无法连接到 Ubuntu 网络

**症状**: 日志中反复出现 "No addresses to dial. Falling back to seeds"

**原因**: 只配了 seeds 没配 persistent_peers。seed 节点返回的地址都是 127.0.0.1，跨机无法连通。

**解决**:

```bash
# 确认 persistent_peers 已配置为 Ubuntu sentry 节点
grep "^persistent_peers" ~/.energychain-production/validator-4/config/config.toml
# 应该包含: <sentry0-id>@192.168.31.71:26666,<sentry1-id>@192.168.31.71:26676

# 如果没有, 手动添加:
PEERS="<SENTRY0_ID>@192.168.31.71:26666,<SENTRY1_ID>@192.168.31.71:26676"
sed -i '' "s|^persistent_peers = .*|persistent_peers = \"${PEERS}\"|" ~/.energychain-production/validator-4/config/config.toml
sed -i '' "s|^persistent_peers = .*|persistent_peers = \"${PEERS}\"|" ~/.energychain-production/validator-5/config/config.toml
# 重启节点
```

### create-validator 报错 "unknown flag: --amount"

**原因**: 此版本 Cosmos SDK 要求通过 JSON 文件传参。

**解决**: 参考第三部分 3.3 的 JSON 文件格式。

### create-validator 报错 "out of gas"

**原因**: 默认 gas 上限 200000 不够。

**解决**: 添加 `--gas 500000` 参数。

### 链停止出块 (全网)

**症状**: 所有节点 consensus 超时, 区块高度不增长。

**最可能原因**: 6 个验证者中有 2 个以上离线, 在线投票权 <= 2/3。

**解决**:

```bash
# 1. 确认两台机器上所有验证者都在运行
# Ubuntu:
ps aux | grep "energychaind start" | grep -v grep | wc -l  # 应该是 8

# iMac:
ps aux | grep "energychaind start" | grep -v grep | wc -l  # 应该是 2

# 2. 如果有节点没运行, 重新启动

# 3. 如果只想在 Ubuntu 单机运行, 需要先将 iMac 验证者 unbond:
# (需要链正在出块时才能执行此操作)
```

### 验证者被 jail (惩罚)

节点长时间离线会被 jail:

```bash
energychaind tx slashing unjail \
    --from validator4 --keyring-backend test \
    --home ~/.energychain-production/validator-4 \
    --fees 500000000000000000uecy --gas 500000 \
    --chain-id energychain_9001-1 \
    --node tcp://192.168.31.71:26687 -y
```

### 常见错误速查表

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `No addresses to dial` | 只配了 seeds, 缺少 persistent_peers | 配置 sentry 的 persistent_peers |
| `out of gas` | 默认 gas 200000 不够 | 添加 `--gas 500000` |
| `unknown flag: --amount` | create-validator 需要 JSON 文件 | 用 JSON 文件格式 (见 3.3) |
| `insufficient funds` | 余额不足 | 在 Ubuntu 上再转账 |
| `provided fee < minimum global fee` | fees 太低 | 用 `500000000000000000uecy` |
| `resource temporarily unavailable` | 数据库锁未释放 | `pkill -9` 后删除 LOCK 文件 |
| `auth failure: mismatch` | persistent_peers 中 ID 不匹配 | 重新获取节点 ID 并更新配置 |
| `consensus timeout, height stuck` | 在线投票权不足 2/3 | 确保两台机器的验证者都在运行 |
