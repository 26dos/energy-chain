# EnergyChain 多机部署指南 — 新增验证者节点

## 目录

- [概述](#概述)
- [扩展后网络拓扑](#扩展后网络拓扑)
- [端口分配总览](#端口分配总览)
- [第一部分: Ubuntu 机器操作](#第一部分-ubuntu-机器操作)
- [第二部分: iMac 机器操作](#第二部分-imac-机器操作)
- [第三部分: 跨机注册验证者](#第三部分-跨机注册验证者)
- [第四部分: 验证与监控](#第四部分-验证与监控)
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
                     │  连接方式: seeds=<seed-id>@192.168.31.71:26656                 │
                     │  + persistent_peers 指向 Ubuntu 的 sentry 节点                 │
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

iMac 上只有 2 个节点，不存在端口冲突，可以使用默认端口范围。

---

## 第一部分: Ubuntu 机器操作

> 以下命令在 Ubuntu (192.168.31.71) 上执行

### 1.1 获取 Seed 节点信息

```bash
# 获取 seed 节点 ID (这个值在后续 iMac 配置中要用到)
SEED_ID=$(energychaind comet show-node-id --home ~/.energychain-production/seed)
echo "Seed Node ID: ${SEED_ID}"
echo "Seed 连接地址: ${SEED_ID}@192.168.31.71:26656"
```

记下输出的 Seed 连接地址，格式为 `<node-id>@192.168.31.71:26656`，后面在 iMac 配置时需要。

### 1.2 获取 Sentry 节点信息 (可选, 增加连接可靠性)

```bash
SENTRY0_ID=$(energychaind comet show-node-id --home ~/.energychain-production/sentry-0)
SENTRY1_ID=$(energychaind comet show-node-id --home ~/.energychain-production/sentry-1)
echo "Sentry-0: ${SENTRY0_ID}@192.168.31.71:26666"
echo "Sentry-1: ${SENTRY1_ID}@192.168.31.71:26676"
```

### 1.3 导出 Genesis 文件

将 genesis.json 拷贝到 iMac 可以访问的位置:

```bash
# 方式 A: 通过 scp 直接传到 iMac
scp ~/.energychain-production/validator-0/config/genesis.json \
    oem@192.168.31.39:~/genesis.json

# 方式 B: 如果 scp 不方便, 先复制到当前目录再用其他方式传输
cp ~/.energychain-production/validator-0/config/genesis.json ~/genesis.json
# 然后通过 U 盘、共享文件夹、AirDrop 等方式传到 iMac
```

### 1.4 确认防火墙允许 P2P 端口

确保 Ubuntu 的防火墙允许来自内网的 P2P 连接:

```bash
# 检查防火墙状态
sudo ufw status

# 如果 ufw 是 active 状态, 需要放行 seed 和 sentry 的 P2P 端口
sudo ufw allow from 192.168.31.0/24 to any port 26656 proto tcp  # seed
sudo ufw allow from 192.168.31.0/24 to any port 26666 proto tcp  # sentry-0
sudo ufw allow from 192.168.31.0/24 to any port 26676 proto tcp  # sentry-1

# 如果 ufw 是 inactive, 则无需操作 (默认所有端口开放)
```

### 1.5 验证 P2P 端口可达

在 Ubuntu 上确认 seed 节点的 P2P 端口正在监听:

```bash
ss -tlnp | grep 26656
# 应看到 0.0.0.0:26656 LISTEN
```

---

## 第二部分: iMac 机器操作

> 以下命令在 iMac (192.168.31.39) 上执行

### 2.1 安装前置依赖

```bash
# 安装 Homebrew (如果没有)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Go (需要 1.23+)
brew install go
go version  # 确认版本 >= 1.23

# 安装 jq
brew install jq

# 安装 git (Xcode Command Line Tools 通常已自带)
git --version
```

### 2.2 拉取代码并编译

```bash
# 克隆代码仓库
cd ~/Desktop
git clone https://github.com/YOUR_ORG/energy-chain.git
cd energy-chain

# 编译 energychaind 二进制文件
cd chain && go install ./cmd/energychaind && cd ..

# 确认安装成功
export PATH="$HOME/go/bin:$PATH"
energychaind version
```

> 建议将 `export PATH="$HOME/go/bin:$PATH"` 加入 `~/.zshrc` 以永久生效。

### 2.3 运行部署脚本

在 iMac 上运行自动化脚本来初始化、配置并启动两个验证者节点:

```bash
# 确保先把 genesis.json 放到 ~/genesis.json (从 Ubuntu 拷贝过来的)
# 确保已获取 Ubuntu seed 节点 ID

# 运行部署脚本
bash scripts/deploy_remote_validators.sh \
    --seed-id "<从1.1步获取的seed-node-id>" \
    --seed-ip "192.168.31.71" \
    --genesis ~/genesis.json
```

如果不使用脚本，也可以按以下手动步骤操作。

### 2.4 手动部署步骤 (替代 2.3 脚本)

#### 2.4.1 初始化节点

```bash
BINARY="energychaind"
BASE_HOME="$HOME/.energychain-production"
CHAIN_ID="energychain_9001-1"
KEYRING="test"
KEYALGO="eth_secp256k1"

# 初始化 validator-4
$BINARY init "validator-4" --chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-4"
$BINARY config set client chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-4"
$BINARY config set client keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-4"

# 初始化 validator-5
$BINARY init "validator-5" --chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-5"
$BINARY config set client chain-id "$CHAIN_ID" --home "${BASE_HOME}/validator-5"
$BINARY config set client keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-5"
```

#### 2.4.2 复制 Genesis 文件

```bash
# 用从 Ubuntu 拷贝过来的 genesis.json 覆盖默认的
cp ~/genesis.json "${BASE_HOME}/validator-4/config/genesis.json"
cp ~/genesis.json "${BASE_HOME}/validator-5/config/genesis.json"
```

#### 2.4.3 创建验证者密钥

```bash
# 创建 validator-4 的密钥
$BINARY keys add validator4 \
    --keyring-backend "$KEYRING" \
    --algo "$KEYALGO" \
    --home "${BASE_HOME}/validator-4"

# 创建 validator-5 的密钥
$BINARY keys add validator5 \
    --keyring-backend "$KEYRING" \
    --algo "$KEYALGO" \
    --home "${BASE_HOME}/validator-5"

# 记录地址 (后面转账用)
VAL4_ADDR=$($BINARY keys show validator4 --keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-4" --address)
VAL5_ADDR=$($BINARY keys show validator5 --keyring-backend "$KEYRING" --home "${BASE_HOME}/validator-5" --address)
echo "Validator-4 地址: ${VAL4_ADDR}"
echo "Validator-5 地址: ${VAL5_ADDR}"
```

**重要**: 务必记录下这两个地址，后续在 Ubuntu 上转账时需要。

#### 2.4.4 配置网络连接

将下面命令中的 `<SEED_ID>` 替换为第 1.1 步获取的 Seed 节点 ID。`<SENTRY0_ID>` 和 `<SENTRY1_ID>` 替换为第 1.2 步获取的 Sentry 节点 ID (可选)。

```bash
UBUNTU_IP="192.168.31.71"
SEED_ID="<从Ubuntu获取的seed-node-id>"
# 可选: SENTRY0_ID="<sentry-0-node-id>"
# 可选: SENTRY1_ID="<sentry-1-node-id>"

# macOS 的 sed -i 需要 '' 参数
sedi() { sed -i '' "$@"; }

# ── validator-4: P2P=26656, RPC=26657, EVM=8545 ──
V4_CFG="${BASE_HOME}/validator-4/config/config.toml"
V4_APP="${BASE_HOME}/validator-4/config/app.toml"

# P2P 使用默认 26656, RPC 使用默认 26657, 无需改端口
# 配置 seeds 连接到 Ubuntu 的 seed 节点
sedi "s|seeds = \"\"|seeds = \"${SEED_ID}@${UBUNTU_IP}:26656\"|" "$V4_CFG"
# 可选: 添加 sentry-0 作为 persistent_peer 增加可靠性
# sedi "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY0_ID}@${UBUNTU_IP}:26666\"|" "$V4_CFG"
sedi 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$V4_CFG"
sedi 's|addr_book_strict = true|addr_book_strict = false|' "$V4_CFG"
sedi 's|prometheus = false|prometheus = true|' "$V4_CFG"

# EVM JSON-RPC (默认端口 8545)
sedi '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$V4_APP"
sedi '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$V4_APP"
# 设置 min gas price
sedi "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000uecy\"|" "$V4_APP"

echo "validator-4 配置完成: P2P=26656 RPC=26657 EVM=8545"

# ── validator-5: P2P=26666, RPC=26667, EVM=8555 ──
V5_CFG="${BASE_HOME}/validator-5/config/config.toml"
V5_APP="${BASE_HOME}/validator-5/config/app.toml"

# 修改端口避免与 validator-4 冲突
sedi "s|laddr = \"tcp://0.0.0.0:26656\"|laddr = \"tcp://0.0.0.0:26666\"|" "$V5_CFG"
sedi "s|laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://127.0.0.1:26667\"|" "$V5_CFG"
sedi "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:6061\"|" "$V5_CFG"
# 配置 seeds
sedi "s|seeds = \"\"|seeds = \"${SEED_ID}@${UBUNTU_IP}:26656\"|" "$V5_CFG"
# 可选: 添加 sentry-1 作为 persistent_peer
# sedi "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY1_ID}@${UBUNTU_IP}:26676\"|" "$V5_CFG"
sedi 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$V5_CFG"
sedi 's|addr_book_strict = true|addr_book_strict = false|' "$V5_CFG"
sedi 's|prometheus = false|prometheus = true|' "$V5_CFG"

# 修改 app.toml 端口
sedi "s|address = \"tcp://localhost:1317\"|address = \"tcp://127.0.0.1:1318\"|" "$V5_APP"
sedi "s|address = \"localhost:9090\"|address = \"127.0.0.1:9190\"|" "$V5_APP"
sedi "s|address = \"127.0.0.1:8545\"|address = \"127.0.0.1:8555\"|" "$V5_APP"
sedi "s|ws-address = \"127.0.0.1:8546\"|ws-address = \"127.0.0.1:8556\"|" "$V5_APP"
sedi '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$V5_APP"
sedi '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$V5_APP"
sedi "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000uecy\"|" "$V5_APP"

echo "validator-5 配置完成: P2P=26666 RPC=26667 EVM=8555"
```

#### 2.4.5 启动节点并同步

```bash
LOG_DIR="${BASE_HOME}/logs"
mkdir -p "$LOG_DIR"

# 启动 validator-4
nohup energychaind start \
    --home "${BASE_HOME}/validator-4" \
    --chain-id "energychain_9001-1" \
    --minimum-gas-prices="10000000000uecy" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-4.log" 2>&1 &
echo "validator-4 PID: $!"

sleep 3

# 启动 validator-5
nohup energychaind start \
    --home "${BASE_HOME}/validator-5" \
    --chain-id "energychain_9001-1" \
    --minimum-gas-prices="10000000000uecy" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-5.log" 2>&1 &
echo "validator-5 PID: $!"
```

#### 2.4.6 等待区块同步

节点启动后需要先同步到最新区块高度才能注册验证者。

```bash
# 查看同步状态 (validator-4 使用默认 RPC 端口 26657)
curl -s http://127.0.0.1:26657/status | jq '{
  catching_up: .result.sync_info.catching_up,
  latest_block_height: .result.sync_info.latest_block_height,
  latest_block_time: .result.sync_info.latest_block_time
}'

# 查看 validator-5 同步状态 (RPC 端口 26667)
curl -s http://127.0.0.1:26667/status | jq '{
  catching_up: .result.sync_info.catching_up,
  latest_block_height: .result.sync_info.latest_block_height,
  latest_block_time: .result.sync_info.latest_block_time
}'
```

**等到两个节点的 `catching_up` 都变为 `false` 后再继续下一步。**

如果链已经运行了较长时间，同步可能需要几分钟到几十分钟。可以通过以下命令持续监控:

```bash
# 每 5 秒刷新一次同步进度
watch -n 5 'echo "=== validator-4 ===" && curl -s http://127.0.0.1:26657/status | jq ".result.sync_info" && echo "=== validator-5 ===" && curl -s http://127.0.0.1:26667/status | jq ".result.sync_info"'
```

---

## 第三部分: 跨机注册验证者

### 3.1 从 Ubuntu 向新验证者转账 (Ubuntu 上执行)

新验证者需要持有 ECY 代币才能质押。回到 Ubuntu 机器操作:

```bash
# 在 Ubuntu (192.168.31.71) 上执行
# 将 <VAL4_ADDR> 和 <VAL5_ADDR> 替换为第 2.4.3 步记录的地址

# 向 validator-4 转 2,000,000 ECY (2M, 其中 1M 用于质押, 1M 留作 gas)
energychaind tx bank send validator0 <VAL4_ADDR> \
    2000000000000000000000000uecy \
    --fees 500000000000000000uecy \
    --chain-id energychain_9001-1 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-0 \
    --node tcp://127.0.0.1:26697 \
    -y

# 等几秒让交易上链
sleep 6

# 向 validator-5 转 2,000,000 ECY
energychaind tx bank send validator0 <VAL5_ADDR> \
    2000000000000000000000000uecy \
    --fees 500000000000000000uecy \
    --chain-id energychain_9001-1 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-0 \
    --node tcp://127.0.0.1:26697 \
    -y
```

### 3.2 确认到账 (iMac 上执行)

```bash
# 在 iMac 上查询余额
energychaind query bank balances \
    $(energychaind keys show validator4 --keyring-backend test --home ~/.energychain-production/validator-4 --address) \
    --node tcp://127.0.0.1:26657

energychaind query bank balances \
    $(energychaind keys show validator5 --keyring-backend test --home ~/.energychain-production/validator-5 --address) \
    --node tcp://127.0.0.1:26667
```

确认两个账户都有余额后继续。

### 3.3 提交 create-validator 交易 (iMac 上执行)

```bash
# ── 注册 validator-4 ──
energychaind tx staking create-validator \
    --amount 1000000000000000000000000uecy \
    --pubkey $(energychaind comet show-validator --home ~/.energychain-production/validator-4) \
    --moniker "validator-4" \
    --chain-id energychain_9001-1 \
    --commission-rate "0.10" \
    --commission-max-rate "0.20" \
    --commission-max-change-rate "0.01" \
    --min-self-delegation "1" \
    --fees 500000000000000000uecy \
    --from validator4 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-4 \
    --node tcp://127.0.0.1:26657 \
    -y

echo "等待交易确认..."
sleep 6

# ── 注册 validator-5 ──
energychaind tx staking create-validator \
    --amount 1000000000000000000000000uecy \
    --pubkey $(energychaind comet show-validator --home ~/.energychain-production/validator-5) \
    --moniker "validator-5" \
    --chain-id energychain_9001-1 \
    --commission-rate "0.10" \
    --commission-max-rate "0.20" \
    --commission-max-change-rate "0.01" \
    --min-self-delegation "1" \
    --fees 500000000000000000uecy \
    --from validator5 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-5 \
    --node tcp://127.0.0.1:26667 \
    -y
```

---

## 第四部分: 验证与监控

### 4.1 确认验证者已加入 (任意机器)

```bash
# 查询所有活跃验证者 (在 Ubuntu 或 iMac 均可)
# Ubuntu 上:
curl -s http://127.0.0.1:26687/validators | jq '.result.validators | length'
# 应该返回 6 (原来 4 个 + 新增 2 个)

# 或通过 REST API 查看验证者详情:
curl -s http://192.168.31.71:1320/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED \
    | jq '.validators[] | {moniker: .description.moniker, tokens: .tokens, status: .status}'
```

### 4.2 检查新验证者出块状态

```bash
# 在 iMac 上查看 validator-4 的最新签名区块
curl -s http://127.0.0.1:26657/status | jq '{
  moniker: .result.node_info.moniker,
  latest_block_height: .result.sync_info.latest_block_height,
  catching_up: .result.sync_info.catching_up,
  voting_power: .result.validator_info.voting_power
}'

# 查看 validator-5
curl -s http://127.0.0.1:26667/status | jq '{
  moniker: .result.node_info.moniker,
  latest_block_height: .result.sync_info.latest_block_height,
  catching_up: .result.sync_info.catching_up,
  voting_power: .result.validator_info.voting_power
}'
```

`voting_power` 大于 0 表示已成功参与共识。

### 4.3 查看 P2P 连接数

```bash
# validator-4 的 P2P 连接
curl -s http://127.0.0.1:26657/net_info | jq '.result.n_peers'

# validator-5 的 P2P 连接
curl -s http://127.0.0.1:26667/net_info | jq '.result.n_peers'
```

### 4.4 查看日志

```bash
# 实时查看 validator-4 日志
tail -f ~/.energychain-production/logs/validator-4.log

# 实时查看 validator-5 日志
tail -f ~/.energychain-production/logs/validator-5.log
```

### 4.5 iMac 节点状态一览脚本

```bash
echo "========== iMac 验证者节点状态 =========="
echo ""
for node in validator-4 validator-5; do
    if pgrep -f "energychaind start.*${node}" > /dev/null 2>&1; then
        PID=$(pgrep -f "energychaind start.*${node}")
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

---

## 故障排除

### 节点无法连接到 Ubuntu 网络

**症状**: 日志中出现 `dial tcp 192.168.31.71:26656: connect: connection refused` 或一直 0 peers。

**排查步骤**:

```bash
# 1. 在 iMac 上测试网络连通性
nc -zv 192.168.31.71 26656

# 2. 在 Ubuntu 上确认 seed 端口在监听
ss -tlnp | grep 26656

# 3. 检查 Ubuntu 防火墙
sudo ufw status

# 4. 确认 iMac 上 config.toml 中的 seeds 配置正确
grep "seeds" ~/.energychain-production/validator-4/config/config.toml
```

### 节点同步卡住

**症状**: `catching_up` 始终为 `true`，区块高度不增长。

**排查步骤**:

```bash
# 1. 检查 P2P 连接数
curl -s http://127.0.0.1:26657/net_info | jq '.result.n_peers'
# 如果为 0, 说明没有连上任何节点

# 2. 检查日志中的错误
grep -i "error\|ERR" ~/.energychain-production/logs/validator-4.log | tail -20

# 3. 对比两边的 genesis.json 是否一致
md5 ~/.energychain-production/validator-4/config/genesis.json
# 在 Ubuntu 上:
md5sum ~/.energychain-production/validator-0/config/genesis.json
# 两个 hash 必须完全相同
```

### create-validator 交易失败

**常见错误及解决**:

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `insufficient funds` | 账户余额不足 | 在 Ubuntu 上再次转账: `energychaind tx bank send ...` |
| `provided fee < minimum global fee` | fees 太低 | 将 `--fees` 增加到 `500000000000000000uecy` |
| `validator already exist` | 已注册过 | 无需重复注册, 检查 `voting_power` 是否 > 0 |
| `account sequence mismatch` | 交易序号冲突 | 等几秒后重试 |
| `pubkey already associated` | 该节点公钥已注册 | 检查是否重复初始化了节点 |

### 验证者 voting_power 为 0

注册成功后 `voting_power` 为 0 表示尚未被选入活跃验证者集合:

```bash
# 检查验证者是否 bonded
energychaind query staking validators --node tcp://127.0.0.1:26657 | grep -A5 "validator-4"

# 如果状态是 BOND_STATUS_UNBONDED, 可能是质押量太少
# 增加质押:
energychaind tx staking delegate \
    $(energychaind keys show validator4 --keyring-backend test --home ~/.energychain-production/validator-4 --bech val --address) \
    500000000000000000000000uecy \
    --from validator4 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-4 \
    --fees 500000000000000000uecy \
    --chain-id energychain_9001-1 \
    --node tcp://127.0.0.1:26657 \
    -y
```

### 验证者被 jail (惩罚)

如果节点长时间离线导致被 jail:

```bash
# 检查是否被 jail
energychaind query staking validator \
    $(energychaind keys show validator4 --keyring-backend test --home ~/.energychain-production/validator-4 --bech val --address) \
    --node tcp://127.0.0.1:26657 | grep jailed

# 解除 jail (需要等待惩罚冷却期结束)
energychaind tx slashing unjail \
    --from validator4 \
    --keyring-backend test \
    --home ~/.energychain-production/validator-4 \
    --fees 500000000000000000uecy \
    --chain-id energychain_9001-1 \
    --node tcp://127.0.0.1:26657 \
    -y
```
