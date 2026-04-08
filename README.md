# Energy Chain - 能源公链

面向中国电力市场的能源公链，基于 **Cosmos SDK + Ethermint (EVM)** 构建。支持智能合约部署、BFT 即时最终性、IBC 跨链，以及各类能源业务数据上链存证与溯源。

## 技术栈

| 层级 | 技术 |
|------|------|
| 共识 | CometBFT (PoS + BFT)，2 秒出块，即时最终性 |
| 链框架 | Cosmos SDK v0.54 + Cosmos EVM |
| EVM | Ethermint，完全兼容以太坊工具链 |
| DEX | Uniswap V2 Fork (Solidity)，React DApp |
| 跨链 | IBC (Inter-Blockchain Communication) |
| 密码学 | secp256k1 + Keccak-256 (非国密) |
| 合约 | Solidity ^0.8.20，Hardhat + OpenZeppelin |
| Token | ECY (Energy Chain Yield)，总量 10 亿 |

## 链参数

- **Chain ID**: `energychain_9001-1`（EVM: `262144` / `0x40000`）
- **Denom**: `uecy` (1 ECY = 10^18 uecy)
- **Bech32 Prefix**: `energy`
- **出块时间**: 2 秒
- **验证者上限**: 100（初始 4 个）
- **解绑期**: 14 天
- **通胀**: 2% - 8%（目标质押率 67%）
- **Gas**: min-gas-prices = 10 Gwei（10000000000 uecy），支持 EIP-1559

## 工程结构

```
energy-chain/
├── docs/                              # 需求、架构与选型文档
├── chain/                             # Cosmos SDK + EVM 链 (Go)
│   ├── app.go                         # 链主程序（NewEnergyChainApp）
│   ├── cmd/energychaind/              # 节点 CLI 入口
│   ├── x/                             # 自定义 Cosmos 模块
│   │   ├── energy/                    # 能源数据存证 + MerkleRoot 校验
│   │   ├── oracle/                    # 预言机（时间戳范围校验）
│   │   ├── identity/                  # 身份与准入（params-based admin）
│   │   └── audit/                     # 审计日志（AllowedAuditors 白名单）
│   ├── config/                        # 链配置（Bech32=energy, .energychaind）
│   └── scripts/                       # 节点启动脚本
├── contracts/                         # Solidity 智能合约 (Hardhat)
│   ├── contracts/
│   │   ├── EnergyDataAttestation.sol  # 数据存证合约
│   │   └── dex/                       # DEX 合约（Uniswap V2 Fork）
│   │       ├── WECY.sol               # Wrapped ECY
│   │       ├── UniswapV2Factory.sol   # 交易对工厂
│   │       ├── UniswapV2Router02.sol  # 路由合约
│   │       └── UniswapV2Pair.sol      # 交易对合约
│   ├── test/                          # 合约测试（23 个用例）
│   └── scripts/                       # 部署脚本
├── dex-frontend/                      # DEX 前端 DApp (React + Vite)
│   └── src/
│       ├── components/                # Swap, Charts, etc.
│       ├── pages/                     # Swap, Pool, Charts, Tokens, Portfolio, Transfer, Farm
│       └── config/                    # 合约地址、Token 配置
├── dex-indexer/                       # DEX 索引服务 (Node.js + PostgreSQL)
├── cli/                               # 数据存证 CLI 工具
├── ping-explorer/                     # Cosmos 侧浏览器
└── blockscout-explorer/               # EVM 侧浏览器 (Docker)
```

## 数据溯源原理

本系统的核心目标是让**任意能源数据**（合同、结算、计量、充电记录等）都能在链上获得不可篡改的存证，并支持溯源验证。

### 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                       链下 (Off-chain)                       │
│                                                             │
│  1. 原始数据（JSON/文件/任意格式）                             │
│     ↓                                                       │
│  2. 计算 keccak256 哈希 → 32 字节指纹                         │
│     ↓                                                       │
│  3. 通过 CLI / SDK 调用合约的 attest() 方法                    │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                       链上 (On-chain)                        │
│                                                             │
│  合约存储：                                                   │
│  ┌──────────────────────────────────────────────┐           │
│  │ dataHash    = 0xabc...  (数据指纹)            │           │
│  │ submitter   = 0x123...  (谁提交)              │           │
│  │ timestamp   = 1710...   (何时提交)             │           │
│  │ blockNumber = 42        (哪个区块)             │           │
│  │ dataType    = "meter"   (业务类型)             │           │
│  │ memo        = "..."     (备注)                │           │
│  └──────────────────────────────────────────────┘           │
│                                                             │
│  区块链不可篡改性保证：记录一旦上链，任何人无法修改或删除         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 溯源验证

```
验证者拿到原始数据
     ↓
本地重新计算 keccak256 哈希
     ↓
调用合约 verifyByHash(hash) 查询链上记录
     ↓
┌─── 匹配 ──→ 数据未篡改 ✓ + 获取提交者/时间/区块等信息
│
└── 不匹配 ──→ 数据被篡改 ✗ 或从未上链
```

**关键保证**：
- **完整性**: 哈希匹配证明数据与上链时完全一致，一个字节的改动都会导致哈希不同
- **时间戳证明**: 链上时间戳证明数据在该时间点已存在
- **身份证明**: 提交者地址证明由谁对数据进行背书
- **不可篡改**: 区块链共识机制保证，一旦写入就无法修改或删除
- **隐私保护**: 链上只存哈希，原始数据不上链，敏感信息不泄露

## DEX (去中心化交易所)

基于 Uniswap V2 分叉构建的全功能 DEX，支持：

- **代币交易**: ECY ↔ ERC-20、ERC-20 ↔ ERC-20
- **流动性管理**: 添加/移除流动性
- **代币创建**: 通过 ERC20TokenFactory 一键创建自定义代币
- **K线图表**: 实时价格走势与交易历史
- **资产管理**: 查看持仓、交易记录、代币转账

### 快速启动 DEX

```bash
# 1. 启动链
cd chain && bash scripts/local_node.sh -y

# 2. 部署 DEX 合约
cd contracts && npm install
PRIVATE_KEY=<your_key> npx hardhat run scripts/deploy_dex.ts --network energychain_testnet

# 3. 启动前端
cd dex-frontend && npm install && npm run dev
# 访问 http://localhost:5174
```

## 快速开始

### 前置依赖

- Go >= 1.22
- Node.js >= 18
- npm 或 yarn

### 1. 编译链

```bash
cd chain
go mod tidy
go build -o energychaind ./cmd/energychaind
```

### 2. 启动测试网

```bash
cd chain/scripts
chmod +x *.sh
./init_testnet.sh    # 初始化 4 验证者
./start_testnet.sh   # 启动测试网
```

测试网端口：
- EVM JSON-RPC: http://localhost:8545
- Cosmos RPC: http://localhost:26657
- REST API: http://localhost:1317
- gRPC: localhost:9090

### 3. 编译与测试合约

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

共 **23** 个用例，覆盖 `EnergyDataAttestation` 与 DEX（`contracts/test/DEX.test.ts` 等）。

### 4. 部署合约到测试网

```bash
cd contracts
cp .env.example .env
# 编辑 .env 填入私钥和 RPC 地址
npx hardhat run scripts/deploy.ts --network energychain_testnet
```

### 5. 使用 CLI 存证

```bash
cd cli
npm install

# 设置环境变量（或用 --rpc / --contract / --key 参数）
export ENERGY_RPC_URL=http://localhost:8545
export ENERGY_CONTRACT=<部署后的合约地址>
export ENERGY_PRIVATE_KEY=<你的私钥>
```

#### 5.1 计算哈希（不上链）

```bash
# 字符串数据
node bin/energy-cli.js hash --data '{"meter":"M001","reading":12345}'

# 文件数据
node bin/energy-cli.js hash --file ./my-data.json
```

#### 5.2 提交存证

```bash
# 从字符串数据存证（自动计算哈希）
node bin/energy-cli.js attest \
  --data '{"contract_id":"VPP-001","amount":100000}' \
  --type vpp_contract \
  --memo "虚拟电厂合同"

# 从文件存证
node bin/energy-cli.js attest \
  --file ./settlement.json \
  --type settlement \
  --memo "2026年3月结算单"

# 直接传入已计算好的哈希
node bin/energy-cli.js attest \
  --hash 0xabc123... \
  --type meter_reading
```

#### 5.3 批量存证

```bash
# 准备 JSON 数组文件，例如 data.json: ["数据1", "数据2", "数据3"]
node bin/energy-cli.js batch-attest \
  --file ./cli/examples/sample-data.json \
  --type meter_reading \
  --memo "批量电表读数"
```

#### 5.4 溯源验证

```bash
# 用原始数据验证（自动计算哈希并比对链上记录）
node bin/energy-cli.js verify \
  --data '{"contract_id":"VPP-001","amount":100000}'

# 用文件验证
node bin/energy-cli.js verify --file ./settlement.json

# 用哈希直接验证
node bin/energy-cli.js verify --hash 0xabc123...
```

#### 5.5 查询记录

```bash
# 查总存证数
node bin/energy-cli.js query --total

# 按 ID 查询
node bin/energy-cli.js query --id 1

# 按提交者查询
node bin/energy-cli.js query --submitter 0x123...

# 按业务类型查询
node bin/energy-cli.js query --type meter_reading
```

#### 5.6 查看连接信息

```bash
node bin/energy-cli.js info
```

### 6. 连接 MetaMask

- 网络名称: Energy Chain Testnet
- RPC URL: http://localhost:8545
- Chain ID: 262144 (0x40000)
- 代币符号: ECY

## 自定义 Cosmos 模块

### x/identity — 身份与准入

注册企业/用户身份，绑定链上地址与实体身份，维护白名单。

- 角色: User / RetailCompany / VPP / ChargingOperator / GridOperator / Regulator
- 消息: `MsgRegisterIdentity`, `MsgUpdateIdentity`, `MsgRevokeIdentity`

### x/oracle — 预言机

可信节点提交链下数据（电价、碳价、负荷），合约可读取。

- 消息: `MsgSubmitPrice`, `MsgAddOracle`, `MsgRemoveOracle`
- 查询: `QueryLatestPrice`, `QueryPriceHistory`

### x/audit — 审计

记录关键链上操作的审计日志，提供监管查询接口。

- 事件类型: 合约部署、大额转账、身份变更、预言机提交、治理操作等
- 查询: `QueryAuditLogs` (按时间/地址/类型过滤)

### x/energy — 能源数据存证

定义能源数据上链标准格式，支持单条和批量哈希存证。

- 数据类型: 计量、交易结算、VPP 调节、充电记录、绿证、碳排放、辅助服务
- 消息: `MsgSubmitEnergyData`, `MsgBatchSubmit`

## Token 经济 (ECY)

| 分配 | 比例 | 数量 |
|------|------|------|
| 团队 | 15% | 1.5 亿 ECY |
| 生态基金 | 30% | 3 亿 ECY |
| 社区国库 | 20% | 2 亿 ECY |
| 验证者质押 | 10% | 1 亿 ECY |
| 流通 | 25% | 2.5 亿 ECY |

## 文档

- [部署与测试指南](docs/部署与测试指南.md)
- [能源公链需求与架构文档](docs/能源公链需求与架构文档.md)
- [公链基础实现与架构](docs/公链基础实现与架构.md)
- [公链选型分析](docs/公链选型分析.md)

## License

MIT
