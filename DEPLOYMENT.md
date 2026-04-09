# EnergyChain 部署文档

## 目录

- [快速开始 (本地 Mac)](#快速开始-本地-mac)
- [Ubuntu 生产部署](#ubuntu-生产部署)
- [Ubuntu 重新部署 (清除旧数据)](#ubuntu-重新部署-清除旧数据)
- [架构](#架构)
- [前置条件](#前置条件)
- [链参数](#链参数)
- [第一步: 创建业务钱包](#第一步-创建业务钱包)
- [第二步: 部署 DEX 合约](#第二步-部署-dex-合约)
- [第三步: DEX 流动性与交易](#第三步-dex-流动性与交易)
- [第四步: 批量数据上链](#第四步-批量数据上链)
- [第五步: 部署区块浏览器](#第五步-部署区块浏览器)
- [手动测试命令](#手动测试命令)
- [脚本总览](#脚本总览)
- [停止服务](#停止服务)
- [故障排除](#故障排除)
- [目录结构](#目录结构)

---

## 快速开始 (本地 Mac)

```bash
# 1. 构建链二进制
cd chain && go install ./cmd/energychaind && cd ..
export PATH="$HOME/go/bin:$PATH"

# 2. 启动链节点 (单节点开发模式)
bash chain/scripts/local_node.sh -y

# 3. 创建业务钱包并分配资金
bash scripts/setup_wallets.sh

# 4. 部署 DEX 合约 + 前端
bash scripts/deploy_dex.sh

# 5. DEX 添加流动性 + 启动交易机器人
bash scripts/dex_full_setup.sh

# 6. 持续批量数据上链 (后台运行)
nohup bash scripts/batch_upload_loop.sh contract > /tmp/batch_upload.log 2>&1 &

# 7. 部署区块浏览器
bash scripts/deploy_explorers.sh
```

---

## Ubuntu 生产部署

在 Ubuntu 服务器上部署完整的生产级网络 (8 节点拓扑)。

### 1. 环境准备

```bash
# 安装 Go
wget https://go.dev/dl/go1.23.4.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 jq + Docker
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

# 构建链二进制
cd chain && go install ./cmd/energychaind && cd ..
```

### 3. 部署生产节点

```bash
# 一键部署 8 节点 (Seed + 2 Sentry + Fullnode + 4 Validator)
bash chain/scripts/deploy_production.sh
```

### 4. 后续步骤

```bash
# 创建业务钱包
bash scripts/setup_wallets.sh

# 部署 DEX
bash scripts/deploy_dex.sh

# DEX 流动性 + 交易
bash scripts/dex_full_setup.sh

# 持续数据上链
nohup bash scripts/batch_upload_loop.sh contract > /tmp/batch_upload.log 2>&1 &

# 部署浏览器
bash scripts/deploy_explorers.sh
```

---

## Ubuntu 重新部署 (清除旧数据)

当需要在 Ubuntu 上删除旧数据并重新部署时，按以下步骤操作:

### 1. 停止所有服务

```bash
# 停止链节点
pkill -f 'energychaind start' || true
sleep 3

# 停止 Blockscout
cd blockscout && docker compose down && cd ..

# 停止 Ping.pub
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# 停止 DEX 前端
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 停止批量上链脚本
pkill -f 'batch_upload_loop' || true
pkill -f 'upload_evm_contract' || true
pkill -f 'upload_evm_rawtx' || true
```

### 2. 清除旧数据

```bash
# 删除生产节点数据 (8 节点数据 + 日志)
rm -rf ~/.energychain-production

# 删除单节点数据 (如果也用了)
rm -rf ~/.energychaind

# 清除 Blockscout Docker 卷 (数据库)
cd blockscout
docker compose down -v   # -v 删除所有 volume
cd ..

# 清除 Ping.pub 构建缓存
rm -rf ping-explorer/dist

# 清除合约部署记录 (重新部署合约时需要)
# 注意: 链重新初始化后旧合约地址无效, 必须重新部署
rm -f contracts/deployment.json
rm -f contracts/dex-deployment.json
```

### 3. 重新部署

```bash
# 重新构建二进制 (如果代码有更新)
cd chain && go install ./cmd/energychaind && cd ..

# 重新部署 (选择单节点或多节点)
# 单节点:
bash chain/scripts/local_node.sh -y

# 多节点:
bash chain/scripts/deploy_production.sh

# 等待节点完全启动
sleep 10

# 创建钱包 + 部署合约 + 上链 + 浏览器
bash scripts/setup_wallets.sh
bash scripts/deploy_dex.sh
bash scripts/dex_full_setup.sh
nohup bash scripts/batch_upload_loop.sh contract > /tmp/batch_upload.log 2>&1 &
bash scripts/deploy_explorers.sh
```

### 4. 验证重新部署成功

```bash
# 检查节点运行
ps aux | grep 'energychaind start' | grep -v grep | wc -l

# 检查最新区块
curl -s http://127.0.0.1:26657/status | jq '.result.sync_info.latest_block_height'

# 检查钱包余额
energychaind query bank balances $(energychaind keys show validator --keyring-backend test -a) \
  --node http://127.0.0.1:26657

# 检查 Blockscout 容器
docker ps | grep blockscout

# 检查批量上链是否在运行
ps aux | grep batch_upload | grep -v grep
```

---

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

| 工具 | 版本 | Ubuntu 安装 | macOS 安装 |
|------|------|-------------|------------|
| Go | >= 1.23 | 见上方 Ubuntu 环境准备 | `brew install go` |
| Node.js | >= 18 | `sudo apt install nodejs` | `brew install node` |
| jq | any | `sudo apt install jq` | `brew install jq` |
| Docker | any | `curl -fsSL https://get.docker.com \| sudo sh` | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

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

---

## 第一步: 创建业务钱包

不同业务使用不同钱包，避免 nonce 冲突和资金混用:

```bash
bash scripts/setup_wallets.sh
```

该脚本创建以下钱包并从验证者账户分配资金:

| 钱包名称 | 用途 | 分配资金 |
|----------|------|---------|
| `data-submitter` | 有功功率数据上链 | 50,000 ECY |
| `dex-trader` | DEX 自动交易机器人 | 100,000 ECY |
| `dex-lp` | DEX 流动性提供 | 200,000 ECY |
| `test-user-1` | 测试转账 | 10,000 ECY |
| `test-user-2` | 测试转账 | 10,000 ECY |
| `test-user-3` | 测试转账 | 10,000 ECY |

### 手动创建钱包

```bash
# 创建单个钱包
energychaind keys add my-wallet \
  --keyring-backend test \
  --algo eth_secp256k1 \
  --home ~/.energychaind

# 查看地址
energychaind keys show my-wallet --keyring-backend test --home ~/.energychaind -a

# 导出 EVM 私钥 (用于 MetaMask)
energychaind keys unsafe-export-eth-key my-wallet \
  --keyring-backend test --home ~/.energychaind
```

### 手动转账

```bash
# Cosmos 原生转账 (1 ECY = 1000000000000000000 uecy)
energychaind tx bank send validator energy1_RECIPIENT_ADDR 10000000000000000000000uecy \
  --fees 100000000000000uecy \
  --keyring-backend test \
  --home ~/.energychaind \
  --chain-id energychain_9001-1 \
  --node http://127.0.0.1:26657 -y

# 批量转账 (10 ECY 给每个测试钱包)
for i in 1 2 3; do
  ADDR=$(energychaind keys show test-user-$i --keyring-backend test --home ~/.energychaind -a)
  energychaind tx bank send validator $ADDR 10000000000000000000uecy \
    --fees 100000000000000uecy --keyring-backend test \
    --home ~/.energychaind --chain-id energychain_9001-1 -y
  sleep 2
done
```

---

## 第二步: 部署 DEX 合约

```bash
bash scripts/deploy_dex.sh
```

该脚本部署以下合约:

| 合约 | 说明 |
|------|------|
| `WECY` | Wrapped ECY (类似 WETH) |
| `UniswapV2Factory` | 交易对工厂 |
| `UniswapV2Router02` | 路由合约 (swap/liquidity) |
| `Multicall3` | 批量调用聚合 |
| `ERC20TokenFactory` | ERC20 代币工厂 (一键创建新代币) |
| `TestUSDT` | 测试 USDT 代币 (10 亿枚，18 精度) |

部署完成后:
- 合约地址保存在 `contracts/dex-deployment.json`
- DEX 前端启动在 http://localhost:3000
- 使用 `dev0` 账户的私钥部署

### 手动部署更多测试代币

```bash
cd contracts

# 通过 TokenFactory 合约创建新代币
# (部署脚本已经创建了 TestUSDT, 可以用相同方式创建更多)
PRIVATE_KEY="YOUR_KEY" RPC_URL="http://127.0.0.1:8545" \
  npx hardhat console --network energychain_testnet

# 在 console 中:
# const tf = await ethers.getContractAt("ERC20TokenFactory", "合约地址");
# await tf.createToken("Test DAI", "DAI", 18, ethers.parseEther("1000000000"));
```

---

## 第三步: DEX 流动性与交易

### 一键执行 (添加流动性 + 启动交易)

```bash
bash scripts/dex_full_setup.sh
```

### 分步执行

```bash
# 仅添加流动性 (100,000 USDT + 10,000 ECY, 初始价格 1 ECY = 10 USDT)
bash scripts/dex_full_setup.sh liquidity

# 给交易钱包分配 USDT
bash scripts/dex_full_setup.sh fund

# 启动自动交易机器人 (无限循环, Ctrl+C 停止)
bash scripts/dex_full_setup.sh trade

# 运行 10 项完整合约测试
bash scripts/dex_full_setup.sh test
```

### 交易机器人说明

`simulate_trades.ts` 模拟真实市场行为，包含 5 个阶段循环:

| 阶段 | 买入概率 | 单笔范围 | 说明 |
|------|---------|---------|------|
| accumulate | 75% | 200-800 USDT | 吸筹 |
| rally | 90% | 500-2500 USDT | 拉升 |
| consolidate | 60% | 100-500 USDT | 盘整 |
| pullback | 40% | 150-600 USDT | 回调 |
| breakout | 93% | 800-3500 USDT | 突破 |

每个阶段 15-30 笔交易，交易间隔 1-7 秒。运行后区块链上会持续产生 swap 交易。

### 手动 DEX 操作 (Hardhat Console)

```bash
cd contracts
PRIVATE_KEY="YOUR_KEY" RPC_URL="http://127.0.0.1:8545" \
  npx hardhat console --network energychain_testnet
```

```javascript
// 在 console 中:
const dep = require('./dex-deployment.json');
const router = await ethers.getContractAt("UniswapV2Router02", dep.contracts.UniswapV2Router02);
const usdt = await ethers.getContractAt("SimpleERC20", dep.contracts.TestUSDT);

// 查看流动性池储备
const factory = await ethers.getContractAt("UniswapV2Factory", dep.contracts.UniswapV2Factory);
const pair = await factory.getPair(dep.contracts.TestUSDT, dep.contracts.WECY);
const p = await ethers.getContractAt("UniswapV2Pair", pair);
const [r0, r1] = await p.getReserves();
console.log("Reserves:", ethers.formatEther(r0), "/", ethers.formatEther(r1));

// 手动 swap: 100 ECY -> USDT
const dl = Math.floor(Date.now()/1000) + 3600;
await router.swapExactETHForTokens(0, [dep.contracts.WECY, dep.contracts.TestUSDT],
  (await ethers.getSigners())[0].address, dl,
  {value: ethers.parseEther("100"), gasLimit: 500000});
```

---

## 第四步: 批量数据上链

使用 `docs/有功功率数据.xlsx` 中的电表有功功率数据持续上链。

### 持续上链 (无限循环)

```bash
# 通过合约存证上链 (推荐, 可通过合约查询)
bash scripts/batch_upload_loop.sh contract

# 通过原始交易上链 (更便宜, 按 txHash 查询)
bash scripts/batch_upload_loop.sh rawtx

# 后台运行 (推荐)
nohup bash scripts/batch_upload_loop.sh contract > /tmp/batch_upload.log 2>&1 &

# 查看上链日志
tail -f /tmp/batch_upload.log

# 停止上链
pkill -f batch_upload_loop
```

脚本会:
1. 解析 xlsx 中的电表数据 (meter, time, value)
2. 对每条数据计算 keccak256 哈希
3. 逐条提交到链上
4. 一轮完成后等待 5 秒, 开始下一轮
5. 循环往复, 保持区块不断有数据

### 单次上链

```bash
cd scripts

# 方式 A: 合约存证
RPC_URL="http://127.0.0.1:8545" PRIVATE_KEY="YOUR_KEY" \
  node upload_evm_contract.js

# 方式 B: 原始交易
RPC_URL="http://127.0.0.1:8545" PRIVATE_KEY_B="YOUR_KEY" \
  node upload_evm_rawtx.js
```

### 上链数据格式

每条上链数据包含:

```json
{
  "schema": "energy_attestation_v1",
  "category": "active_power",
  "data_hash": "0xkeccak256...",
  "meter": "电表编号",
  "time": "时间戳",
  "value": "有功功率值"
}
```

### Cosmos 原生批量上链 (energy 模块)

除了 EVM 合约存证, 还可使用链原生 energy 模块:

```bash
# 单条上链
energychaind tx energy submit-energy-data \
  --category "active_power" \
  --data-hash "0x$(echo -n '{"meter":"M001","time":"2026-01-01","value":"100.5"}' | sha256sum | cut -d' ' -f1)" \
  --metadata '{"meter":"M001","time":"2026-01-01","value":"100.5"}' \
  --from data-submitter \
  --keyring-backend test \
  --home ~/.energychaind \
  --chain-id energychain_9001-1 \
  --fees 100000000000000uecy -y
```

---

## 第五步: 部署区块浏览器

```bash
bash scripts/deploy_explorers.sh
```

- **Blockscout** (EVM 浏览器): http://localhost:3001 (后端 API: http://localhost:4000)
- **Ping.pub** (Cosmos 浏览器): http://localhost:8080/energychain

---

## 手动测试命令

### 查询余额

```bash
# Cosmos 余额
energychaind query bank balances $(energychaind keys show validator -a --keyring-backend test --home ~/.energychaind) \
  --node http://127.0.0.1:26657

# 查看所有钱包
energychaind keys list --keyring-backend test --home ~/.energychaind

# EVM 余额 (hex wei)
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYOUR_ADDRESS","latest"],"id":1}' | jq
```

### 查看链状态

```bash
# 最新区块高度
curl -s http://127.0.0.1:26657/status | jq '.result.sync_info.latest_block_height'

# 验证者集合
curl -s http://127.0.0.1:1317/cosmos/staking/v1beta1/validators | jq '.validators[].description.moniker'

# EVM 区块号
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq

# EVM chainId
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq
```

### 钱包间转账测试

```bash
# 从 test-user-1 转 1 ECY 给 test-user-2
FROM=$(energychaind keys show test-user-1 -a --keyring-backend test --home ~/.energychaind)
TO=$(energychaind keys show test-user-2 -a --keyring-backend test --home ~/.energychaind)
energychaind tx bank send test-user-1 $TO 1000000000000000000uecy \
  --fees 100000000000000uecy \
  --keyring-backend test --home ~/.energychaind \
  --chain-id energychain_9001-1 --node http://127.0.0.1:26657 -y

# EVM 转账 (使用 cast, 需要安装 foundry)
cast send --rpc-url http://127.0.0.1:8545 \
  --private-key YOUR_PRIVATE_KEY \
  0xRECIPIENT --value 1ether
```

### 查看合约部署结果

```bash
# 查看所有 DEX 合约地址
cat contracts/dex-deployment.json | jq

# 查看 EnergyDataAttestation 合约
cat contracts/deployment.json | jq

# 查看合约总存证数
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{
    "to":"'$(jq -r .contract contracts/deployment.json)'",
    "data":"0x09d42de0"
  },"latest"],"id":1}' | jq
```

---

## 脚本总览

| 脚本 | 说明 | 用法 |
|------|------|------|
| `chain/scripts/local_node.sh` | 单节点开发模式 | `bash chain/scripts/local_node.sh -y` |
| `chain/scripts/deploy_production.sh` | 8 节点生产模式 | `bash chain/scripts/deploy_production.sh` |
| `scripts/setup_wallets.sh` | 创建 6 个业务钱包并分配资金 | `bash scripts/setup_wallets.sh` |
| `scripts/deploy_dex.sh` | 部署 DEX 合约 + 启动前端 | `bash scripts/deploy_dex.sh` |
| `scripts/dex_full_setup.sh` | DEX 流动性 + 交易机器人 | `bash scripts/dex_full_setup.sh [all\|liquidity\|trade\|fund\|test]` |
| `scripts/batch_upload_loop.sh` | 持续批量数据上链 | `bash scripts/batch_upload_loop.sh [contract\|rawtx]` |
| `scripts/deploy_explorers.sh` | 部署 Blockscout + Ping.pub | `bash scripts/deploy_explorers.sh` |

### 端口分配 (单节点模式)

| 服务 | 端口 | 说明 |
|------|------|------|
| CometBFT RPC | 26657 | Cosmos RPC |
| REST API | 1317 | Cosmos REST |
| EVM JSON-RPC | 8545 | EVM HTTP |
| EVM WebSocket | 8546 | EVM WS |
| gRPC | 9090 | gRPC |
| P2P | 26656 | P2P 通信 |
| Blockscout API | 4000 | EVM 浏览器后端 |
| Blockscout UI | 3001 | EVM 浏览器前端 |
| Ping.pub | 8080 | Cosmos 浏览器 |
| DEX Frontend | 3000 | DEX 前端 |

### 端口分配 (生产多节点模式)

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

---

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

# 停止批量上链
pkill -f batch_upload_loop
pkill -f upload_evm_contract
pkill -f upload_evm_rawtx

# 停止交易机器人
pkill -f simulate_trades
```

---

## 故障排除

### 节点启动失败: "database lock"

```bash
pkill -9 -f energychaind
sleep 3
find ~/.energychaind/data -name "LOCK" -delete
# 或生产模式:
find ~/.energychain-production/*/data -name "LOCK" -delete
```

### Blockscout 容器重启

```bash
docker logs blockscout-backend   # 查看后端错误
docker logs blockscout-frontend  # 查看前端错误
cd blockscout && docker compose down && docker compose up -d
```

### Ping.pub 无数据

```bash
# 1. 确认 API 可访问
curl -s http://127.0.0.1:1317/cosmos/staking/v1beta1/validators | jq

# 2. 检查链配置文件端口
cat ping-explorer/chains/mainnet/energychain.json | jq

# 3. 重新构建
cd ping-explorer && rm -rf dist && npm run build
cd dist && npx serve -s -l 8080 &

# 4. 浏览器硬刷新 (清缓存)
# Mac: Cmd+Shift+R   Linux: Ctrl+Shift+R
```

### 批量上链报错

```bash
# 检查 xlsx 文件是否存在
ls -la docs/有功功率数据.xlsx

# 检查合约是否部署
cat contracts/deployment.json | jq

# 手动测试 EVM RPC
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# 检查钱包余额是否足够 gas
energychaind query bank balances $(energychaind keys show data-submitter -a --keyring-backend test --home ~/.energychaind) \
  --node http://127.0.0.1:26657
```

### macOS sed 不兼容

脚本已内置 `sedi()` 函数自动检测 macOS/Linux 并使用正确的 `sed -i` 语法。

### 端口已占用

```bash
lsof -nP -iTCP:PORT -sTCP:LISTEN  # 查看占用进程
kill -9 PID                        # 终止进程
```

---

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
│   ├── contracts/utils/         # ERC20TokenFactory, Multicall3
│   ├── scripts/
│   │   ├── deploy.ts            # EnergyDataAttestation 部署
│   │   ├── deploy_dex.ts        # DEX 全套合约部署 (含 TestUSDT)
│   │   ├── add_liquidity.ts     # 添加 USDT/ECY 流动性
│   │   ├── simulate_trades.ts   # 自动交易机器人 (无限循环)
│   │   ├── fund_dev0.ts         # 给测试账户分配资金
│   │   └── test_all_dex.ts      # 10 项完整 DEX 测试
│   ├── deployment.json          # EnergyDataAttestation 合约地址
│   └── dex-deployment.json      # DEX 合约地址
├── dex-frontend/                # DEX 前端 (React/Vite/wagmi)
├── ping-explorer/               # Ping.pub Cosmos 浏览器
├── blockscout/                  # Blockscout Docker Compose
│   └── docker-compose.yml
├── docs/
│   └── 有功功率数据.xlsx          # 电表有功功率原始数据
├── scripts/
│   ├── setup_wallets.sh         # 创建业务钱包 + 分配资金
│   ├── deploy_dex.sh            # DEX 一键部署
│   ├── dex_full_setup.sh        # DEX 流动性 + 交易机器人
│   ├── batch_upload_loop.sh     # 持续批量数据上链 (无限循环)
│   ├── deploy_explorers.sh      # 浏览器部署
│   ├── parse_xlsx.js            # xlsx 数据解析
│   ├── upload_evm_contract.js   # EVM 合约存证 (单次)
│   └── upload_evm_rawtx.js      # EVM 原始交易存证 (单次)
└── DEPLOYMENT.md                # 本文档
```
