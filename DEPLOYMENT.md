# EnergyChain 部署文档

## 目录

- [快速开始](#快速开始)
- [Ubuntu 生产部署](#ubuntu-生产部署)
- [清除旧数据重新部署](#清除旧数据重新部署)
- [架构](#架构)
- [链参数](#链参数)
- [端口分配](#端口分配)
- [创建业务钱包](#创建业务钱包)
- [部署 DEX 合约](#部署-dex-合约)
- [DEX 流动性与交易](#dex-流动性与交易)
- [DEX 前端](#dex-前端)
- [批量数据上链](#批量数据上链)
- [部署区块浏览器](#部署区块浏览器)
- [MetaMask 连接](#metamask-连接)
- [持续交易保障](#持续交易保障)
- [手动测试命令](#手动测试命令)
- [脚本总览](#脚本总览)
- [停止服务](#停止服务)
- [故障排除](#故障排除)

---

## 快速开始

### 本地 Mac 单节点开发

```bash
cd chain && go install ./cmd/energychaind && cd ..
export PATH="$HOME/go/bin:$PATH"
bash chain/scripts/local_node.sh -y
```

单节点端口: CometBFT=26657, REST=1317, EVM=8545, gRPC=9090

### 本地 Mac 生产模式 (8 节点)

```bash
cd chain && go install ./cmd/energychaind && cd ..
bash chain/scripts/deploy_production.sh
```

Fullnode 端口: CometBFT=26687, REST=1320, EVM=8575, gRPC=9390

---

## Ubuntu 生产部署

### 1. 环境准备

```bash
# Go 1.23+
wget https://go.dev/dl/go1.23.4.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc

# Node.js 22 LTS (推荐 nvm 方式, 国内网络更稳定)
curl -o- https://gitee.com/mirrors/nvm/raw/master/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 如果 nvm 不可用, 手动下载:
# wget https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
# sudo tar -xJf node-v22.14.0-linux-x64.tar.xz -C /usr/local/lib/
# sudo ln -sf /usr/local/lib/node-v22.14.0-linux-x64/bin/node /usr/local/bin/node
# sudo ln -sf /usr/local/lib/node-v22.14.0-linux-x64/bin/npm /usr/local/bin/npm

# jq + Docker
sudo apt install -y jq
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 重新登录使 docker 组生效
```

### 2. 拉取代码并构建

```bash
git clone https://github.com/YOUR_ORG/energy-chain.git
cd energy-chain
git checkout main

cd chain && go install ./cmd/energychaind && cd ..
```

### 3. 部署 8 节点网络

```bash
bash chain/scripts/deploy_production.sh
```

脚本自动完成: 初始化 → 创建密钥 → 配置创世 → 分配端口 → 启动全部 8 节点

### 4. 创建钱包 → 部署合约 → 上链 → 浏览器

```bash
# 逐步执行 (推荐):

# 创建业务钱包
bash scripts/setup_wallets.sh

# 部署 DEX 合约 (需要设置环境变量指向 fullnode)
cd contracts && npm install && cd ..
export PRIVATE_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test --home ~/.energychain-production/validator-0)
export RPC_URL="http://127.0.0.1:8575"

npx hardhat run scripts/deploy_dex.ts --network energychain_testnet

# 添加流动性
npx hardhat run scripts/add_liquidity.ts --network energychain_testnet

# 启动 DEX 前端
cd dex-frontend && npm install
cp .env.example .env
# 编辑 .env 填入 contracts/dex-deployment.json 中的合约地址
npm run build && npx vite preview --port 3000 --host 0.0.0.0 &

# 启动 DEX 交易机器人 + 有功功率数据持续上链
# 方式 A: nohup (简单, 服务器重启后需手动拉起)
nohup bash scripts/run_trade_bot.sh > /tmp/trades.log 2>&1 &
nohup bash scripts/run_data_uploader.sh rawtx > /tmp/batch_upload.log 2>&1 &

# 方式 B: systemd (推荐生产环境, 服务器重启后自动拉起)
# 详见 "持续交易保障" 章节

# 部署浏览器
bash scripts/deploy_explorers.sh
```

### 5. 验证部署

```bash
# 节点数量
ps aux | grep 'energychaind start' | grep -v grep | wc -l
# 应该输出 8

# Fullnode 状态
curl -s http://127.0.0.1:26687/status | jq '.result.sync_info.latest_block_height'

# EVM JSON-RPC
curl -s -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# REST API
curl -s http://127.0.0.1:1320/cosmos/base/tendermint/v1beta1/syncing

# Blockscout
docker ps | grep blockscout

# DEX 前端
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000

# 交易机器人
ps aux | grep -E 'run_trade_bot|simulate_trades' | grep -v grep
# Ubuntu systemd: sudo systemctl status energy-trade-bot

# 批量上链
ps aux | grep -E 'run_data_uploader|batch_upload' | grep -v grep
# Ubuntu systemd: sudo systemctl status energy-data-uploader
```

---

## 清除旧数据重新部署

```bash
# 1. 停止所有服务
# Ubuntu systemd 模式:
# sudo systemctl stop energy-trade-bot energy-data-uploader 2>/dev/null || true
pkill -f 'energychaind start' || true
sleep 3
cd blockscout && docker compose down -v && cd ..
pkill -f 'run_trade_bot' || true
pkill -f 'run_data_uploader' || true
pkill -f 'batch_upload_loop' || true
pkill -f 'simulate_trades' || true
pkill -f 'serve.*ping-explorer' || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 2. 删除数据
rm -rf ~/.energychain-production ~/.energychaind ~/.energychain-evmnode
rm -rf ping-explorer/dist
rm -f contracts/deployment.json contracts/dex-deployment.json

# 3. 重新部署 (如果代码更新了先 go install)
cd chain && go install ./cmd/energychaind && cd ..
bash chain/scripts/deploy_production.sh

# 4. 等待出块后执行后续步骤
sleep 15
bash scripts/setup_wallets.sh
# ... 继续部署 DEX、浏览器等
```

---

## 架构

```
┌──────────────────────────────────────────────────────────┐
│              EnergyChain 生产网络 (8 节点)                │
│                                                          │
│  ┌────────┐                                              │
│  │  Seed  │  P2P=26656 (种子节点, 无 API)                │
│  └───┬────┘                                              │
│      │                                                   │
│  ┌───┴──────┐    ┌──────────┐  ┌──────────┐             │
│  │ Sentry-0 │────│ Val-0    │  │ Val-1    │             │
│  │ P2P=26666│    │ P2P=26696│  │ P2P=26706│             │
│  └──────────┘    └──────────┘  └──────────┘             │
│  ┌──────────┐    ┌──────────┐  ┌──────────┐             │
│  │ Sentry-1 │────│ Val-2    │  │ Val-3    │             │
│  │ P2P=26676│    │ P2P=26716│  │ P2P=26726│             │
│  └──────────┘    └──────────┘  └──────────┘             │
│      │                                                   │
│  ┌───┴──────────────────────────────────┐                │
│  │  Fullnode (公共 RPC 端点)             │                │
│  │  CometBFT RPC : 26687               │                │
│  │  REST API     : 1320                │                │
│  │  EVM JSON-RPC : 8575                │                │
│  │  EVM WS       : 8576                │                │
│  │  gRPC         : 9390                │                │
│  └──────┬───────────┬──────────────────┘                │
│         │           │                                    │
│  ┌──────┴──────────────────────────┐                     │
│  │ Blockscout (Docker Compose)     │                     │
│  │  ┌─────────────┐               │                     │
│  │  │ Nginx Proxy │ :3001 → 前端  │                     │
│  │  │             │ :3001/api → 后端                     │
│  │  │             │ :8080 → Stats │                     │
│  │  └──────┬──────┘               │                     │
│  │   ┌─────┴─────┐ ┌───────────┐  │                     │
│  │   │ Frontend  │ │  Backend  │  │                     │
│  │   │ Next.js   │ │  v9.0.2   │  │                     │
│  │   └───────────┘ └─────┬─────┘  │                     │
│  │   ┌───────────┐ ┌─────┴─────┐  │                     │
│  │   │  Stats    │ │ Postgres  │  │                     │
│  │   │  Service  │ │ + Redis   │  │                     │
│  │   └───────────┘ └───────────┘  │                     │
│  └─────────────────────────────────┘                     │
│         │           │                                    │
│  ┌──────┴──┐  ┌─────┴────┐                              │
│  │Ping.pub │  │DEX 前端  │                              │
│  │ :5173   │  │ :3000    │                              │
│  └─────────┘  └──────────┘                              │
└──────────────────────────────────────────────────────────┘
```

## 链参数

| 参数 | 值 |
|------|------|
| Chain ID (Cosmos) | `energychain_9001-1` |
| Chain ID (EVM) | `262144` (0x40000) |
| Denom | `uecy` (micro), `ecy` (display, 18 decimals) |
| Min Gas Price | `10 Gwei` (`10000000000uecy`) |
| Key Algorithm | `eth_secp256k1` |
| Address Prefix | `energy` |
| Block Gas Limit | `60,000,000` |

## 端口分配

### 生产多节点模式

| 节点 | P2P | CometBFT RPC | EVM | REST | gRPC | 角色 |
|------|------|------|------|------|------|------|
| Seed | 26656 | 26657 | - | - | - | 种子节点 (无 API) |
| Sentry-0 | 26666 | 26667 | 8555 | 1318 | 9190 | 哨兵 (保护 Val-0,1) |
| Sentry-1 | 26676 | 26677 | 8565 | 1319 | 9290 | 哨兵 (保护 Val-2,3) |
| **Fullnode** | **26686** | **26687** | **8575** | **1320** | **9390** | **公共 RPC** |
| Val-0 | 26696 | 26697 | 8585 | 1321 | 9490 | 验证者 |
| Val-1 | 26706 | 26707 | 8595 | 1322 | 9590 | 验证者 |
| Val-2 | 26716 | 26717 | 8605 | 1323 | 9690 | 验证者 |
| Val-3 | 26726 | 26727 | 8615 | 1324 | 9790 | 验证者 |

**所有 DEX/浏览器/上链脚本都应连接 Fullnode 端口** (EVM=8575, REST=1320, RPC=26687)

### 单节点开发模式

| 服务 | 端口 |
|------|------|
| CometBFT RPC | 26657 |
| REST API | 1317 |
| EVM JSON-RPC | 8545 |
| gRPC | 9090 |

### 浏览器及服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Blockscout (统一入口) | **3001** | Nginx 代理，前端 + API 统一访问 |
| Blockscout Stats API | **8080** | 图表统计数据 (通过 Nginx 代理到 Stats 微服务) |
| Blockscout Backend | 4000 (内部) | Elixir/Phoenix API，不直接对外暴露 |
| Blockscout Frontend | 3000 (内部) | Next.js 前端，不直接对外暴露 |
| Ping.pub | 5173 | Cosmos 浏览器 |
| DEX 前端 | 3000 | EnergySwap |

---

## 创建业务钱包

```bash
# 自动创建 (推荐)
bash scripts/setup_wallets.sh
```

| 钱包 | 用途 | 资金 |
|------|------|------|
| `dev0` | 合约部署、管理 | 50,000 ECY |
| `dex-operator` | DEX 操作 | 100 ECY |
| `data-uploader` | 数据上链 | 100 ECY |
| `trader-1` | 交易测试 | 100 ECY |
| `trader-2` | 交易测试 | 100 ECY |

### 手动操作

```bash
# 生产模式的 home 目录
HOME_DIR="$HOME/.energychain-production/validator-0"
# 单节点模式用: HOME_DIR="$HOME/.energychaind"

# 创建钱包
energychaind keys add my-wallet \
  --keyring-backend test --algo eth_secp256k1 --home $HOME_DIR

# 查看地址
energychaind keys show my-wallet -a --keyring-backend test --home $HOME_DIR

# 导出 EVM 私钥 (用于 MetaMask / Hardhat)
energychaind keys unsafe-export-eth-key my-wallet \
  --keyring-backend test --home $HOME_DIR

# 转账 (100 ECY)
energychaind tx bank send validator0 \
  $(energychaind keys show my-wallet -a --keyring-backend test --home $HOME_DIR) \
  100000000000000000000uecy \
  --from validator0 --keyring-backend test --home $HOME_DIR \
  --chain-id energychain_9001-1 \
  --node tcp://127.0.0.1:26697 \
  --gas-prices 10000000000uecy --gas auto --gas-adjustment 1.5 -y

# 查看余额
energychaind query bank balance \
  $(energychaind keys show my-wallet -a --keyring-backend test --home $HOME_DIR) uecy \
  --node tcp://127.0.0.1:26687
```

---

## 部署 DEX 合约

```bash
cd contracts && npm install

# 导出私钥
export PRIVATE_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test --home ~/.energychain-production/validator-0)
export RPC_URL="http://127.0.0.1:8575"

# 部署全套 DEX 合约
npx hardhat run scripts/deploy_dex.ts --network energychain_testnet
```

部署的合约:

| 合约 | 说明 |
|------|------|
| `WECY` | Wrapped ECY |
| `UniswapV2Factory` | 交易对工厂 |
| `UniswapV2Router02` | 路由合约 |
| `Multicall3` | 批量调用聚合 |
| `ERC20TokenFactory` | ERC20 代币工厂 |
| `TestUSDT` | 测试 USDT (10 亿枚) |

合约地址保存在 `contracts/dex-deployment.json`

---

## DEX 流动性与交易

```bash
export PRIVATE_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test --home ~/.energychain-production/validator-0)
export RPC_URL="http://127.0.0.1:8575"

# 添加流动性 (100,000 USDT + 10,000 ECY)
cd contracts
npx hardhat run scripts/add_liquidity.ts --network energychain_testnet
```

### 启动交易机器人 (无限循环)

交易机器人模拟 5 个市场阶段: 吸筹 → 拉升 → 盘整 → 回调 → 突破, 每阶段 15-30 笔交易。
**一轮完成后立即开始下一轮，永不停止。** 如果 RPC 断连等异常导致进程退出，包装脚本会在 10 秒后自动重启。

```bash
# 方式 1: 使用守护包装脚本 (推荐, 崩溃自动重启)
nohup bash scripts/run_trade_bot.sh > /tmp/trades.log 2>&1 &

# 方式 2: 直接运行 (适合调试, 崩溃后需手动重启)
cd contracts
npx hardhat run scripts/simulate_trades.ts --network energychain_testnet

# 查看日志
tail -f /tmp/trades.log

# 停止
pkill -f run_trade_bot
```

> **注意**: `run_trade_bot.sh` 内部会自动读取 `dev0` 私钥和 RPC 地址，无需手动 export 环境变量。如需指定其他钱包，可 `export PRIVATE_KEY=0x...` 后再运行。

---

## DEX 前端

DEX 前端 (EnergySwap) 使用 Vite + React + wagmi 构建，合约地址等配置通过 `.env` 环境变量管理。

### 配置

```bash
cd dex-frontend
cp .env.example .env
```

编辑 `.env`，从 `contracts/dex-deployment.json` 中获取合约地址填入:

```env
# Chain
VITE_CHAIN_ID=262144
VITE_RPC_URL=http://127.0.0.1:8575
VITE_BLOCKSCOUT_URL=http://localhost:3001

# Contracts (从 contracts/dex-deployment.json 获取)
VITE_WECY=0x...
VITE_FACTORY=0x...
VITE_ROUTER=0x...
VITE_MULTICALL3=0x...
VITE_TOKEN_FACTORY=0x...

# Tokens
VITE_USDT=0x...
```

### 构建与启动

```bash
npm install
npm run build
npx vite preview --port 3000 --host 0.0.0.0

# 后台运行:
nohup npx vite preview --port 3000 --host 0.0.0.0 > /tmp/dex-frontend.log 2>&1 &
```

访问: http://localhost:3000

> **注意**: 重新部署合约后需要更新 `.env` 中的地址并重新 `npm run build`。

---

## 批量数据上链 (有功功率数据, 无限循环)

使用 `docs/有功功率数据.xlsx` 中的电表数据持续上链。**脚本以 `while true` 无限循环运行**，每轮解析全部数据逐条上链，一轮完成后等 5s 立即开始下一轮。

```bash
# 方式 1: 使用守护包装脚本 (推荐, 崩溃自动重启)
nohup bash scripts/run_data_uploader.sh rawtx > /tmp/batch_upload.log 2>&1 &

# 方式 2: 直接运行 (适合调试, 崩溃后需手动重启)
bash scripts/batch_upload_loop.sh rawtx          # 原始交易模式 (推荐, gas 更低)
bash scripts/batch_upload_loop.sh contract        # 合约存证模式 (可通过合约查询)

# 查看进度
tail -f /tmp/batch_upload.log

# 停止
pkill -f run_data_uploader    # 停止守护脚本
pkill -f batch_upload_loop    # 停止底层脚本
```

### 循环机制说明

```
┌─────────────────────────────────────────────────────┐
│  run_data_uploader.sh (外层守护)                     │
│    while true:                                       │
│      ┌───────────────────────────────────────┐      │
│      │  batch_upload_loop.sh (内层循环)       │      │
│      │    while true:                         │      │
│      │      解析 xlsx → 逐条上链 → sleep 5s   │      │
│      │    done                                │      │
│      └───────────────────────────────────────┘      │
│      如果内层脚本崩溃 → 等 10s → 自动重启            │
│    done                                              │
└─────────────────────────────────────────────────────┘
```

> **数据不断**: 即使 RPC 临时不可用，内层脚本单条失败 `|| true` 跳过继续。如果内层整个进程崩溃（如 Node.js OOM），外层守护在 10s 后自动重启。

---

## 持续交易保障

在 Ubuntu 生产环境中，仅用 `nohup` 运行后台脚本存在以下风险:
- 服务器重启后进程丢失
- SSH 断开可能导致 HUP 信号杀死进程
- 无法自动监控和重启

推荐使用 **systemd** 管理两个持续交易进程，确保**区块交易永不中断**。

### systemd 服务配置

#### 1. DEX 交易机器人

```bash
sudo tee /etc/systemd/system/energy-trade-bot.service << 'EOF'
[Unit]
Description=EnergyChain DEX Trade Bot (infinite loop)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/energy-chain
ExecStart=/bin/bash scripts/run_trade_bot.sh
Restart=always
RestartSec=15
Environment="HOME=/home/YOUR_USER"
Environment="PATH=/home/YOUR_USER/.nvm/versions/node/v22.14.0/bin:/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin"
Environment="RPC_URL=http://127.0.0.1:8575"
StandardOutput=append:/var/log/energy-trade-bot.log
StandardError=append:/var/log/energy-trade-bot.log

[Install]
WantedBy=multi-user.target
EOF
```

#### 2. 有功功率数据上链

```bash
sudo tee /etc/systemd/system/energy-data-uploader.service << 'EOF'
[Unit]
Description=EnergyChain Power Data Uploader (infinite loop)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/energy-chain
ExecStart=/bin/bash scripts/run_data_uploader.sh rawtx
Restart=always
RestartSec=15
Environment="HOME=/home/YOUR_USER"
Environment="PATH=/home/YOUR_USER/.nvm/versions/node/v22.14.0/bin:/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin"
StandardOutput=append:/var/log/energy-data-uploader.log
StandardError=append:/var/log/energy-data-uploader.log

[Install]
WantedBy=multi-user.target
EOF
```

#### 3. 启用并启动

```bash
# 替换 YOUR_USER 和 Node.js 路径
sudo sed -i "s/YOUR_USER/$USER/g" /etc/systemd/system/energy-trade-bot.service
sudo sed -i "s/YOUR_USER/$USER/g" /etc/systemd/system/energy-data-uploader.service

# 如果用 nvm, 找到 node 路径替换:
NODE_BIN_DIR=$(dirname $(which node))
sudo sed -i "s|/home/$USER/.nvm/versions/node/v22.14.0/bin|$NODE_BIN_DIR|g" \
  /etc/systemd/system/energy-trade-bot.service \
  /etc/systemd/system/energy-data-uploader.service

sudo systemctl daemon-reload
sudo systemctl enable energy-trade-bot energy-data-uploader
sudo systemctl start energy-trade-bot energy-data-uploader
```

#### 4. 管理与监控

```bash
# 查看状态
sudo systemctl status energy-trade-bot
sudo systemctl status energy-data-uploader

# 查看日志
sudo journalctl -u energy-trade-bot -f
sudo journalctl -u energy-data-uploader -f

# 或查看文件日志
tail -f /var/log/energy-trade-bot.log
tail -f /var/log/energy-data-uploader.log

# 重启
sudo systemctl restart energy-trade-bot

# 停止
sudo systemctl stop energy-trade-bot energy-data-uploader
```

### 交易流保障架构

```
                     Ubuntu 服务器
┌─────────────────────────────────────────────────────────┐
│  systemd                                                │
│  ├── energy-trade-bot.service (Restart=always)          │
│  │     └── run_trade_bot.sh  (while true 守护)          │
│  │           └── simulate_trades.ts (while(true) 交易)  │
│  │                 崩溃 → 10s 后自动重启 ↩               │
│  │                                                      │
│  ├── energy-data-uploader.service (Restart=always)      │
│  │     └── run_data_uploader.sh (while true 守护)       │
│  │           └── batch_upload_loop.sh (while true 上链)  │
│  │                 崩溃 → 10s 后自动重启 ↩               │
│  │                                                      │
│  服务器重启 → systemd 自动拉起所有 enable 的服务          │
└─────────────────────────────────────────────────────────┘
```

三层保障:
1. **内层循环**: 脚本自身 `while(true)` 无限循环，单笔失败 `try/catch` 或 `|| true` 跳过继续
2. **外层守护**: `run_trade_bot.sh` / `run_data_uploader.sh` 捕获进程退出并在 10s 后重启
3. **systemd**: 操作系统级别保障，`Restart=always` + `RestartSec=15`，服务器重启后也自动拉起

---

## 部署区块浏览器

### Blockscout (EVM 浏览器)

Blockscout 使用 Docker Compose 部署，包含以下服务:

| 服务 | 镜像 | 说明 |
|------|------|------|
| blockscout-backend | `ghcr.io/blockscout/blockscout:latest` | Elixir API 后端 (v9.0.2) |
| blockscout-frontend | `ghcr.io/blockscout/frontend:latest` | Next.js 前端 (v2.3.5) |
| blockscout-proxy | `nginx:alpine` | Nginx 反向代理 (统一入口) |
| stats | `ghcr.io/blockscout/stats:latest` | 图表统计微服务 |
| blockscout-db | `postgres:16-alpine` | 主数据库 |
| stats-db | `postgres:16-alpine` | 统计数据库 |
| blockscout-redis | `redis:7-alpine` | 缓存 |
| blockscout-verifier | `ghcr.io/blockscout/smart-contract-verifier:latest` | 合约验证 |

```bash
cd blockscout

# 生产模式 (连接 fullnode EVM 8575/8576)
EVM_HTTP_URL="http://host.docker.internal:8575" \
EVM_WS_URL="ws://host.docker.internal:8576" \
docker compose up -d

# 单节点模式 (默认连接 8545/8546)
docker compose up -d

# 首次启动后 stats 服务可能需要重启
# (等待后端索引完成后)
docker compose restart stats
```

- 统一入口: http://localhost:3001
- Stats API: http://localhost:8080
- 后端 API (内部): http://localhost:4000

> **重要**: 统一通过 3001 端口访问 Blockscout。Nginx 会自动将 `/api/*` 路由到后端，`/` 路由到前端。

### Ping.pub (Cosmos 浏览器)

```bash
cd ping-explorer

# 修改配置指向正确端口 (重要!)
# 编辑 chains/mainnet/energychain.json:
#   api address → http://localhost:1320  (生产) 或 http://localhost:1317  (单节点)
#   rpc address → http://localhost:26687 (生产) 或 http://localhost:26657 (单节点)

npm install
npx vite build
npx serve -s dist -l 5173
```

- 访问: http://localhost:5173/energychain

---

## MetaMask 连接

在 MetaMask 中添加 EnergyChain 网络:

| 设置项 | 值 |
|------|------|
| 网络名称 | EnergyChain |
| RPC URL | `http://localhost:8575` (生产) 或 `http://localhost:8545` (单节点) |
| Chain ID | `262144` |
| 货币符号 | ECY |
| 浏览器 URL | `http://localhost:3001` |

### 导入测试钱包

```bash
# 导出私钥 (以 dev0 为例)
energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test --home ~/.energychain-production/validator-0
```

在 MetaMask → 导入账户 → 粘贴私钥

### 添加自定义 Token

在 MetaMask → 导入 Token → 输入合约地址:

```bash
# 查看已部署的 Token 地址
cat contracts/dex-deployment.json | jq '.contracts.TestUSDT'
```

---

## 手动测试命令

以下命令使用**生产模式 Fullnode 端口**。单节点模式将端口替换为 26657/1317/8545。

```bash
# 最新区块高度
curl -s http://127.0.0.1:26687/status | jq '.result.sync_info.latest_block_height'

# EVM 区块号
curl -s -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# EVM Chain ID
curl -s -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# REST API 同步状态
curl -s http://127.0.0.1:1320/cosmos/base/tendermint/v1beta1/syncing

# 验证者集合
curl -s http://127.0.0.1:1320/cosmos/staking/v1beta1/validators | jq '.validators[].description.moniker'

# Cosmos 余额查询
energychaind query bank balance energy1_ADDRESS uecy --node tcp://127.0.0.1:26687

# EVM 余额查询
curl -s -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xADDRESS","latest"],"id":1}'

# 查看所有钱包
energychaind keys list --keyring-backend test \
  --home ~/.energychain-production/validator-0

# 查看 DEX 合约地址
cat contracts/dex-deployment.json

# 检查所有 8 节点状态
for port in 26657 26667 26677 26687 26697 26707 26717 26727; do
  echo "Port $port: $(curl -s http://127.0.0.1:$port/status | jq -r '.result.node_info.moniker + " h=" + .result.sync_info.latest_block_height')"
done

# Blockscout 索引状态
curl -s http://localhost:3001/api/v2/main-page/indexing-status | jq

# Blockscout Token 列表
curl -s http://localhost:3001/api/v2/tokens | jq '.items[].name'

# Stats 服务健康检查
curl -s http://localhost:8080/health
```

---

## 脚本总览

| 脚本 | 说明 |
|------|------|
| `chain/scripts/local_node.sh -y` | 单节点开发模式 |
| `chain/scripts/deploy_production.sh` | 8 节点生产模式 (seed+2sentry+fullnode+4val) |
| `scripts/setup_wallets.sh` | 创建业务钱包 + 分配资金 |
| `scripts/deploy_dex.sh` | DEX 合约部署 + 前端启动 |
| `scripts/dex_full_setup.sh` | DEX 流动性 + 交易 (`all\|liquidity\|trade\|fund\|test`) |
| `scripts/batch_upload_loop.sh` | 持续数据上链 (`contract\|rawtx`), 内层无限循环 |
| `scripts/run_trade_bot.sh` | DEX 交易机器人守护脚本 (崩溃自动重启) |
| `scripts/run_data_uploader.sh` | 数据上链守护脚本 (崩溃自动重启) |
| `scripts/deploy_explorers.sh` | 部署 Blockscout + Ping.pub |

---

## 停止服务

### Mac / 手动 nohup 模式

```bash
# 停止链节点
pkill -f 'energychaind start'

# 停止 Blockscout (含所有微服务)
cd blockscout && docker compose down

# 停止 Ping.pub
pkill -f 'serve.*ping-explorer' || lsof -ti:5173 | xargs kill -9

# 停止 DEX 前端
lsof -ti:3000 | xargs kill -9

# 停止交易机器人 (包括守护脚本)
pkill -f run_trade_bot
pkill -f simulate_trades

# 停止数据上链 (包括守护脚本)
pkill -f run_data_uploader
pkill -f batch_upload_loop
pkill -f upload_evm_contract
pkill -f upload_evm_rawtx
```

### Ubuntu systemd 模式

```bash
# 停止持续交易进程
sudo systemctl stop energy-trade-bot energy-data-uploader

# 禁止开机自启 (如不再需要)
sudo systemctl disable energy-trade-bot energy-data-uploader

# 停止链节点
pkill -f 'energychaind start'

# 停止 Blockscout
cd blockscout && docker compose down

# 停止 Ping.pub 和 DEX 前端
pkill -f 'serve.*ping-explorer' || lsof -ti:5173 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

---

## 故障排除

### EVM JSON-RPC 无法连接

1. 确认 fullnode 进程在运行: `ps aux | grep energychaind | grep fullnode`
2. 检查 EVM 日志: `grep -i "EVM\|JSON-RPC" ~/.energychain-production/logs/fullnode.log | tail -10`
3. EVM 服务已内置**自动重启机制** (解耦于 CometBFT 共识), 如果崩溃会自动恢复 (指数退避 3s→30s)
4. 确认使用正确端口: 生产模式 EVM=**8575**, 单节点模式 EVM=8545

### gRPC 端口冲突导致 API/EVM 全部不可用

如果 CometBFT RPC 正常 (26687) 但 REST API (1320) 和 EVM (8575) 无法访问, 很可能是 **gRPC 端口冲突**。
部署脚本已修复此问题 (正确匹配 `localhost:9090` 默认地址), 但如果手动配置, 确保每个节点的 gRPC 端口不同。

### 节点启动失败: "database lock"

```bash
pkill -9 -f energychaind
sleep 3
find ~/.energychain-production/*/data -name "LOCK" -delete
```

### Blockscout 无法连接链

```bash
# 确认 EVM RPC 端口 (必须是 host.docker.internal)
docker logs blockscout-backend 2>&1 | grep "ETHEREUM_JSONRPC"

# 重启并指定正确端口
cd blockscout
docker compose down
EVM_HTTP_URL="http://host.docker.internal:8575" \
EVM_WS_URL="ws://host.docker.internal:8576" \
docker compose up -d
```

### Blockscout 索引卡在 0 块

Cosmos EVM 的创世块是 block 1 (不是 block 0)。确保 `blockscout-backend` 环境变量中设置了:

```yaml
FIRST_BLOCK: "1"
```

### Blockscout 图表显示 "No data"

Stats 微服务可能在后端数据库就绪之前启动，导致初始聚合失败:

```bash
# 等待后端索引完成后重启 stats 服务
docker compose restart stats

# 验证 stats API 是否有数据
curl -s http://localhost:8080/api/v1/counters | jq '.counters[] | {id, value}'
```

如果 CORS 预检失败 (浏览器控制台出现跨域错误)，检查 nginx 配置中是否正确处理了 OPTIONS 请求 (应返回 204)。

### Blockscout Tokens 页面 500 错误

1. 确认使用 GHCR 的后端镜像 (`ghcr.io/blockscout/blockscout:latest`)，而不是 Docker Hub 的 (`blockscout/blockscout:latest`)。两者版本差异很大。
2. 确认前后端版本匹配。推荐同时使用 `latest` tag。
3. 确认 nginx 代理正确路由 `/api/*` 到后端。

### Ping.pub 无数据

```bash
# 确认 REST API 可访问
curl -s http://127.0.0.1:1320/cosmos/staking/v1beta1/validators | jq

# 检查配置文件端口
cat ping-explorer/chains/mainnet/energychain.json

# 重新构建
cd ping-explorer && rm -rf dist && npx vite build && npx serve -s dist -l 5173
```

### DEX 前端余额/池子显示为 0

1. 确认 `.env` 中的合约地址与 `contracts/dex-deployment.json` 一致
2. 确认 `VITE_RPC_URL` 指向正确的 EVM 端口 (生产模式=8575)
3. 修改 `.env` 后需要重新 `npm run build`
4. 确认交易模拟脚本在运行: `ps aux | grep simulate_trades`

### 区块交易中断 / 无新交易

交易依赖两个持续运行的后台进程。如果交易中断:

```bash
# 1. 检查进程是否在运行
ps aux | grep -E 'run_trade_bot|simulate_trades' | grep -v grep
ps aux | grep -E 'run_data_uploader|batch_upload' | grep -v grep

# 2. Ubuntu systemd 模式检查
sudo systemctl status energy-trade-bot
sudo systemctl status energy-data-uploader

# 3. 查看日志定位崩溃原因
tail -50 /var/log/energy-trade-bot.log     # systemd 模式
tail -50 /tmp/trades.log                    # nohup 模式

# 4. 常见原因:
#    - RPC 端口不对 (应为 8575, 不是 8545)
#    - dev0 私钥未导出或不匹配
#    - 合约地址变更但脚本读取了旧的 dex-deployment.json
#    - Node.js 或 npx 不在 PATH 中 (systemd 环境变量问题)

# 5. 手动快速恢复
export PRIVATE_KEY=$(energychaind keys unsafe-export-eth-key dev0 \
  --keyring-backend test --home ~/.energychain-production/validator-0)
export RPC_URL="http://127.0.0.1:8575"
nohup bash scripts/run_trade_bot.sh > /tmp/trades.log 2>&1 &
nohup bash scripts/run_data_uploader.sh rawtx > /tmp/batch_upload.log 2>&1 &
```

### macOS vs Linux sed 差异

部署脚本已内置 `sedi()` 函数自动兼容两种系统。

### 端口已占用

```bash
lsof -nP -iTCP:PORT -sTCP:LISTEN
kill -9 PID
```

---

## 目录结构

```
energy-chain/
├── chain/                       # 链源码 (Cosmos SDK + EVM)
│   ├── cmd/energychaind/cmd/
│   │   ├── root.go              # CLI 入口
│   │   └── evm_server.go        # EVM 服务隔离 (防止 JSON-RPC 崩溃)
│   └── scripts/
│       ├── local_node.sh        # 单节点开发
│       └── deploy_production.sh # 多节点生产
├── contracts/                   # Solidity 合约
│   ├── contracts/dex/           # UniswapV2 DEX
│   ├── contracts/utils/         # ERC20TokenFactory, Multicall3
│   ├── scripts/                 # 部署/测试脚本
│   ├── deployment.json          # EnergyDataAttestation 地址
│   └── dex-deployment.json      # DEX 合约地址
├── dex-frontend/                # DEX 前端 (React/Vite/wagmi)
│   ├── .env.example             # 环境变量模板
│   ├── .env                     # 本地环境变量 (不提交)
│   └── src/config/              # 配置 (从环境变量读取)
├── ping-explorer/               # Ping.pub Cosmos 浏览器
├── blockscout/                  # Blockscout Docker 配置
│   ├── docker-compose.yml       # 完整服务编排 (8 个容器)
│   └── proxy/                   # Nginx 配置模板
├── docs/有功功率数据.xlsx         # 电表数据
├── scripts/                     # 部署运维脚本
│   ├── setup_wallets.sh
│   ├── deploy_dex.sh
│   ├── dex_full_setup.sh
│   ├── batch_upload_loop.sh    # 有功功率数据上链 (内层无限循环)
│   ├── run_data_uploader.sh    # 数据上链守护 (外层, 崩溃自动重启)
│   ├── run_trade_bot.sh        # DEX 交易机器人守护 (外层, 崩溃自动重启)
│   ├── deploy_explorers.sh
│   ├── upload_evm_contract.js
│   └── upload_evm_rawtx.js
└── DEPLOYMENT.md
```
