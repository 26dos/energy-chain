# EnergyChain 部署文档

## 快速开始

```bash
# 1. 构建链二进制
cd chain && go install ./cmd/energychaind && cd ..

# 2. 启动链节点 (单节点开发模式)
bash chain/scripts/local_node.sh -y

# 3. 部署区块浏览器 (Blockscout + Ping.pub)
bash scripts/deploy_explorers.sh

# 4. 部署 DEX 合约 + 前端
bash scripts/deploy_dex.sh
```

## 架构

```
┌──────────────────────────────────────────────────────────┐
│                    EnergyChain 网络                       │
│                                                          │
│  单节点模式 (本地开发)                                     │
│  ┌──────────────────────────────────┐                    │
│  │  energychaind                    │                    │
│  │  CometBFT RPC  : 26657          │                    │
│  │  REST API      : 1317           │                    │
│  │  EVM JSON-RPC  : 8545           │                    │
│  │  EVM WebSocket : 8546           │                    │
│  │  gRPC          : 9090           │                    │
│  │  P2P           : 26656          │                    │
│  └──────────┬───────────┬──────────┘                    │
│             │           │                                │
│  ┌──────────▼──┐  ┌─────▼──────┐  ┌─────────────┐      │
│  │  Blockscout  │  │  Ping.pub  │  │ DEX Frontend│      │
│  │  API:4000    │  │  :8080     │  │ :3000       │      │
│  │  UI:3001     │  │            │  │             │      │
│  └─────────────┘  └────────────┘  └─────────────┘      │
│                                                          │
│  生产多节点模式                                           │
│  ┌────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  Seed  │──│ Sentry-0 │──│ Val-0    │                 │
│  │ :26656 │  │ :26666   │  │ :26696   │                 │
│  │        │  │          │──│ Val-1    │                 │
│  │        │  │          │  │ :26706   │                 │
│  │        │  └──────────┘  └──────────┘                 │
│  │        │  ┌──────────┐  ┌──────────┐                 │
│  │        │──│ Sentry-1 │──│ Val-2    │                 │
│  │        │  │ :26676   │  │ :26716   │                 │
│  │        │  │          │──│ Val-3    │                 │
│  │        │  │          │  │ :26726   │                 │
│  │        │  └──────────┘  └──────────┘                 │
│  └────┬───┘                                              │
│       │      ┌──────────┐                                │
│       └──────│ Fullnode │                                │
│              │ RPC:26687│                                │
│              │ API:1320 │                                │
│              │ EVM:8575 │                                │
│              └──────────┘                                │
└──────────────────────────────────────────────────────────┘
```

## 前置条件

| 工具 | 版本 | 安装 |
|------|------|------|
| Go | >= 1.23 | `brew install go` |
| Node.js | >= 18 | `brew install node` |
| jq | any | `brew install jq` |
| Docker | any | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

## 链参数

| 参数 | 值 |
|------|------|
| Chain ID (Cosmos) | `energychain_9001-1` |
| Chain ID (EVM) | `262144` |
| Denom | `uecy` (micro), `ecy` (display, 18 decimals) |
| Min Gas Price | `10 Gwei` (`10000000000uecy`) |
| Key Algorithm | `eth_secp256k1` |
| Address Prefix | `energy` |
| Block Gas Limit | `60,000,000` |

## 脚本说明

### `chain/scripts/local_node.sh`

单节点开发模式。初始化链、创建 `validator` 和 `dev0` 账户、配置 genesis 参数、启动节点。

```bash
bash chain/scripts/local_node.sh -y
```

端口: RPC=26657, API=1317, EVM=8545, WS=8546, gRPC=9090
数据目录: `~/.energychaind/`

### `chain/scripts/deploy_production.sh`

生产多节点模式 (8 节点)。部署 Seed + 2 Sentry + Fullnode + 4 Validator。支持 macOS 和 Linux。

```bash
bash chain/scripts/deploy_production.sh
```

数据目录: `~/.energychain-production/`
日志: `~/.energychain-production/logs/`

端口分配:

| 节点 | P2P | RPC | EVM | REST | 角色 |
|------|------|------|------|------|------|
| Seed | 26656 | 26657 | - | - | 种子节点 |
| Sentry-0 | 26666 | 26667 | 8555 | 1318 | 哨兵 (保护 Val-0,1) |
| Sentry-1 | 26676 | 26677 | 8565 | 1319 | 哨兵 (保护 Val-2,3) |
| Fullnode | 26686 | 26687 | 8575 | 1320 | 公共全节点 |
| Val-0 | 26696 | 26697 | 8585 | 1321 | 验证者 |
| Val-1 | 26706 | 26707 | 8595 | 1322 | 验证者 |
| Val-2 | 26716 | 26717 | 8605 | 1323 | 验证者 |
| Val-3 | 26726 | 26727 | 8615 | 1324 | 验证者 |

### `scripts/deploy_explorers.sh`

部署 Blockscout (EVM 浏览器, Docker) 和 Ping.pub (Cosmos 浏览器)。自动检测链节点端口。

```bash
bash scripts/deploy_explorers.sh
```

- Blockscout 前端: http://localhost:3001 (后端 API: http://localhost:4000)
- Ping.pub: http://localhost:8080/energychain

### `scripts/deploy_dex.sh`

部署 DEX 合约 (WECY, Factory, Router, Multicall3, TokenFactory, TestUSDT) 并启动前端。

```bash
bash scripts/deploy_dex.sh
```

- DEX Frontend: http://localhost:3000
- 合约地址保存在 `contracts/dex-deployment.json`

## 手动测试命令

### 查询余额

```bash
# Cosmos 余额
energychaind query bank balances energy1... --node http://127.0.0.1:26657

# EVM 余额
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYOUR_ADDRESS","latest"],"id":1}'
```

### 转账

```bash
# Cosmos 转账
energychaind tx bank send validator energy1_RECIPIENT 1000000000000000000uecy \
  --fees 100000000000000uecy \
  --keyring-backend test \
  --chain-id energychain_9001-1 -y

# EVM 转账 (使用 cast)
cast send --rpc-url http://127.0.0.1:8545 \
  --private-key YOUR_PRIVATE_KEY \
  0xRECIPIENT --value 1ether
```

### 生成测试钱包

```bash
for i in $(seq 1 5); do
  energychaind keys add "test-wallet-$i" \
    --keyring-backend test \
    --algo eth_secp256k1
done
```

### 查看链状态

```bash
# 最新区块
curl -s http://127.0.0.1:26657/status | jq '.result.sync_info.latest_block_height'

# 验证者集合
curl -s http://127.0.0.1:1317/cosmos/staking/v1beta1/validators | jq '.validators[].description.moniker'

# EVM 区块号
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## 停止服务

```bash
# 停止链节点
pkill -f 'energychaind start'

# 停止 Blockscout
cd blockscout && docker compose down

# 停止 Ping.pub
lsof -ti:8080 | xargs kill -9

# 停止 DEX 前端
lsof -ti:3000 | xargs kill -9
```

## 故障排除

### 节点启动失败: "database lock"
```bash
pkill -9 -f energychaind
sleep 3
find ~/.energychaind/data -name "LOCK" -delete
# 重新启动
```

### Blockscout 容器重启
```bash
docker logs blockscout-backend  # 查看后端错误
docker logs blockscout-frontend # 查看前端错误
cd blockscout && docker compose down && docker compose up -d
```

### macOS sed 不兼容
脚本已内置 `sedi()` 函数自动检测 macOS/Linux 并使用正确的 `sed -i` 语法。

### 端口已占用
```bash
lsof -nP -iTCP:PORT -sTCP:LISTEN  # 查看占用进程
kill -9 PID                        # 终止进程
```

## 目录结构

```
energy-chain/
├── chain/                       # 链源码
│   ├── cmd/energychaind/        # 链二进制入口
│   ├── scripts/
│   │   ├── local_node.sh        # 单节点开发脚本
│   │   └── deploy_production.sh # 多节点生产脚本
│   └── x/                       # 自定义模块 (energy, audit, identity, oracle)
├── contracts/                   # Solidity 合约
│   ├── contracts/dex/           # UniswapV2 DEX 合约
│   ├── scripts/deploy_dex.ts    # DEX 部署脚本
│   └── dex-deployment.json      # 部署后的合约地址
├── dex-frontend/                # DEX 前端 (React/Vite/wagmi)
├── ping-explorer/               # Ping.pub Cosmos 浏览器
├── blockscout/                  # Blockscout Docker Compose
│   └── docker-compose.yml
├── scripts/
│   ├── deploy_explorers.sh      # 浏览器部署脚本
│   └── deploy_dex.sh            # DEX 一键部署脚本
└── DEPLOYMENT.md                # 本文档
```
