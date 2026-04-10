# EnergyChain 节点架构与共识机制详解

## 目录

- [整体架构](#整体架构)
- [节点类型与角色](#节点类型与角色)
- [P2P 网络拓扑](#p2p-网络拓扑)
- [共识机制 (CometBFT)](#共识机制-cometbft)
- [交易生命周期](#交易生命周期)
- [EVM 集成架构](#evm-集成架构)
- [业务模块](#业务模块)

---

## 整体架构

EnergyChain 基于 **Cosmos SDK + cosmos/evm** 构建，是一条兼容 EVM 的应用链。每个节点进程 (`energychaind`) 内部运行三个核心组件:

```
┌──────────────────────────────────────────────────────────┐
│                  energychaind 进程                         │
│                                                          │
│   ┌──────────────────────────────────────────────────┐   │
│   │  CometBFT (共识引擎)                               │   │
│   │  · P2P 网络层: 节点发现、区块/交易广播              │   │
│   │  · 共识协议: Propose → Prevote → Precommit        │   │
│   │  · 区块执行: 通过 ABCI 接口调用应用层               │   │
│   └────────────────────┬─────────────────────────────┘   │
│                        │ ABCI (Application Blockchain     │
│                        │       Interface)                 │
│   ┌────────────────────┴─────────────────────────────┐   │
│   │  Cosmos SDK 应用层                                 │   │
│   │  · AnteHandler: 签名验证、Gas 扣费、EVM 路由       │   │
│   │  · Mempool: Krakatoa / ExperimentalEVM 模式        │   │
│   │  · 模块: bank, staking, evm, energy, audit, ...    │   │
│   └────────────────────┬─────────────────────────────┘   │
│                        │                                  │
│   ┌────────────────────┴─────────────────────────────┐   │
│   │  EVM JSON-RPC 服务 (独立监管的 goroutine)           │   │
│   │  · eth_*, txpool_*, net_*, web3_*, debug_*        │   │
│   │  · 崩溃不影响共识, 自动重启 (指数退避 3s→30s)       │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

三个组件在同一个进程中通过内存接口通信 (非 RPC)，保证高性能。

---

## 节点类型与角色

EnergyChain 生产网络由 **8 个节点** 组成，分为 4 种角色:

### 1. Seed 节点 (种子节点)

| 属性 | 值 |
|------|---|
| 数量 | 1 |
| P2P 端口 | 26656 |
| 核心功能 | **地址簿服务** — 帮助新节点发现网络中的其他节点 |

```
配置特点:
  seed_mode = true          # 仅提供地址簿, 不中继交易/区块
  addr_book_strict = false  # 允许局域网 IP
  allow_duplicate_ip = true # 允许同 IP 多节点 (开发/测试)
  API / gRPC / EVM = 关闭    # 无需对外提供查询服务
```

**工作方式**: Seed 节点维护一个网络地址簿。其他节点首次启动时连接 Seed 获取可用节点地址列表，然后断开连接，直接与获取到的节点建立 P2P 连接。Seed 本身**不参与共识**，也**不转发区块和交易**。

### 2. Sentry 节点 (哨兵节点)

| 属性 | 值 |
|------|---|
| 数量 | 2 (sentry-0, sentry-1) |
| P2P 端口 | 26666, 26676 |
| 核心功能 | **验证者保护层** — 隔离验证者节点，防止 DDoS 攻击 |

```
配置特点:
  seeds = <seed节点>                  # 从 seed 发现更多节点
  persistent_peers = <对应的验证者>    # 与自己保护的验证者保持持久连接
  private_peer_ids = <验证者ID>       # 不向外泄露验证者的网络地址
  pex = true                         # 参与节点发现
  API / EVM JSON-RPC = 开启 (内部用)
```

**工作方式**: Sentry 是验证者与公网之间的中继层。外部节点只能看到 Sentry 的 IP，无法直接接触验证者。即使 Sentry 遭受攻击，可以快速更换而不影响验证者出块。

**分工**:
- Sentry-0 保护 Validator-0 和 Validator-1
- Sentry-1 保护 Validator-2 和 Validator-3

### 3. Validator 节点 (验证者节点)

| 属性 | 值 |
|------|---|
| 数量 | 4 (validator-0 ~ validator-3) |
| P2P 端口 | 26696, 26706, 26716, 26726 |
| 核心功能 | **共识出块** — 提议区块、投票、签名 |

```
配置特点:
  persistent_peers = <自己的sentry>   # 仅连接对应的 sentry
  pex = false                        # 关闭节点发现，不暴露自己
  RPC 绑定 127.0.0.1                  # 仅本地访问，不对外暴露
  质押量 = 1,000,000 ECY (1T uecy)    # 每个验证者的初始质押
```

**工作方式**: 验证者是共识的核心参与者。它们通过 Sentry 接收交易和区块，参与 CometBFT 的投票过程（见下文共识详解），对区块进行签名。验证者的网络连接**仅限**于自己的 Sentry 节点，完全隐藏在公网之后。

### 4. Fullnode 节点 (全节点)

| 属性 | 值 |
|------|---|
| 数量 | 1 |
| P2P 端口 | 26687 |
| 核心功能 | **公共 RPC 入口** — 接收用户交易、提供查询 API |

```
配置特点:
  persistent_peers = <两个sentry>     # 连接所有 sentry 保证可靠性
  mempool size = 20000               # 更大的交易池
  prometheus = true                  # 监控指标
  cors_allowed_origins = ["*"]       # 允许跨域访问
  pruning = nothing                  # 保留全部历史状态
  indexer = kv                       # 索引全部交易
  API / gRPC / EVM JSON-RPC = 全部开启

  端口:
    CometBFT RPC : 26687
    REST API     : 1320
    EVM JSON-RPC : 8575 (HTTP), 8576 (WebSocket)
    gRPC         : 9390
```

**工作方式**: Fullnode 是外部用户和服务的统一入口。它同步全部区块数据，执行全部交易，但**不参与共识投票**。用户通过它提交交易（Cosmos TX 或 EVM TX），交易会被广播到 mempool，最终被验证者打包。Blockscout 浏览器、DEX 前端、MetaMask 钱包等都连接 Fullnode。

---

## P2P 网络拓扑

```
                    Internet / 用户
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
   ┌─────────────┐              ┌─────────────┐
   │  Fullnode   │              │  Blockscout  │
   │ (公共 RPC)  │◄─────────────│  (EVM 浏览器) │
   │ P2P: 26687  │              │  via :8575   │
   └──────┬──────┘              └──────────────┘
          │
          │ persistent_peers
          │
   ┌──────┴──────────────────────────┐
   │                                 │
   ▼                                 ▼
┌──────────┐                  ┌──────────┐
│ Sentry-0 │◄───── Seed ────►│ Sentry-1 │
│ P2P:26666│    P2P:26656    │ P2P:26676│
└──┬───┬───┘                  └──┬───┬───┘
   │   │                         │   │
   │   │  persistent_peers       │   │  persistent_peers
   │   │  (private_peer_ids)     │   │  (private_peer_ids)
   │   │                         │   │
   ▼   ▼                         ▼   ▼
┌────┐┌────┐                  ┌────┐┌────┐
│V-0 ││V-1 │                  │V-2 ││V-3 │
│:696││:706│                  │:716││:726│
└────┘└────┘                  └────┘└────┘
   pex=false                     pex=false

V = Validator (验证者)
```

**数据流方向**:
1. 用户交易 → Fullnode → Sentry → Validator (提交)
2. Validator 出块 → Sentry → Fullnode → 用户 (同步)
3. Seed 仅在节点启动时提供地址簿，不参与数据转发

---

## 共识机制 (CometBFT)

EnergyChain 使用 **CometBFT** (原 Tendermint Core) 作为共识引擎，采用 **拜占庭容错 (BFT)** 共识算法，结合 **委托权益证明 (DPoS)** 模型。

### 核心参数

| 参数 | 值 | 说明 |
|------|---|------|
| 出块时间 | ~2 秒 | CometBFT 默认配置 |
| 验证者数量 | 4 | 初始配置，可通过治理增加 |
| 拜占庭容错阈值 | ⌊(4-1)/3⌋ = 1 | 最多容忍 1 个恶意/离线验证者 |
| 区块最大 Gas | 60,000,000 | 每个区块的 Gas 上限 |
| 区块最大字节 | ~22 MB | 单区块数据量上限 |
| 最低 Gas 价格 | 10 Gwei (10^10 uecy) | 交易最低费用标准 |
| 签名算法 | ed25519 | 验证者共识签名 |
| 账户签名 | eth_secp256k1 | 用户交易签名 (兼容以太坊) |

### 共识流程详解 (单区块的诞生)

每个区块的产生经历以下 **5 个阶段**:

```
时间线 ──────────────────────────────────────────────────────────►

 Height H                                                Height H+1
 ┌─────────┬───────────┬──────────────┬──────────┬───────┐
 │ Propose │  Prevote  │  Precommit   │  Commit  │ 执行  │
 │  提议    │   预投票   │    预提交     │   提交   │ 出块  │
 └─────────┴───────────┴──────────────┴──────────┴───────┘
```

#### 阶段 1: Propose (提议)

```
选定的提议者 (Proposer) ──── 构建候选区块 ──── 广播给所有验证者

提议者选择: 基于质押权重的确定性轮转
  · 质押越多的验证者被选为提议者的概率越高
  · 选择算法是确定性的 (所有节点计算结果一致)
```

1. CometBFT 根据验证者的质押权重，确定性地选出本轮的 **提议者 (Proposer)**
2. 提议者从本地 mempool 中选取交易，调用应用层的 `PrepareProposal` 组装候选区块
3. 候选区块通过 P2P 网络广播给所有验证者

**PrepareProposal 流程** (EVM 增强):
```
Mempool 中的交易
    │
    ▼
┌──────────────────────────────┐
│  EVM Mempool (Krakatoa 模式)  │
│  · 按 gas price 排序          │
│  · 提取 ETH 签名者信息        │
│  · 过滤无效 nonce             │
│  · 尊重区块 gas 上限          │
└──────────────┬───────────────┘
               │
               ▼
        候选区块 (Block Proposal)
```

#### 阶段 2: Prevote (预投票)

```
每个验证者:
  收到候选区块
    │
    ├── 验证区块格式 ✓
    ├── 验证提议者身份 ✓
    ├── 验证交易签名 ✓
    │
    ├── 全部通过 → 广播 Prevote(BlockHash)    ✅ 同意
    └── 任一失败 → 广播 Prevote(nil)          ❌ 拒绝
```

1. 所有验证者收到候选区块后，独立验证区块的合法性
2. 验证通过则签名发送 `Prevote(区块哈希)`，否则发送 `Prevote(nil)`
3. 每个验证者收集其他验证者的 Prevote

#### 阶段 3: Precommit (预提交)

```
收集 Prevotes:
  │
  ├── 收到 >2/3 质押权重的 Prevote(同一BlockHash)
  │     → 广播 Precommit(BlockHash)       ✅ 准备提交
  │
  └── 未收到 >2/3
        → 广播 Precommit(nil)             ⏳ 等待下一轮
```

1. 当某验证者收到超过 **2/3 质押权重** 对同一区块哈希的 Prevote，进入 Precommit
2. 签名并广播 `Precommit(区块哈希)`
3. 如果超时仍未收到足够 Prevote，则广播 `Precommit(nil)`，进入下一轮

#### 阶段 4: Commit (提交)

```
收集 Precommits:
  │
  └── 收到 >2/3 质押权重的 Precommit(同一BlockHash)
        → 区块被正式提交 ✅
        → 所有节点执行区块中的交易
        → 更新状态树
        → 进入 Height H+1
```

1. 当超过 **2/3 质押权重** 的 Precommit 汇聚，区块被**最终确认 (Finalized)**
2. 这是 CometBFT 的一个关键特性: **即时最终性 (Instant Finality)**
3. 不像 PoW 链需要等待多个确认，CometBFT 的区块一旦提交就是**最终的、不可逆的**

#### 阶段 5: 区块执行

```
提交的区块
    │
    ▼
┌────────────────────────────────────────┐
│  ABCI: BeginBlock                       │
│  · 分发上一区块的奖励 (distribution)     │
│  · 处理验证者变更 (staking)              │
│  · 检查证据/惩罚 (slashing)              │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  DeliverTx (逐笔执行交易)               │
│  · AnteHandler: 验签 → 扣 Gas → 路由   │
│  · Cosmos TX → 对应模块 MsgServer       │
│  · EVM TX → evm 模块 → 执行 EVM 字节码  │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  ABCI: EndBlock                         │
│  · 更新验证者集合                        │
│  · EVM 区块封装                         │
└────────────────┬───────────────────────┘
                 │
                 ▼
         状态树更新 → 新的 AppHash
```

### 拜占庭容错说明

```
4 个验证者, 每个质押 1,000,000 ECY (等权)

容错公式: f < n/3  →  f < 4/3  →  f = 1

场景 1: 1 个验证者离线
  剩余 3/4 = 75% > 66.7%  →  网络正常出块 ✅

场景 2: 2 个验证者离线
  剩余 2/4 = 50% < 66.7%  →  网络停止出块 ❌ (但不会产生错误区块)

场景 3: 1 个验证者作恶 (双签)
  诚实节点 3/4 = 75% > 66.7%  →  恶意区块被拒绝 ✅
  作恶验证者被 slashing 惩罚 (扣除质押)
```

---

## 交易生命周期

从用户发起到最终上链的完整流程:

### Cosmos 原生交易 (如: bank send, 能源数据上链)

```
用户 (CLI / 钱包)
    │
    │  1. 构建交易
    │     · 选择消息类型 (如 MsgSend, MsgSubmitEnergyData)
    │     · 设置 Gas Limit 和 Gas Price
    │     · 用 eth_secp256k1 私钥签名
    │
    ▼
Fullnode (CometBFT RPC :26687)
    │
    │  2. CheckTx (交易验证 - 不改变状态)
    │     · AnteHandler 链:
    │       ├── ValidateBasicDecorator: 基本格式检查
    │       ├── SigVerificationDecorator: 签名验证
    │       ├── DeductFeeDecorator: 检查余额 ≥ gas 费
    │       ├── IncrementSequenceDecorator: 检查 nonce
    │       └── EVMMonoDecorator: EVM 兼容处理
    │     · 通过 → 进入 mempool
    │     · 失败 → 返回错误给用户
    │
    ▼
Mempool (交易池)
    │
    │  3. 广播
    │     · Fullnode → Sentry-0 / Sentry-1
    │     · Sentry → 各 Validator
    │     · 所有节点的 mempool 中都有这笔交易
    │
    ▼
Proposer (本轮提议者)
    │
    │  4. PrepareProposal (组装区块)
    │     · 从 mempool 按优先级选取交易
    │     · EVM Krakatoa mempool 按 gas price 排序
    │     · 总 gas 不超过区块上限 (60M)
    │
    ▼
所有 Validator
    │
    │  5. 共识投票 (Prevote → Precommit → Commit)
    │     · 详见上文共识流程
    │
    ▼
所有节点
    │
    │  6. 区块执行 (DeliverTx)
    │     · 逐笔执行交易, 更新状态
    │     · 交易执行成功: 状态变更生效
    │     · 交易执行失败: 状态回滚, 但 gas 费仍扣除
    │
    ▼
区块最终确认 ✅
    · 交易被永久记录在区块链上
    · 即时最终性 — 无需等待多个确认
    · Blockscout 索引该区块/交易
```

### EVM 交易 (如: DEX 交易, 合约部署)

```
用户 (MetaMask / ethers.js)
    │
    │  1. 构建 EVM 交易
    │     · to, value, data (calldata), gasLimit, gasPrice
    │     · 用 secp256k1 私钥签名 (与以太坊完全一致)
    │
    ▼
Fullnode (EVM JSON-RPC :8575)
    │
    │  2. eth_sendRawTransaction
    │     · 解码 RLP 编码的签名交易
    │     · 包装为 Cosmos MsgEthereumTx
    │     · 注入 CometBFT mempool (同 Cosmos 交易路径)
    │
    ▼
  ... (后续流程与 Cosmos 交易相同) ...
    │
    ▼
EVM 模块执行
    │
    │  6. 在 evm 模块的 DeliverTx 中:
    │     · 创建 EVM StateDB (基于 Cosmos KV 存储)
    │     · 执行 EVM 字节码 (与以太坊完全兼容)
    │     · 产生 EVM 日志 (Events/Logs)
    │     · 返回 receipt (状态、Gas 使用、日志)
    │
    ▼
区块最终确认 ✅
    · eth_getTransactionReceipt 可查询
    · Blockscout 索引 EVM 交易和事件
    · DEX 前端通过 eth_call 读取合约状态
```

### 两种交易的关键区别

| | Cosmos 交易 | EVM 交易 |
|---|---|---|
| 签名格式 | Cosmos SDK (amino/protobuf) | RLP 编码 + keccak256 |
| 提交端口 | CometBFT RPC (26687) | EVM JSON-RPC (8575) |
| 执行引擎 | Cosmos 模块 MsgServer | EVM 虚拟机 |
| Gas 计算 | Cosmos Gas Meter | EVM Gas + 转换 |
| 工具 | energychaind CLI | MetaMask / ethers.js |
| 共识路径 | **完全相同** — 都经过 CometBFT 共识 |

---

## EVM 集成架构

EnergyChain 的 EVM 不是独立进程，而是**嵌入在 Cosmos 应用层内部**:

```
┌────────────────────────────────────────────────────────┐
│                  energychaind 进程                       │
│                                                        │
│  ┌────────────────┐     ┌──────────────────────────┐  │
│  │  CometBFT      │     │  EVM JSON-RPC 服务        │  │
│  │  共识 + P2P     │     │  (独立 goroutine)         │  │
│  │                │     │                          │  │
│  │  · 区块生产    │     │  · eth_sendRawTransaction │  │
│  │  · 交易广播    │     │  · eth_call              │  │
│  │  · 状态同步    │     │  · eth_getBalance        │  │
│  └───────┬────────┘     │  · eth_blockNumber       │  │
│          │              │  · eth_getLogs           │  │
│    ABCI  │              └────────┬─────────────────┘  │
│          │                       │                     │
│  ┌───────┴───────────────────────┴─────────────────┐  │
│  │             Cosmos SDK 应用层                      │  │
│  │                                                  │  │
│  │  ┌──────┐ ┌────────┐ ┌────────┐ ┌──────────┐   │  │
│  │  │ bank │ │staking │ │  evm   │ │ energy   │   │  │
│  │  │      │ │        │ │        │ │          │   │  │
│  │  │转账  │ │质押    │ │EVM执行 │ │能源数据  │   │  │
│  │  └──────┘ └────────┘ └───┬────┘ └──────────┘   │  │
│  │                          │                       │  │
│  │                   ┌──────┴──────┐                │  │
│  │                   │ EVM StateDB │                │  │
│  │                   │ (Cosmos KV) │                │  │
│  │                   └─────────────┘                │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**EVM 服务的容错设计**:

EVM JSON-RPC 运行在独立的 goroutine 中，由 `runEVMServicesSupervised` 函数监管。如果 EVM RPC 服务崩溃:
- 不会影响 CometBFT 共识和出块
- 不会影响 Cosmos REST/gRPC API
- 自动以指数退避 (3s → 6s → 12s → ... → 30s) 重启
- 保证共识安全性优先于 EVM 查询可用性

---

## 业务模块

### Energy 模块 (能源数据上链)

```
消息类型:
  · MsgSubmitEnergyData   — 单条能源数据上链
  · MsgBatchSubmit        — 批量上链 (含 Merkle Root 校验)

验证逻辑:
  · 提交者必须在 AllowedSubmitters 白名单中
  · 批量提交检查 MaxBatchSize 限制
  · Merkle Root 使用 Keccak256 哈希验证数据完整性

数据字段:
  · Category: 数据类别 (如 "active_power" 有功功率)
  · DataHash: 数据的 keccak256 哈希
  · Metadata: 电表编号、时间戳等元信息
```

### Oracle 模块 (预言机)

```
消息类型:
  · MsgSubmitData    — 提交外部数据
  · MsgAddOracle     — 添加授权预言机 (管理员)
  · MsgRemoveOracle  — 移除预言机 (管理员)

验证逻辑:
  · 每个数据类别有独立的授权预言机
  · 时间戳校验: |提交时间 - 区块时间| < DataMaxAge
  · 管理操作需要模块 Authority 权限
```

### Identity 模块 (身份管理)

```
消息类型:
  · MsgRegisterIdentity  — 注册身份 (管理员)
  · MsgUpdateIdentity    — 更新身份 (管理员或本人)
  · MsgRevokeIdentity    — 撤销身份 (管理员)

权限模型:
  · 注册/撤销: 仅管理员
  · 更新: 管理员或身份所有者本人
```

### Audit 模块 (审计追踪)

```
消息类型:
  · MsgRecordAudit — 记录审计事件

数据字段:
  · EventType: 事件类型
  · Target: 审计目标
  · Action: 操作描述
  · Data: 详细数据
  · TxHash: 原始交易的 SHA256 哈希 (自动生成)

验证逻辑:
  · 可选的 AllowedAuditors 白名单
  · 可选的 MaxDataSize 数据大小限制
```

---

## 附: 区块从产生到用户可见的端到端流程

```
时间 0s     用户在 MetaMask 点击 "Swap"
            │
            ▼
时间 0.01s  ethers.js 构建 EVM 交易, eth_secp256k1 签名
            │
            ▼
时间 0.02s  发送到 Fullnode EVM JSON-RPC (:8575)
            · eth_sendRawTransaction
            · 解码 → 包装为 MsgEthereumTx → CheckTx 验证
            │
            ▼
时间 0.05s  交易进入 Fullnode mempool
            · 通过 P2P 广播到 Sentry → Validator
            │
            ▼
时间 ~2s    某 Validator 被选为本轮 Proposer
            · PrepareProposal: 从 mempool 取出交易组装区块
            · 广播候选区块
            │
            ▼
时间 ~2.3s  所有 Validator 验证并 Prevote
            │
            ▼
时间 ~2.6s  收到 >2/3 Prevote → Precommit
            │
            ▼
时间 ~3s    收到 >2/3 Precommit → Commit
            · 区块最终确认 (Instant Finality)
            · DeliverTx: EVM 模块执行 Swap 合约逻辑
            │
            ▼
时间 ~3.1s  Fullnode 同步新区块
            · EVM JSON-RPC 可通过 eth_getTransactionReceipt 查询
            · DEX 前端 wagmi 检测到状态变化, 更新 UI
            │
            ▼
时间 ~5s    Blockscout 后端抓取新区块
            · 解析交易、事件、Token 转移
            · 用户可在浏览器中查看交易详情
```

**总耗时: 约 3-5 秒**，从用户提交到区块链确认并可查询。
