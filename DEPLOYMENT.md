# Energy Chain 生产级部署方案

## 目录

- [1. 架构总览](#1-架构总览)
- [2. 硬件与网络规划](#2-硬件与网络规划)
- [3. 环境准备](#3-环境准备)
- [4. 编译链二进制](#4-编译链二进制)
- [5. 创世文件生成](#5-创世文件生成)
- [6. 节点部署 — Ubuntu 机器](#6-节点部署--ubuntu-机器)
- [7. 节点部署 — Mac 验证者](#7-节点部署--mac-验证者)
- [8. Systemd 服务管理](#8-systemd-服务管理)
- [9. Blockscout 区块浏览器部署](#9-blockscout-区块浏览器部署)
- [10. Ping.pub 浏览器部署](#10-pingpub-浏览器部署)
- [11. DEX 部署](#11-dex-部署)
- [12. Nginx 反向代理](#12-nginx-反向代理)
- [13. 钱包生成与转账](#13-钱包生成与转账)
- [14. 数据批量上链](#14-数据批量上链)
- [15. DEX 操作与刷交易](#15-dex-操作与刷交易)
- [16. 手动测试命令集](#16-手动测试命令集)
- [17. 监控与运维](#17-监控与运维)
- [18. 安全加固清单](#18-安全加固清单)

---

## 1. 架构总览

```
                         ┌─────────────────┐
                         │   Seed Node     │  ← 节点发现 (Ubuntu)
                         │  P2P: 26656     │
                         └────────┬────────┘
                                  │ P2P
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │  Sentry Node 1  │ │  Sentry Node 2  │ │   Full Node     │
     │  P2P: 26666     │ │  P2P: 26676     │ │  P2P: 26686     │
     │  (保护Val0/1)   │ │  (保护Val2/Mac) │ │  EVM RPC: 8575  │
     └───────┬─────────┘ └───────┬─────────┘ └───────┬─────────┘
             │ 私有网络          │                    │
     ┌───────┼───────┐   ┌──────┼──────┐        用户/DApp
     ▼       ▼       │   ▼      ▼      │        MetaMask
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Val-0    │ │ Val-1    │ │ Val-2    │ │ Val-3 (Mac)  │
│ Ubuntu   │ │ Ubuntu   │ │ Ubuntu   │ │ M1 Max       │
│ P2P:26696│ │ P2P:26706│ │ P2P:26716│ │ P2P:26656    │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘

     ┌──────────────────────────────────────────┐
     │         Ubuntu 附加服务                    │
     │  Blockscout   :4000 (EVM 区块浏览器)      │
     │  Ping.pub     :8080 (Cosmos 浏览器)       │
     │  DEX Frontend :3000 (EnergySwap)          │
     │  Nginx        :80   (反向代理)            │
     │  Prometheus   :9091 (监控)                │
     │  Grafana      :3001 (仪表盘)              │
     └──────────────────────────────────────────┘
```

## 2. 硬件与网络规划

### 机器信息

| 机器 | 角色 | 配置 |
|------|------|------|
| Ubuntu | Seed + Sentry×2 + FullNode + Validator×3 + 浏览器 + DEX | 24核 / 126GB / 3090 / 4T SSD |
| Mac M1 Max | Validator-3 | M1 Max / 本地开发机 |

### 链参数

| 参数 | 值 |
|------|-----|
| Chain ID (Cosmos) | `energychain_9001-1` |
| Chain ID (EVM) | `262144` |
| 原生代币 | `uecy` (micro) / `ecy` (display, 18位精度) |
| Bech32 前缀 | `energy` |
| 密钥算法 | `eth_secp256k1` |
| 最低 Gas 价格 | `10000000000uecy` (10 Gwei) |
| 节点 Home 目录 | `~/.energychaind` |

### 端口规划 (Ubuntu)

| 节点 | P2P | CometBFT RPC | gRPC | REST API | EVM HTTP | EVM WS |
|------|-----|-------------|------|----------|----------|--------|
| seed | 26656 | 26657 | 9090 | 1317 | 8545 | 8546 |
| sentry-0 | 26666 | 26667 | 9190 | 1318 | 8555 | 8556 |
| sentry-1 | 26676 | 26677 | 9290 | 1319 | 8565 | 8566 |
| fullnode | 26686 | 26687 | 9390 | 1320 | 8575 | 8576 |
| validator-0 | 26696 | 26697 | 9490 | 1321 | 8585 | 8586 |
| validator-1 | 26706 | 26707 | 9590 | 1322 | 8595 | 8596 |
| validator-2 | 26716 | 26717 | 9690 | 1323 | 8605 | 8606 |

### 端口规划 (Mac)

| 节点 | P2P | CometBFT RPC | gRPC | REST API | EVM HTTP | EVM WS |
|------|-----|-------------|------|----------|----------|--------|
| validator-3 | 26656 | 26657 | 9090 | 1317 | 8545 | 8546 |

---

## 3. 环境准备

### 3.1 Ubuntu 基础环境

```bash
# 系统更新
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y build-essential git curl wget jq make gcc g++ \
  lz4 unzip software-properties-common ca-certificates gnupg

# 安装 Go 1.25+
GO_VERSION="1.25.2"
wget "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
rm "go${GO_VERSION}.linux-amd64.tar.gz"

# 配置 Go 环境
cat >> ~/.bashrc << 'GOEOF'
export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$GOROOT/bin:$GOPATH/bin:$PATH
GOEOF
source ~/.bashrc
go version

# 安装 Node.js 20 (用于合约/DEX)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

# 安装 Docker & Docker Compose (用于 Blockscout)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# 安装 Nginx
sudo apt install -y nginx

# 创建工作目录
mkdir -p ~/energychain && cd ~/energychain
```

### 3.2 Mac 基础环境

```bash
# Homebrew (如未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Go 1.25+
brew install go@1.25
echo 'export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
go version

# 安装 jq
brew install jq

# 创建工作目录
mkdir -p ~/energychain && cd ~/energychain
```

### 3.3 配置 ulimit (Ubuntu)

```bash
# 提高文件描述符限制
sudo bash -c 'cat >> /etc/security/limits.conf << EOF
*       soft    nofile  65535
*       hard    nofile  65535
*       soft    nproc   65535
*       hard    nproc   65535
EOF'

sudo bash -c 'echo "session required pam_limits.so" >> /etc/pam.d/common-session'

# 当前会话立即生效
ulimit -n 65535
```

### 3.4 防火墙配置 (Ubuntu)

```bash
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # Nginx
sudo ufw allow 443/tcp       # HTTPS

# P2P 端口 — 对外开放
sudo ufw allow 26656/tcp     # seed P2P
sudo ufw allow 26666/tcp     # sentry-0 P2P
sudo ufw allow 26676/tcp     # sentry-1 P2P
sudo ufw allow 26686/tcp     # fullnode P2P

# RPC 端口 — 仅 fullnode 对外 (浏览器和 DEX 需要)
sudo ufw allow 26687/tcp     # fullnode CometBFT RPC
sudo ufw allow 8575/tcp      # fullnode EVM JSON-RPC
sudo ufw allow 8576/tcp      # fullnode EVM WebSocket
sudo ufw allow 1320/tcp      # fullnode REST API
sudo ufw allow 9390/tcp      # fullnode gRPC

# 浏览器和 DEX 端口
sudo ufw allow 4000/tcp      # Blockscout
sudo ufw allow 8080/tcp      # Ping.pub
sudo ufw allow 3000/tcp      # DEX frontend

# 监控端口 (可选，仅内网)
sudo ufw allow 9091/tcp      # Prometheus
sudo ufw allow 3001/tcp      # Grafana

# 验证者 P2P 端口不对外开放 (通过 sentry 中继)
# validator-0: 26696, validator-1: 26706, validator-2: 26716 均不开放

sudo ufw enable
sudo ufw status
```

---

## 4. 编译链二进制

### 在 Ubuntu 上编译

```bash
cd ~/energychain
git clone <你的仓库地址> energy-chain
cd energy-chain/chain

# 编译
go build -ldflags="-s -w" -o energychaind ./cmd/energychaind

# 安装到 PATH
sudo cp energychaind /usr/local/bin/
energychaind version
```

### 在 Mac 上编译

```bash
cd ~/energychain
git clone <你的仓库地址> energy-chain
cd energy-chain/chain

# 编译 (Apple Silicon)
CGO_ENABLED=1 go build -ldflags="-s -w" -o energychaind ./cmd/energychaind

# 安装到 PATH
sudo cp energychaind /usr/local/bin/
energychaind version
```

---

## 5. 创世文件生成

> 以下操作在 **Ubuntu** 机器上执行，生成完整创世文件后分发到所有节点。

### 5.1 定义变量

```bash
export CHAIN_ID="energychain_9001-1"
export DENOM="uecy"
export KEYRING="file"  # 生产环境使用 file 后端
export KEYALGO="eth_secp256k1"
export BASE_HOME="$HOME/.energychain-production"

# 节点名称
NODES=("seed" "sentry-0" "sentry-1" "fullnode" "validator-0" "validator-1" "validator-2")
```

### 5.2 初始化所有节点

```bash
# 初始化 Ubuntu 上全部 7 个节点
for node in "${NODES[@]}"; do
  NODE_HOME="${BASE_HOME}/${node}"
  echo "Initializing ${node}..."
  energychaind init "${node}" \
    --chain-id "$CHAIN_ID" \
    --home "$NODE_HOME" \
    > /dev/null 2>&1
  echo "  -> ${NODE_HOME}"
done

# 在 Mac 上 SSH 过去或本地执行:
# energychaind init "validator-3" --chain-id "$CHAIN_ID" --home "$HOME/.energychaind"
```

### 5.3 创建验证者密钥

```bash
# 为 4 个验证者创建密钥 (Ubuntu 上的 3 个)
for i in 0 1 2; do
  NODE_HOME="${BASE_HOME}/validator-${i}"
  echo "Creating key for validator-${i}..."

  energychaind keys add "validator${i}" \
    --keyring-backend "$KEYRING" \
    --algo "$KEYALGO" \
    --home "$NODE_HOME"

  # 保存地址
  ADDR=$(energychaind keys show "validator${i}" \
    --keyring-backend "$KEYRING" \
    --home "$NODE_HOME" \
    --address)
  echo "  validator-${i} address: ${ADDR}"
done

# Mac 上执行 (validator-3):
# energychaind keys add validator3 --keyring-backend file --algo eth_secp256k1 --home ~/.energychaind
```

> **重要**: 请安全备份所有助记词! 使用密码管理器或加密存储。

### 5.4 创建功能账户

```bash
NODE0_HOME="${BASE_HOME}/validator-0"

# 创建功能性账户
for acct in team ecosystem treasury circulation dev0; do
  energychaind keys add "$acct" \
    --keyring-backend "$KEYRING" \
    --algo "$KEYALGO" \
    --home "$NODE0_HOME"
done
```

### 5.5 配置创世账户和代币分配

```bash
NODE0_HOME="${BASE_HOME}/validator-0"

# 获取地址
TEAM_ADDR=$(energychaind keys show team --keyring-backend "$KEYRING" --home "$NODE0_HOME" --address)
ECO_ADDR=$(energychaind keys show ecosystem --keyring-backend "$KEYRING" --home "$NODE0_HOME" --address)
TREASURY_ADDR=$(energychaind keys show treasury --keyring-backend "$KEYRING" --home "$NODE0_HOME" --address)
CIRC_ADDR=$(energychaind keys show circulation --keyring-backend "$KEYRING" --home "$NODE0_HOME" --address)
DEV0_ADDR=$(energychaind keys show dev0 --keyring-backend "$KEYRING" --home "$NODE0_HOME" --address)

# 代币分配 (总量 1B ECY, 18位精度)
# Team:        150M ECY (15%)
# Ecosystem:   300M ECY (30%)
# Treasury:    200M ECY (20%)
# Circulation: 250M ECY (25%)
# Validators:  25M ECY x 4 = 100M ECY (10%)

energychaind genesis add-genesis-account "$TEAM_ADDR" "150000000000000000000000000${DENOM}" \
  --home "$NODE0_HOME" --keyring-backend "$KEYRING"

energychaind genesis add-genesis-account "$ECO_ADDR" "300000000000000000000000000${DENOM}" \
  --home "$NODE0_HOME" --keyring-backend "$KEYRING"

energychaind genesis add-genesis-account "$TREASURY_ADDR" "200000000000000000000000000${DENOM}" \
  --home "$NODE0_HOME" --keyring-backend "$KEYRING"

energychaind genesis add-genesis-account "$CIRC_ADDR" "250000000000000000000000000${DENOM}" \
  --home "$NODE0_HOME" --keyring-backend "$KEYRING"

# Dev account (用于测试)
energychaind genesis add-genesis-account "$DEV0_ADDR" "1000000000000000000000${DENOM}" \
  --home "$NODE0_HOME" --keyring-backend "$KEYRING"

# 4 个验证者各 25M ECY
for i in 0 1 2; do
  VAL_ADDR=$(energychaind keys show "validator${i}" \
    --keyring-backend "$KEYRING" \
    --home "${BASE_HOME}/validator-${i}" \
    --address)

  energychaind genesis add-genesis-account "$VAL_ADDR" "25000000000000000000000000${DENOM}" \
    --home "$NODE0_HOME" --keyring-backend "$KEYRING"
done

# Mac 的 validator-3: 先获取地址 (从 Mac 复制过来)
# VAL3_ADDR="energy1xxxx..."
# energychaind genesis add-genesis-account "$VAL3_ADDR" "25000000000000000000000000${DENOM}" \
#   --home "$NODE0_HOME" --keyring-backend "$KEYRING"
```

### 5.6 修改创世参数

```bash
GENESIS="${NODE0_HOME}/config/genesis.json"
TMP="${NODE0_HOME}/config/tmp_genesis.json"

# 基础代币配置
jq --arg denom "$DENOM" '.app_state["staking"]["params"]["bond_denom"]=$denom' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq --arg denom "$DENOM" '.app_state["gov"]["params"]["min_deposit"][0]["denom"]=$denom' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq --arg denom "$DENOM" '.app_state["gov"]["params"]["expedited_min_deposit"][0]["denom"]=$denom' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq --arg denom "$DENOM" '.app_state["evm"]["params"]["evm_denom"]=$denom' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq --arg denom "$DENOM" '.app_state["mint"]["params"]["mint_denom"]=$denom' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

# Bank 元数据
jq '.app_state["bank"]["denom_metadata"]=[{
  "description":"Energy Chain native token",
  "denom_units":[
    {"denom":"uecy","exponent":0,"aliases":["microecy"]},
    {"denom":"ecy","exponent":18,"aliases":[]}
  ],
  "base":"uecy","display":"ecy",
  "name":"Energy Chain Yield","symbol":"ECY","uri":"","uri_hash":""
}]' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

# EVM 预编译
jq '.app_state["evm"]["params"]["active_static_precompiles"]=["0x0000000000000000000000000000000000000100","0x0000000000000000000000000000000000000400","0x0000000000000000000000000000000000000800","0x0000000000000000000000000000000000000801","0x0000000000000000000000000000000000000802","0x0000000000000000000000000000000000000803","0x0000000000000000000000000000000000000804","0x0000000000000000000000000000000000000805","0x0000000000000000000000000000000000000806","0x0000000000000000000000000000000000000807"]' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

# ERC20 原生预编译
jq '.app_state.erc20.native_precompiles=["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"]' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq --arg denom "$DENOM" '.app_state.erc20.token_pairs=[{contract_owner:1,erc20_address:"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",denom:$denom,enabled:true}]' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

# Block gas limit
jq '.consensus.params.block.max_gas="60000000"' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

# Fee market (10 Gwei)
jq '.app_state["feemarket"]["params"]["min_gas_price"]="10000000000.000000000000000000"' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq '.app_state["feemarket"]["params"]["base_fee"]="10000000000.000000000000000000"' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

# 治理参数 (生产环境用较长的投票周期)
jq '.app_state["gov"]["params"]["max_deposit_period"]="172800s"' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"
jq '.app_state["gov"]["params"]["voting_period"]="172800s"' "$GENESIS" > "$TMP" && mv "$TMP" "$GENESIS"

echo "Genesis parameters configured."
```

### 5.7 生成 Gentx

```bash
# 每个验证者质押 1M ECY (调整为合理的 staking 比例)
VALIDATOR_STAKE="1000000000000000000000000${DENOM}"

# Ubuntu 上的 3 个验证者
for i in 0 1 2; do
  NODE_HOME="${BASE_HOME}/validator-${i}"

  # 先复制创世文件到该验证者目录
  cp "${NODE0_HOME}/config/genesis.json" "${NODE_HOME}/config/genesis.json"

  energychaind genesis gentx "validator${i}" "$VALIDATOR_STAKE" \
    --chain-id "$CHAIN_ID" \
    --keyring-backend "$KEYRING" \
    --home "$NODE_HOME" \
    --moniker "validator-${i}" \
    --commission-rate "0.10" \
    --commission-max-rate "0.20" \
    --commission-max-change-rate "0.01" \
    --min-self-delegation "1"

  echo "Gentx created for validator-${i}"
done

# Mac 的 validator-3: 在 Mac 上执行
# 1. 先把 genesis.json scp 过去
# scp ubuntu_user@UBUNTU_IP:~/.energychain-production/validator-0/config/genesis.json ~/.energychaind/config/genesis.json
# 2. 生成 gentx
# energychaind genesis gentx validator3 "1000000000000000000000000uecy" \
#   --chain-id "energychain_9001-1" --keyring-backend file --home ~/.energychaind \
#   --moniker "validator-3" --commission-rate "0.10" --commission-max-rate "0.20" \
#   --commission-max-change-rate "0.01" --min-self-delegation "1"
# 3. 把 gentx 文件 scp 回 Ubuntu
# scp ~/.energychaind/config/gentx/*.json ubuntu_user@UBUNTU_IP:~/.energychain-production/validator-0/config/gentx/
```

### 5.8 收集 Gentx 并分发创世文件

```bash
NODE0_HOME="${BASE_HOME}/validator-0"

# 收集所有 validator 的 gentx 到 validator-0
for i in 1 2; do
  cp "${BASE_HOME}/validator-${i}/config/gentx/"*.json "${NODE0_HOME}/config/gentx/" 2>/dev/null || true
done

# Mac 的 gentx 也要复制过来 (已在上一步完成)

# 收集和验证
energychaind genesis collect-gentxs --home "$NODE0_HOME"
energychaind genesis validate-genesis --home "$NODE0_HOME"

echo "Genesis validated successfully."

# 分发最终创世文件到所有节点
for node in "${NODES[@]}"; do
  NODE_HOME="${BASE_HOME}/${node}"
  cp "${NODE0_HOME}/config/genesis.json" "${NODE_HOME}/config/genesis.json"
  echo "Genesis copied to ${node}"
done

echo ""
echo "=== 现在将 genesis.json SCP 到 Mac ==="
echo "scp ${NODE0_HOME}/config/genesis.json mac_user@MAC_IP:~/.energychaind/config/genesis.json"
```

---

## 6. 节点部署 — Ubuntu 机器

### 6.1 获取所有节点 ID

```bash
declare -A NODE_IDS

for node in "${NODES[@]}"; do
  NODE_HOME="${BASE_HOME}/${node}"
  NODE_ID=$(energychaind comet show-node-id --home "$NODE_HOME")
  NODE_IDS[$node]="$NODE_ID"
  echo "${node}: ${NODE_ID}"
done

# 记录 Mac validator-3 的 node ID (从 Mac 获取)
# MAC_VAL3_ID=$(ssh mac_user@MAC_IP "energychaind comet show-node-id --home ~/.energychaind")
# NODE_IDS[validator-3]="$MAC_VAL3_ID"
```

### 6.2 配置 Seed Node

```bash
SEED_HOME="${BASE_HOME}/seed"
SEED_ID="${NODE_IDS[seed]}"

CONFIG_TOML="${SEED_HOME}/config/config.toml"
APP_TOML="${SEED_HOME}/config/app.toml"

# P2P 配置
sed -i 's|laddr = "tcp://0.0.0.0:26656"|laddr = "tcp://0.0.0.0:26656"|' "$CONFIG_TOML"
sed -i 's|laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://127.0.0.1:26657"|' "$CONFIG_TOML"

# Seed 模式: 只做节点发现，不持续连接
sed -i 's|seed_mode = false|seed_mode = true|' "$CONFIG_TOML"
sed -i 's|pex = true|pex = true|' "$CONFIG_TOML"
sed -i 's|addr_book_strict = true|addr_book_strict = false|' "$CONFIG_TOML"

# 允许同 IP (同一台机器)
sed -i 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$CONFIG_TOML"

# Prometheus
sed -i 's|prometheus = false|prometheus = true|' "$CONFIG_TOML"

# API 和 JSON-RPC — seed 不需要对外暴露
sed -i '/^\[api\]$/,/^\[/ s|enable = false|enable = false|' "$APP_TOML"
sed -i '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = false|' "$APP_TOML"

# 最低 Gas 价格
sed -i "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$APP_TOML"

echo "Seed node configured."
```

### 6.3 配置 Sentry Nodes

```bash
UBUNTU_IP="127.0.0.1"  # 同机部署时用 127.0.0.1, 如果跨机部署改为实际 IP
SEED_PEER="${NODE_IDS[seed]}@${UBUNTU_IP}:26656"

# --- Sentry 0 ---
S0_HOME="${BASE_HOME}/sentry-0"
S0_CONFIG="${S0_HOME}/config/config.toml"
S0_APP="${S0_HOME}/config/app.toml"

# 端口配置
sed -i 's|laddr = "tcp://0.0.0.0:26656"|laddr = "tcp://0.0.0.0:26666"|' "$S0_CONFIG"
sed -i 's|laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://0.0.0.0:26667"|' "$S0_CONFIG"
sed -i "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:6061\"|" "$S0_CONFIG"

# 连接 seed 和验证者
VAL0_PEER="${NODE_IDS[validator-0]}@${UBUNTU_IP}:26696"
VAL1_PEER="${NODE_IDS[validator-1]}@${UBUNTU_IP}:26706"
sed -i "s|seeds = \"\"|seeds = \"${SEED_PEER}\"|" "$S0_CONFIG"
sed -i "s|persistent_peers = \"\"|persistent_peers = \"${VAL0_PEER},${VAL1_PEER}\"|" "$S0_CONFIG"

# 将验证者放入 private_peer_ids (不向外界广播)
sed -i "s|private_peer_ids = \"\"|private_peer_ids = \"${NODE_IDS[validator-0]},${NODE_IDS[validator-1]}\"|" "$S0_CONFIG"

sed -i 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$S0_CONFIG"
sed -i 's|addr_book_strict = true|addr_book_strict = false|' "$S0_CONFIG"
sed -i 's|prometheus = false|prometheus = true|' "$S0_CONFIG"

# App 端口
sed -i "s|address = \"tcp://localhost:1317\"|address = \"tcp://0.0.0.0:1318\"|" "$S0_APP"
sed -i "s|address = \"tcp://0.0.0.0:1317\"|address = \"tcp://0.0.0.0:1318\"|" "$S0_APP"
sed -i "s|address = \"0.0.0.0:9090\"|address = \"0.0.0.0:9190\"|" "$S0_APP"
sed -i "s|address = \"0.0.0.0:9091\"|address = \"0.0.0.0:9191\"|" "$S0_APP"
sed -i "s|address = \"127.0.0.1:8545\"|address = \"0.0.0.0:8555\"|" "$S0_APP"
sed -i "s|address = \"0.0.0.0:8545\"|address = \"0.0.0.0:8555\"|" "$S0_APP"
sed -i "s|ws-address = \"127.0.0.1:8546\"|ws-address = \"0.0.0.0:8556\"|" "$S0_APP"
sed -i "s|ws-address = \"0.0.0.0:8546\"|ws-address = \"0.0.0.0:8556\"|" "$S0_APP"
sed -i "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$S0_APP"
sed -i '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$S0_APP"
sed -i '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$S0_APP"

echo "Sentry-0 configured."

# --- Sentry 1 ---
S1_HOME="${BASE_HOME}/sentry-1"
S1_CONFIG="${S1_HOME}/config/config.toml"
S1_APP="${S1_HOME}/config/app.toml"

sed -i 's|laddr = "tcp://0.0.0.0:26656"|laddr = "tcp://0.0.0.0:26676"|' "$S1_CONFIG"
sed -i 's|laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://0.0.0.0:26677"|' "$S1_CONFIG"
sed -i "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:6062\"|" "$S1_CONFIG"

VAL2_PEER="${NODE_IDS[validator-2]}@${UBUNTU_IP}:26716"
# MAC_VAL3_PEER="${NODE_IDS[validator-3]}@MAC_IP:26656"  # 取消注释并填写 Mac IP
sed -i "s|seeds = \"\"|seeds = \"${SEED_PEER}\"|" "$S1_CONFIG"
sed -i "s|persistent_peers = \"\"|persistent_peers = \"${VAL2_PEER}\"|" "$S1_CONFIG"
# 如有 Mac validator: 加上 ,${MAC_VAL3_PEER}

sed -i "s|private_peer_ids = \"\"|private_peer_ids = \"${NODE_IDS[validator-2]}\"|" "$S1_CONFIG"
# 如有 Mac validator ID: 追加 ,${NODE_IDS[validator-3]}

sed -i 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$S1_CONFIG"
sed -i 's|addr_book_strict = true|addr_book_strict = false|' "$S1_CONFIG"
sed -i 's|prometheus = false|prometheus = true|' "$S1_CONFIG"

sed -i "s|address = \"tcp://localhost:1317\"|address = \"tcp://0.0.0.0:1319\"|" "$S1_APP"
sed -i "s|address = \"tcp://0.0.0.0:1317\"|address = \"tcp://0.0.0.0:1319\"|" "$S1_APP"
sed -i "s|address = \"0.0.0.0:9090\"|address = \"0.0.0.0:9290\"|" "$S1_APP"
sed -i "s|address = \"0.0.0.0:9091\"|address = \"0.0.0.0:9291\"|" "$S1_APP"
sed -i "s|address = \"127.0.0.1:8545\"|address = \"0.0.0.0:8565\"|" "$S1_APP"
sed -i "s|address = \"0.0.0.0:8545\"|address = \"0.0.0.0:8565\"|" "$S1_APP"
sed -i "s|ws-address = \"127.0.0.1:8546\"|ws-address = \"0.0.0.0:8566\"|" "$S1_APP"
sed -i "s|ws-address = \"0.0.0.0:8546\"|ws-address = \"0.0.0.0:8566\"|" "$S1_APP"
sed -i "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$S1_APP"
sed -i '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$S1_APP"
sed -i '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$S1_APP"

echo "Sentry-1 configured."
```

### 6.4 配置 Full Node (公开 RPC)

```bash
FN_HOME="${BASE_HOME}/fullnode"
FN_CONFIG="${FN_HOME}/config/config.toml"
FN_APP="${FN_HOME}/config/app.toml"

# 端口配置
sed -i 's|laddr = "tcp://0.0.0.0:26656"|laddr = "tcp://0.0.0.0:26686"|' "$FN_CONFIG"
sed -i 's|laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://0.0.0.0:26687"|' "$FN_CONFIG"
sed -i "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:6063\"|" "$FN_CONFIG"

# 连接到 seed 和 sentry 节点
S0_PEER="${NODE_IDS[sentry-0]}@${UBUNTU_IP}:26666"
S1_PEER="${NODE_IDS[sentry-1]}@${UBUNTU_IP}:26676"
sed -i "s|seeds = \"\"|seeds = \"${SEED_PEER}\"|" "$FN_CONFIG"
sed -i "s|persistent_peers = \"\"|persistent_peers = \"${S0_PEER},${S1_PEER}\"|" "$FN_CONFIG"

sed -i 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$FN_CONFIG"
sed -i 's|addr_book_strict = true|addr_book_strict = false|' "$FN_CONFIG"
sed -i 's|prometheus = false|prometheus = true|' "$FN_CONFIG"

# 开启 indexer (浏览器需要)
sed -i 's|indexer = "null"|indexer = "kv"|' "$FN_CONFIG"

# 开启 CORS
sed -i "s|cors_allowed_origins = \[\]|cors_allowed_origins = [\"*\"]|" "$FN_CONFIG"

# App 配置 — 对外暴露所有 API
sed -i "s|address = \"tcp://localhost:1317\"|address = \"tcp://0.0.0.0:1320\"|" "$FN_APP"
sed -i "s|address = \"tcp://0.0.0.0:1317\"|address = \"tcp://0.0.0.0:1320\"|" "$FN_APP"
sed -i "s|address = \"0.0.0.0:9090\"|address = \"0.0.0.0:9390\"|" "$FN_APP"
sed -i "s|address = \"0.0.0.0:9091\"|address = \"0.0.0.0:9391\"|" "$FN_APP"
sed -i "s|address = \"127.0.0.1:8545\"|address = \"0.0.0.0:8575\"|" "$FN_APP"
sed -i "s|address = \"0.0.0.0:8545\"|address = \"0.0.0.0:8575\"|" "$FN_APP"
sed -i "s|ws-address = \"127.0.0.1:8546\"|ws-address = \"0.0.0.0:8576\"|" "$FN_APP"
sed -i "s|ws-address = \"0.0.0.0:8546\"|ws-address = \"0.0.0.0:8576\"|" "$FN_APP"
sed -i "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$FN_APP"

# 启用所有 API
sed -i '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$FN_APP"
sed -i "s|enabled-unsafe-cors = false|enabled-unsafe-cors = true|" "$FN_APP"
sed -i '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$FN_APP"

# 开启索引器
sed -i 's|enable-indexer = false|enable-indexer = true|' "$FN_APP"

# Mempool 增大 (Batch上链需要)
sed -i 's|size = 5000|size = 20000|' "$FN_CONFIG"

echo "Full node configured."
```

### 6.5 配置 Validators (Ubuntu)

```bash
for i in 0 1 2; do
  VAL_HOME="${BASE_HOME}/validator-${i}"
  VAL_CONFIG="${VAL_HOME}/config/config.toml"
  VAL_APP="${VAL_HOME}/config/app.toml"

  # 端口
  P2P_PORT=$((26696 + i * 10))
  RPC_PORT=$((26697 + i * 10))
  GRPC_PORT=$((9490 + i * 100))
  GRPC_WEB_PORT=$((9491 + i * 100))
  API_PORT=$((1321 + i))
  EVM_PORT=$((8585 + i * 10))
  EVM_WS_PORT=$((8586 + i * 10))
  PPROF_PORT=$((6064 + i))

  sed -i "s|laddr = \"tcp://0.0.0.0:26656\"|laddr = \"tcp://0.0.0.0:${P2P_PORT}\"|" "$VAL_CONFIG"
  sed -i "s|laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://127.0.0.1:${RPC_PORT}\"|" "$VAL_CONFIG"
  sed -i "s|pprof_laddr = \"localhost:6060\"|pprof_laddr = \"localhost:${PPROF_PORT}\"|" "$VAL_CONFIG"

  # 验证者只连接到其 sentry，不连 seed (隐藏验证者)
  if [ "$i" -le 1 ]; then
    SENTRY_PEER="${NODE_IDS[sentry-0]}@${UBUNTU_IP}:26666"
  else
    SENTRY_PEER="${NODE_IDS[sentry-1]}@${UBUNTU_IP}:26676"
  fi
  sed -i "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY_PEER}\"|" "$VAL_CONFIG"

  # 不启用 PEX (不自动发现) — 安全措施
  sed -i 's|pex = true|pex = false|' "$VAL_CONFIG"
  sed -i 's|allow_duplicate_ip = false|allow_duplicate_ip = true|' "$VAL_CONFIG"
  sed -i 's|addr_book_strict = true|addr_book_strict = false|' "$VAL_CONFIG"
  sed -i 's|prometheus = false|prometheus = true|' "$VAL_CONFIG"

  # App 端口
  sed -i "s|address = \"tcp://localhost:1317\"|address = \"tcp://127.0.0.1:${API_PORT}\"|" "$VAL_APP"
  sed -i "s|address = \"tcp://0.0.0.0:1317\"|address = \"tcp://127.0.0.1:${API_PORT}\"|" "$VAL_APP"
  sed -i "s|address = \"0.0.0.0:9090\"|address = \"127.0.0.1:${GRPC_PORT}\"|" "$VAL_APP"
  sed -i "s|address = \"0.0.0.0:9091\"|address = \"127.0.0.1:${GRPC_WEB_PORT}\"|" "$VAL_APP"
  sed -i "s|address = \"127.0.0.1:8545\"|address = \"127.0.0.1:${EVM_PORT}\"|" "$VAL_APP"
  sed -i "s|address = \"0.0.0.0:8545\"|address = \"127.0.0.1:${EVM_PORT}\"|" "$VAL_APP"
  sed -i "s|ws-address = \"127.0.0.1:8546\"|ws-address = \"127.0.0.1:${EVM_WS_PORT}\"|" "$VAL_APP"
  sed -i "s|ws-address = \"0.0.0.0:8546\"|ws-address = \"127.0.0.1:${EVM_WS_PORT}\"|" "$VAL_APP"

  sed -i "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$VAL_APP"
  sed -i '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$VAL_APP"
  sed -i '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$VAL_APP"

  echo "Validator-${i} configured (P2P:${P2P_PORT})"
done
```

### 6.6 启动所有节点 (手动方式)

```bash
# 按照启动顺序: seed -> sentry -> fullnode -> validators
LOG_DIR="${BASE_HOME}/logs"
mkdir -p "$LOG_DIR"

# 1. 启动 Seed
nohup energychaind start \
  --home "${BASE_HOME}/seed" \
  --log_level info \
  --minimum-gas-prices="10000000000${DENOM}" \
  > "${LOG_DIR}/seed.log" 2>&1 &
echo "Seed PID: $!"
sleep 3

# 2. 启动 Sentry 节点
for i in 0 1; do
  nohup energychaind start \
    --home "${BASE_HOME}/sentry-${i}" \
    --log_level info \
    --minimum-gas-prices="10000000000${DENOM}" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/sentry-${i}.log" 2>&1 &
  echo "Sentry-${i} PID: $!"
  sleep 2
done

# 3. 启动 Full Node
nohup energychaind start \
  --home "${BASE_HOME}/fullnode" \
  --log_level info \
  --minimum-gas-prices="10000000000${DENOM}" \
  --json-rpc.api eth,txpool,personal,net,debug,web3 \
  --pruning nothing \
  > "${LOG_DIR}/fullnode.log" 2>&1 &
echo "Fullnode PID: $!"
sleep 3

# 4. 启动 Validators
for i in 0 1 2; do
  nohup energychaind start \
    --home "${BASE_HOME}/validator-${i}" \
    --log_level info \
    --minimum-gas-prices="10000000000${DENOM}" \
    --json-rpc.api eth,txpool,net,web3 \
    > "${LOG_DIR}/validator-${i}.log" 2>&1 &
  echo "Validator-${i} PID: $!"
  sleep 2
done

echo ""
echo "=== All Ubuntu nodes started ==="
echo "Logs: ${LOG_DIR}/"
```

---

## 7. 节点部署 — Mac 验证者

### 7.1 初始化 Mac 节点

```bash
# === 在 Mac 上执行 ===
export CHAIN_ID="energychain_9001-1"
export DENOM="uecy"
MAC_HOME="$HOME/.energychaind"

# 初始化
energychaind init "validator-3" --chain-id "$CHAIN_ID" --home "$MAC_HOME"

# 创建验证者密钥
energychaind keys add validator3 \
  --keyring-backend file \
  --algo eth_secp256k1 \
  --home "$MAC_HOME"

# 记下地址并告知 Ubuntu 进行创世账户分配 (见 5.5 步骤)
VAL3_ADDR=$(energychaind keys show validator3 --keyring-backend file --home "$MAC_HOME" --address)
echo "Validator-3 address: ${VAL3_ADDR}"

# 记下 node ID
MAC_NODE_ID=$(energychaind comet show-node-id --home "$MAC_HOME")
echo "Validator-3 node ID: ${MAC_NODE_ID}"
```

### 7.2 从 Ubuntu 获取创世文件

```bash
# 从 Ubuntu 获取最终的 genesis.json
UBUNTU_IP="<UBUNTU_IP>"
scp ${UBUNTU_IP}:~/.energychain-production/validator-0/config/genesis.json \
  ${MAC_HOME}/config/genesis.json
```

### 7.3 配置 Mac 节点

```bash
MAC_CONFIG="${MAC_HOME}/config/config.toml"
MAC_APP="${MAC_HOME}/config/app.toml"

# 连接到 Ubuntu 的 sentry-1
SENTRY1_ID="<SENTRY_1_NODE_ID>"
sed -i '' "s|persistent_peers = \"\"|persistent_peers = \"${SENTRY1_ID}@${UBUNTU_IP}:26676\"|" "$MAC_CONFIG"

# 不启用 PEX
sed -i '' 's|pex = true|pex = false|' "$MAC_CONFIG"
sed -i '' 's|addr_book_strict = true|addr_book_strict = false|' "$MAC_CONFIG"

# CORS
sed -i '' "s|cors_allowed_origins = \[\]|cors_allowed_origins = [\"*\"]|" "$MAC_CONFIG"

# 最低 Gas
sed -i '' "s|minimum-gas-prices = \"\"|minimum-gas-prices = \"10000000000${DENOM}\"|" "$MAC_APP"

# 启用 API
sed -i '' '/^\[api\]$/,/^\[/ s|enable = false|enable = true|' "$MAC_APP"
sed -i '' "s|enabled-unsafe-cors = false|enabled-unsafe-cors = true|" "$MAC_APP"
sed -i '' '/^\[json-rpc\]$/,/^\[/ s|enable = false|enable = true|' "$MAC_APP"
```

### 7.4 启动 Mac 验证者

```bash
energychaind start \
  --home "$MAC_HOME" \
  --log_level info \
  --minimum-gas-prices="10000000000uecy" \
  --json-rpc.api eth,txpool,net,web3 \
  --chain-id "energychain_9001-1"
```

---

## 8. Systemd 服务管理

> 为 Ubuntu 上每个节点创建 systemd service 文件, 实现开机自启和自动重启。

### 8.1 创建 Systemd Service 文件

```bash
# 通用模板函数
create_service() {
  local NAME=$1
  local HOME_DIR=$2
  local EXTRA_ARGS=$3

  sudo bash -c "cat > /etc/systemd/system/energychain-${NAME}.service" << EOF
[Unit]
Description=EnergyChain ${NAME}
After=network-online.target
Wants=network-online.target

[Service]
User=$(whoami)
ExecStart=/usr/local/bin/energychaind start \\
  --home ${HOME_DIR} \\
  --log_level info \\
  --minimum-gas-prices=10000000000uecy ${EXTRA_ARGS}
Restart=on-failure
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=energychain-${NAME}

[Install]
WantedBy=multi-user.target
EOF

  echo "Created service: energychain-${NAME}"
}

BASE_HOME="$HOME/.energychain-production"

# Seed Node
create_service "seed" "${BASE_HOME}/seed" ""

# Sentry Nodes
create_service "sentry-0" "${BASE_HOME}/sentry-0" "--json-rpc.api eth,txpool,net,web3"
create_service "sentry-1" "${BASE_HOME}/sentry-1" "--json-rpc.api eth,txpool,net,web3"

# Full Node
create_service "fullnode" "${BASE_HOME}/fullnode" "--json-rpc.api eth,txpool,personal,net,debug,web3 --pruning nothing"

# Validators
create_service "validator-0" "${BASE_HOME}/validator-0" "--json-rpc.api eth,txpool,net,web3"
create_service "validator-1" "${BASE_HOME}/validator-1" "--json-rpc.api eth,txpool,net,web3"
create_service "validator-2" "${BASE_HOME}/validator-2" "--json-rpc.api eth,txpool,net,web3"
```

### 8.2 启用和管理服务

```bash
# Reload systemd
sudo systemctl daemon-reload

# 按顺序启动
sudo systemctl enable --now energychain-seed
sleep 5
sudo systemctl enable --now energychain-sentry-0
sudo systemctl enable --now energychain-sentry-1
sleep 5
sudo systemctl enable --now energychain-fullnode
sleep 5
sudo systemctl enable --now energychain-validator-0
sudo systemctl enable --now energychain-validator-1
sudo systemctl enable --now energychain-validator-2

# 查看状态
for svc in seed sentry-0 sentry-1 fullnode validator-0 validator-1 validator-2; do
  echo "=== energychain-${svc} ==="
  sudo systemctl status "energychain-${svc}" --no-pager -l | head -5
  echo ""
done

# 查看日志
sudo journalctl -u energychain-fullnode -f --no-hostname

# 重启某个服务
# sudo systemctl restart energychain-validator-0

# 停止某个服务
# sudo systemctl stop energychain-validator-0
```

### 8.3 健康检查

```bash
# 检查各节点是否在出块
echo "=== 节点状态检查 ==="

# Full Node (对外 RPC)
curl -s http://127.0.0.1:26687/status | jq '{
  moniker: .result.node_info.moniker,
  chain_id: .result.node_info.network,
  latest_block: .result.sync_info.latest_block_height,
  catching_up: .result.sync_info.catching_up
}'

# EVM RPC 检查
curl -s -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .

# 检查验证者集合
curl -s http://127.0.0.1:26687/validators | jq '.result.total'
```

---

## 9. Blockscout 区块浏览器部署

> 使用 Docker Compose 部署 Blockscout，连接到 Full Node 的 EVM RPC。

### 9.1 创建部署目录

```bash
mkdir -p ~/energychain/blockscout && cd ~/energychain/blockscout
```

### 9.2 Docker Compose 配置

```bash
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.9'

services:
  blockscout-db:
    image: postgres:16-alpine
    container_name: blockscout-db
    environment:
      POSTGRES_DB: blockscout
      POSTGRES_USER: blockscout
      POSTGRES_PASSWORD: blockscout_secret_pw
    volumes:
      - blockscout-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blockscout"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  blockscout-redis:
    image: redis:7-alpine
    container_name: blockscout-redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: unless-stopped

  blockscout:
    image: blockscout/blockscout:latest
    container_name: blockscout
    depends_on:
      blockscout-db:
        condition: service_healthy
      blockscout-redis:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://blockscout:blockscout_secret_pw@blockscout-db:5432/blockscout
      ETHEREUM_JSONRPC_VARIANT: geth
      ETHEREUM_JSONRPC_HTTP_URL: http://host.docker.internal:8575
      ETHEREUM_JSONRPC_WS_URL: ws://host.docker.internal:8576
      ETHEREUM_JSONRPC_TRACE_URL: http://host.docker.internal:8575
      CHAIN_ID: "262144"
      COIN: ECY
      COIN_NAME: "Energy Chain Yield"
      NETWORK: "EnergyChain"
      SUBNETWORK: "Testnet"
      LOGO: /images/blockscout_logo.svg
      BLOCKSCOUT_HOST: 0.0.0.0
      PORT: 4000
      SECRET_KEY_BASE: "RMgI4C1HSkxsEjdhtGMfwAHfyT6CKWXOgzCboJflfSm4jeAlic52io05KB6mqzc5"
      ACCOUNT_ENABLED: "true"
      BLOCK_TRANSFORMER: base
      CACHE_ADDRESS_WITH_BALANCES_UPDATE_INTERVAL: 30s
      INDEXER_DISABLE_PENDING_TRANSACTIONS_FETCHER: "true"
      FETCH_REWARDS_WAY: trace
      DISABLE_EXCHANGE_RATES: "true"
      DISABLE_KNOWN_TOKENS: "true"
      POOL_SIZE: 40
      POOL_SIZE_API: 10
      ECTO_USE_SSL: "false"
      ACCOUNT_REDIS_URL: redis://blockscout-redis:6379
      MIX_ENV: prod
    ports:
      - "4000:4000"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped

  blockscout-smart-contract-verifier:
    image: ghcr.io/blockscout/smart-contract-verifier:latest
    container_name: blockscout-verifier
    environment:
      SMART_CONTRACT_VERIFIER__SERVER__HTTP__ADDR: 0.0.0.0:8043
    ports:
      - "8043:8043"
    restart: unless-stopped

volumes:
  blockscout-db-data:
COMPOSE_EOF
```

### 9.3 启动 Blockscout

```bash
cd ~/energychain/blockscout
docker compose up -d

# 查看日志
docker compose logs -f blockscout

# 等待初始化 (首次可能需要几分钟)
# 浏览器访问: http://UBUNTU_IP:4000
```

---

## 10. Ping.pub 浏览器部署

### 10.1 克隆并配置

```bash
cd ~/energychain
git clone https://github.com/ping-pub/explorer.git ping-pub
cd ping-pub

# 安装依赖
npm install
```

### 10.2 添加链配置

```bash
# 创建 EnergyChain 链配置
cat > src/chains/mainnet/energychain.json << 'PINGEOF'
{
  "$schema": "../chain.schema.json",
  "chain_name": "energychain",
  "api": [
    {
      "address": "http://127.0.0.1:1320",
      "provider": "local"
    }
  ],
  "rpc": [
    {
      "address": "http://127.0.0.1:26687",
      "provider": "local"
    }
  ],
  "sdk_version": "0.54.0",
  "coin_type": "60",
  "min_tx_fee": "10000000000",
  "addr_prefix": "energy",
  "logo": "",
  "theme_color": "#00b894",
  "assets": [
    {
      "base": "uecy",
      "symbol": "ECY",
      "exponent": "18",
      "coingecko_id": "",
      "logo": ""
    }
  ]
}
PINGEOF
```

### 10.3 构建并启动

```bash
cd ~/energychain/ping-pub

# 开发模式 (调试用)
# npm run dev -- --port 8080

# 生产模式
npm run build

# 使用 nginx 或 pm2 serve 静态文件
npm install -g pm2 serve
pm2 start "npx serve dist -l 8080" --name ping-pub

# 浏览器访问: http://UBUNTU_IP:8080
```

---

## 11. DEX 部署

### 11.1 部署 DEX 合约

```bash
cd ~/energychain/energy-chain/contracts

# 安装依赖
npm install

# 导出 dev0 私钥 (从 validator-0 节点)
DEV0_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend file \
  --home "$HOME/.energychain-production/validator-0")

# 配置环境变量
cat > .env << ENV_EOF
PRIVATE_KEY=${DEV0_KEY}
RPC_URL=http://127.0.0.1:8575
BLOCKSCOUT_API_URL=http://127.0.0.1:4000/api
BLOCKSCOUT_URL=http://127.0.0.1:4000
ENV_EOF

# 编译合约
npx hardhat compile

# 部署 DEX 合约
npx hardhat run scripts/deploy_dex.ts --network energychain_testnet

# 添加初始流动性
npx hardhat run scripts/add_liquidity.ts --network energychain_testnet

echo "DEX contracts deployed. Check dex-deployment.json for addresses."
```

### 11.2 部署 DEX 前端

```bash
cd ~/energychain/energy-chain/dex-frontend

# 安装依赖
npm install
```

### 11.3 更新前端配置

```bash
# 更新合约地址 (从 dex-deployment.json 获取)
# 编辑 src/config/contracts.ts 更新地址为实际部署的合约地址
# 编辑 src/config/tokens.ts 更新代币地址

# 更新 RPC URL 为 fullnode 的 EVM RPC
# 修改 src/config/contracts.ts 中的 rpcUrls 指向生产环境地址
```

### 11.4 构建并部署

```bash
cd ~/energychain/energy-chain/dex-frontend

# 构建
npm run build

# 使用 pm2 serve
pm2 start "npx serve dist -l 3000" --name energyswap-dex

# 浏览器访问: http://UBUNTU_IP:3000
```

---

## 12. Nginx 反向代理

### 12.1 Nginx 配置

```bash
sudo bash -c 'cat > /etc/nginx/sites-available/energychain' << 'NGINX_EOF'
# EnergyChain RPC 接口
server {
    listen 80;
    server_name rpc.energychain.local;

    # CometBFT RPC
    location /rpc/ {
        proxy_pass http://127.0.0.1:26687/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Cosmos REST API
    location /api/ {
        proxy_pass http://127.0.0.1:1320/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Access-Control-Allow-Origin *;
    }

    # EVM JSON-RPC
    location /evm {
        proxy_pass http://127.0.0.1:8575;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Content-Type application/json;
    }

    # EVM WebSocket
    location /evm-ws {
        proxy_pass http://127.0.0.1:8576;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # gRPC (需要 ngx_http_grpc_module)
    location /grpc {
        grpc_pass grpc://127.0.0.1:9390;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:26687/health;
    }
}

# Blockscout 浏览器
server {
    listen 80;
    server_name explorer.energychain.local;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Ping.pub 浏览器
server {
    listen 80;
    server_name cosmos.energychain.local;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# DEX 前端
server {
    listen 80;
    server_name dex.energychain.local;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# 默认 — 如果没有域名，使用 IP 直接访问
server {
    listen 80 default_server;
    server_name _;

    location / {
        return 200 '{"status":"ok","services":{"rpc":"http://$host/rpc/","api":"http://$host/api/","evm":"http://$host/evm","explorer":"http://$host:4000","cosmos_explorer":"http://$host:8080","dex":"http://$host:3000"}}';
        add_header Content-Type application/json;
    }
}
NGINX_EOF

# 启用站点
sudo ln -sf /etc/nginx/sites-available/energychain /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 13. 钱包生成与转账

### 13.1 批量生成钱包

```bash
# 生成 10 个测试钱包
NODE_HOME="$HOME/.energychain-production/validator-0"

for i in $(seq 1 10); do
  energychaind keys add "wallet${i}" \
    --keyring-backend file \
    --algo eth_secp256k1 \
    --home "$NODE_HOME" \
    --output json 2>&1 | jq '{name: .name, address: .address, mnemonic: .mnemonic}'
  echo "---"
done

# 列出所有钱包
energychaind keys list --keyring-backend file --home "$NODE_HOME" --output json | jq '.[].name'
```

### 13.2 Cosmos SDK 转账 (energychaind tx bank send)

```bash
NODE_HOME="$HOME/.energychain-production/validator-0"
CHAIN_ID="energychain_9001-1"
RPC="http://127.0.0.1:26687"

# === 单笔转账: dev0 -> wallet1 转 1000 ECY ===
energychaind tx bank send dev0 \
  $(energychaind keys show wallet1 --keyring-backend file --home "$NODE_HOME" --address) \
  1000000000000000000000uecy \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto \
  --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes

# === 批量转账: 给 10 个钱包每个转 100 ECY ===
for i in $(seq 1 10); do
  ADDR=$(energychaind keys show "wallet${i}" --keyring-backend file --home "$NODE_HOME" --address)
  echo "Sending 100 ECY to wallet${i} (${ADDR})..."

  energychaind tx bank send dev0 "$ADDR" \
    100000000000000000000uecy \
    --chain-id "$CHAIN_ID" \
    --keyring-backend file \
    --home "$NODE_HOME" \
    --node "$RPC" \
    --gas auto \
    --gas-adjustment 1.5 \
    --gas-prices "10000000000uecy" \
    --yes \
    --broadcast-mode sync

  sleep 2  # 等待交易入块
done
```

### 13.3 查询余额

```bash
# Cosmos 方式查询
energychaind q bank balances \
  $(energychaind keys show wallet1 --keyring-backend file --home "$NODE_HOME" --address) \
  --node "$RPC"

# EVM 方式查询 (需要 EVM 地址)
curl -s -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_getBalance",
    "params":["0xYOUR_EVM_ADDRESS", "latest"],
    "id":1
  }' | jq .
```

---

## 14. 数据批量上链

### 14.1 能源数据上链 (Energy 模块)

```bash
NODE_HOME="$HOME/.energychain-production/validator-0"
CHAIN_ID="energychain_9001-1"
RPC="http://127.0.0.1:26687"

# === 注册能源设备 ===
energychaind tx energy register-device \
  --device-id "solar-panel-001" \
  --device-type "solar" \
  --capacity "50000" \
  --location "Shanghai,China" \
  --from dev0 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto \
  --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes

# === 批量上报能源数据 ===
for i in $(seq 1 50); do
  TIMESTAMP=$(date +%s)
  POWER=$((RANDOM % 500 + 100))  # 100-600 kW

  energychaind tx energy submit-reading \
    --device-id "solar-panel-001" \
    --timestamp "$TIMESTAMP" \
    --power-output "$POWER" \
    --energy-produced "$((POWER * 3600))" \
    --from dev0 \
    --chain-id "$CHAIN_ID" \
    --keyring-backend file \
    --home "$NODE_HOME" \
    --node "$RPC" \
    --gas auto \
    --gas-adjustment 1.5 \
    --gas-prices "10000000000uecy" \
    --yes \
    --broadcast-mode sync

  echo "Reading #${i}: ${POWER} kW at ${TIMESTAMP}"
  sleep 1
done
```

### 14.2 Oracle 数据上链

```bash
# === 提交 Oracle 价格数据 ===
for i in $(seq 1 20); do
  PRICE=$((RANDOM % 100 + 50))  # 50-150 USD

  energychaind tx oracle submit-price \
    --symbol "ECY/USDT" \
    --price "${PRICE}000000" \
    --from dev0 \
    --chain-id "$CHAIN_ID" \
    --keyring-backend file \
    --home "$NODE_HOME" \
    --node "$RPC" \
    --gas auto \
    --gas-adjustment 1.5 \
    --gas-prices "10000000000uecy" \
    --yes \
    --broadcast-mode sync

  echo "Oracle price #${i}: ${PRICE} USD"
  sleep 2
done
```

### 14.3 Identity 身份注册

```bash
# === 注册身份 ===
energychaind tx identity register \
  --name "EnergyCompany-Alpha" \
  --identity-type "producer" \
  --metadata '{"license":"EP-2026-001","region":"East China"}' \
  --from dev0 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto \
  --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes
```

### 14.4 Audit 审计记录

```bash
# === 提交审计记录 ===
energychaind tx audit submit-record \
  --record-type "energy-verification" \
  --target "solar-panel-001" \
  --result "passed" \
  --data '{"inspector":"auditor-01","score":95}' \
  --from dev0 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto \
  --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes
```

---

## 15. DEX 操作与刷交易

### 15.1 使用 Hardhat 脚本刷交易

```bash
cd ~/energychain/energy-chain/contracts

# 确保 .env 配置正确 (RPC_URL 和 PRIVATE_KEY)

# 添加流动性
npx hardhat run scripts/add_liquidity.ts --network energychain_testnet

# 启动自动交易机器人 (模拟真实交易)
npx hardhat run scripts/simulate_trades.ts --network energychain_testnet
# Ctrl+C 停止

# 给 dev0 发送测试代币
npx hardhat run scripts/fund_dev0.ts --network energychain_testnet
```

### 15.2 使用 cast 命令手动 DEX 交易

```bash
# 安装 foundry (如未安装)
curl -L https://foundry.paradigm.xyz | bash
foundryup

RPC="http://127.0.0.1:8575"
ROUTER="0xd537D06b2b03E067f0c6FBe6252Fdd280B8b11d7"
WECY="0x6a407DD067d79659F58a4887Fb7ec188207Fc1A6"
USDT="0x5633fDb95cA11376CE9f8eBF05104Fe6fa60E3fF"
PRIVATE_KEY="<YOUR_PRIVATE_KEY>"

# Approve USDT for Router
cast send "$USDT" "approve(address,uint256)" "$ROUTER" "$(cast --max-uint)" \
  --rpc-url "$RPC" --private-key "$PRIVATE_KEY"

# Swap 100 ECY -> USDT (swapExactETHForTokens)
cast send "$ROUTER" \
  "swapExactETHForTokens(uint256,address[],address,uint256)" \
  0 "[$WECY,$USDT]" "0xYOUR_ADDRESS" "$(date -d '+1 hour' +%s)" \
  --rpc-url "$RPC" \
  --private-key "$PRIVATE_KEY" \
  --value "100ether" \
  --gas-limit 500000

# Swap 1000 USDT -> ECY (swapExactTokensForETH)
cast send "$ROUTER" \
  "swapExactTokensForETH(uint256,uint256,address[],address,uint256)" \
  "$(cast --to-wei 1000)" 0 "[$USDT,$WECY]" "0xYOUR_ADDRESS" "$(date -d '+1 hour' +%s)" \
  --rpc-url "$RPC" \
  --private-key "$PRIVATE_KEY" \
  --gas-limit 500000

# 查看流动性池储备
cast call "$ROUTER" "factory()(address)" --rpc-url "$RPC"
```

### 15.3 批量刷交易脚本

```bash
# 创建简单的刷交易脚本
cat > ~/energychain/trade_loop.sh << 'TRADE_EOF'
#!/bin/bash
RPC="http://127.0.0.1:8575"
ROUTER="0xd537D06b2b03E067f0c6FBe6252Fdd280B8b11d7"
WECY="0x6a407DD067d79659F58a4887Fb7ec188207Fc1A6"
USDT="0x5633fDb95cA11376CE9f8eBF05104Fe6fa60E3fF"
PRIVATE_KEY="$1"
ADDRESS="$2"

if [ -z "$PRIVATE_KEY" ] || [ -z "$ADDRESS" ]; then
  echo "Usage: $0 <PRIVATE_KEY> <ADDRESS>"
  exit 1
fi

DEADLINE=$(($(date +%s) + 86400))

echo "Starting trade loop..."
for i in $(seq 1 100); do
  AMOUNT=$((RANDOM % 50 + 10))
  echo "Trade #${i}: Swapping ${AMOUNT} ECY -> USDT"

  cast send "$ROUTER" \
    "swapExactETHForTokens(uint256,address[],address,uint256)" \
    0 "[$WECY,$USDT]" "$ADDRESS" "$DEADLINE" \
    --rpc-url "$RPC" \
    --private-key "$PRIVATE_KEY" \
    --value "${AMOUNT}ether" \
    --gas-limit 500000 \
    2>/dev/null

  sleep $((RANDOM % 5 + 2))
done
TRADE_EOF

chmod +x ~/energychain/trade_loop.sh

# 运行: ./trade_loop.sh <PRIVATE_KEY> <YOUR_EVM_ADDRESS>
```

---

## 16. 手动测试命令集

### 16.1 链基础查询

```bash
NODE="http://127.0.0.1:26687"

# 查看链状态
energychaind status --node "$NODE" | jq .

# 查看最新区块
energychaind q block --node "$NODE" | jq '.block.header.height'

# 查看验证者集合
energychaind q staking validators --node "$NODE" --output json | jq '.validators[] | {moniker: .description.moniker, status: .status, tokens: .tokens}'

# 查看活跃验证者数量
energychaind q staking validators --status BOND_STATUS_BONDED --node "$NODE" --output json | jq '.validators | length'

# 查看治理提案
energychaind q gov proposals --node "$NODE" --output json | jq .

# 查看模块参数
energychaind q staking params --node "$NODE" --output json | jq .
energychaind q gov params --node "$NODE" --output json | jq .
energychaind q mint params --node "$NODE" --output json | jq .
```

### 16.2 转账测试

```bash
NODE_HOME="$HOME/.energychain-production/validator-0"
CHAIN_ID="energychain_9001-1"
RPC="http://127.0.0.1:26687"

# Cosmos SDK 转账: dev0 -> wallet1 (1 ECY)
energychaind tx bank send dev0 \
  $(energychaind keys show wallet1 --keyring-backend file --home "$NODE_HOME" --address) \
  1000000000000000000uecy \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes

# 多代币转账 (附带 memo)
energychaind tx bank send dev0 \
  $(energychaind keys show wallet2 --keyring-backend file --home "$NODE_HOME" --address) \
  500000000000000000000uecy \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --note "Test transfer from dev0" \
  --yes
```

### 16.3 Staking 操作

```bash
# 查看验证者地址
VAL_ADDR=$(energychaind keys show validator0 --bech val --keyring-backend file --home "$NODE_HOME" --address)

# 委托: wallet1 委托 10 ECY 给 validator0
energychaind tx staking delegate "$VAL_ADDR" \
  10000000000000000000uecy \
  --from wallet1 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes

# 查看委托
energychaind q staking delegations \
  $(energychaind keys show wallet1 --keyring-backend file --home "$NODE_HOME" --address) \
  --node "$RPC" --output json | jq .

# 领取奖励
energychaind tx distribution withdraw-all-rewards \
  --from wallet1 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes

# 解委托
energychaind tx staking unbond "$VAL_ADDR" \
  5000000000000000000uecy \
  --from wallet1 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes
```

### 16.4 治理操作

```bash
# 提交文本提案
energychaind tx gov submit-proposal \
  --title "Test Proposal" \
  --summary "This is a test governance proposal for EnergyChain" \
  --deposit "10000000000000000000uecy" \
  --from dev0 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes

# 查看提案
energychaind q gov proposals --node "$RPC"

# 投票
energychaind tx gov vote 1 yes \
  --from validator0 \
  --chain-id "$CHAIN_ID" \
  --keyring-backend file \
  --home "$NODE_HOME" \
  --node "$RPC" \
  --gas auto --gas-adjustment 1.5 \
  --gas-prices "10000000000uecy" \
  --yes
```

### 16.5 EVM 操作 (curl / cast)

```bash
EVM_RPC="http://127.0.0.1:8575"

# 查看 EVM Chain ID
curl -s -X POST "$EVM_RPC" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .

# 查看最新块号
curl -s -X POST "$EVM_RPC" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .

# 查看 gas 价格
curl -s -X POST "$EVM_RPC" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}' | jq .

# 获取账户余额
curl -s -X POST "$EVM_RPC" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYOUR_ADDRESS","latest"],"id":1}' | jq .

# 发送 EVM 交易 (使用 cast)
cast send --rpc-url "$EVM_RPC" \
  --private-key "$PRIVATE_KEY" \
  0xRECIPIENT_ADDRESS \
  --value "1ether"

# 查看交易详情
cast tx --rpc-url "$EVM_RPC" 0xTX_HASH

# 查看交易收据
cast receipt --rpc-url "$EVM_RPC" 0xTX_HASH
```

### 16.6 导出 EVM 私钥 (用于 MetaMask)

```bash
# 导出 dev0 的 EVM 私钥
energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend file \
  --home "$NODE_HOME"

# 导出 wallet1 的 EVM 私钥
energychaind keys unsafe-export-eth-key wallet1 \
  --keyring-backend file \
  --home "$NODE_HOME"

# MetaMask 网络配置:
# Network Name:  EnergyChain
# RPC URL:       http://UBUNTU_IP:8575
# Chain ID:      262144
# Symbol:        ECY
# Explorer URL:  http://UBUNTU_IP:4000
```

---

## 17. 监控与运维

### 17.1 Prometheus + Grafana

```bash
mkdir -p ~/energychain/monitoring && cd ~/energychain/monitoring

cat > docker-compose.yml << 'MON_EOF'
version: '3.9'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: ec-prometheus
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: ec-grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
MON_EOF

cat > prometheus.yml << 'PROM_EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "seed"
    static_configs:
      - targets: ["host.docker.internal:26660"]

  - job_name: "sentry-0"
    static_configs:
      - targets: ["host.docker.internal:26670"]

  - job_name: "sentry-1"
    static_configs:
      - targets: ["host.docker.internal:26680"]

  - job_name: "fullnode"
    static_configs:
      - targets: ["host.docker.internal:26690"]

  - job_name: "validator-0"
    static_configs:
      - targets: ["host.docker.internal:26700"]

  - job_name: "validator-1"
    static_configs:
      - targets: ["host.docker.internal:26710"]

  - job_name: "validator-2"
    static_configs:
      - targets: ["host.docker.internal:26720"]
PROM_EOF

docker compose up -d

# Grafana: http://UBUNTU_IP:3001 (admin/admin)
# 添加 Prometheus 数据源: http://prometheus:9090
# 导入 Cosmos SDK Dashboard: ID 11036
```

### 17.2 日志管理

```bash
# 查看某个节点日志
sudo journalctl -u energychain-fullnode -f --no-hostname -n 100

# 查看所有节点错误日志
for svc in seed sentry-0 sentry-1 fullnode validator-0 validator-1 validator-2; do
  echo "=== ${svc} ==="
  sudo journalctl -u "energychain-${svc}" --since "1 hour ago" --no-hostname -p err | tail -5
  echo ""
done

# 日志轮转 (防止磁盘爆满)
sudo bash -c 'cat > /etc/logrotate.d/energychain' << 'LOGROTATE_EOF'
/var/log/energychain/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGROTATE_EOF
```

### 17.3 备份策略

```bash
# 创建备份脚本
cat > ~/energychain/backup.sh << 'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="$HOME/energychain-backups/$(date +%Y%m%d_%H%M%S)"
BASE_HOME="$HOME/.energychain-production"

mkdir -p "$BACKUP_DIR"

# 备份所有验证者的密钥 (最重要)
for i in 0 1 2; do
  cp -r "${BASE_HOME}/validator-${i}/config/priv_validator_key.json" \
    "${BACKUP_DIR}/validator-${i}_priv_key.json"
  cp -r "${BASE_HOME}/validator-${i}/config/node_key.json" \
    "${BACKUP_DIR}/validator-${i}_node_key.json"
done

# 备份 keyring
cp -r "${BASE_HOME}/validator-0/keyring-file" "${BACKUP_DIR}/keyring-file"

# 备份创世文件
cp "${BASE_HOME}/validator-0/config/genesis.json" "${BACKUP_DIR}/genesis.json"

echo "Backup completed: ${BACKUP_DIR}"
ls -la "${BACKUP_DIR}"
BACKUP_EOF

chmod +x ~/energychain/backup.sh

# 立即执行一次备份
~/energychain/backup.sh

# 设置定时备份 (每天凌晨 2 点)
(crontab -l 2>/dev/null; echo "0 2 * * * $HOME/energychain/backup.sh >> $HOME/energychain/backup.log 2>&1") | crontab -
```

---

## 18. 安全加固清单

- [ ] 所有验证者助记词已离线备份 (纸质/加密U盘)
- [ ] `priv_validator_key.json` 权限设为 `600` (`chmod 600`)
- [ ] 验证者 RPC/API 端口绑定到 `127.0.0.1` (不对外暴露)
- [ ] 验证者仅通过 Sentry 节点通信 (PEX 已关闭)
- [ ] Sentry 节点的 `private_peer_ids` 已配置验证者 ID
- [ ] 防火墙已配置 (只开放必要端口)
- [ ] SSH 使用密钥认证 (禁用密码登录)
- [ ] Blockscout `SECRET_KEY_BASE` 已更换为随机值
- [ ] 生产环境不使用 `test` keyring (应使用 `file` 或 `os`)
- [ ] EVM JSON-RPC 的 `personal` 和 `debug` API 仅在 fullnode 开放
- [ ] 定期备份验证者密钥和链数据
- [ ] 监控告警已配置 (节点掉线、磁盘空间等)
- [ ] 考虑设置 Cosmovisor 实现链升级自动化

---

## 快速参考卡片

```
┌──────────────────────────────────────────────────────────────┐
│                    EnergyChain 快速参考                       │
├──────────────────────────────────────────────────────────────┤
│ Chain ID (Cosmos):  energychain_9001-1                       │
│ Chain ID (EVM):     262144                                   │
│ Denom:              uecy / ecy (18 decimals)                 │
│ Bech32 Prefix:      energy                                   │
│ Min Gas Price:      10000000000uecy (10 Gwei)                │
│ Binary:             energychaind                             │
│ Home Dir:           ~/.energychaind (single)                 │
│                     ~/.energychain-production (multi-node)   │
├──────────────────────────────────────────────────────────────┤
│ Full Node EVM RPC:  http://UBUNTU_IP:8575                    │
│ Full Node REST:     http://UBUNTU_IP:1320                    │
│ Full Node CometBFT: http://UBUNTU_IP:26687                  │
│ Full Node gRPC:     UBUNTU_IP:9390                           │
│ Blockscout:         http://UBUNTU_IP:4000                    │
│ Ping.pub:           http://UBUNTU_IP:8080                    │
│ DEX:                http://UBUNTU_IP:3000                    │
│ Grafana:            http://UBUNTU_IP:3001                    │
└──────────────────────────────────────────────────────────────┘
```
