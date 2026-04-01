# CEX 集成技术方案

## 一、集成概述

EnergyChain 基于 Cosmos SDK + Cosmos EVM，对外提供标准以太坊 JSON-RPC 接口。CEX（中心化交易所）的集成方式与接入以太坊完全一致，学习成本极低。

### 1.1 EnergyChain 对 CEX 的关键特性

| 特性 | 值 | 对 CEX 的影响 |
|------|-----|-------------|
| 区块终局性 | 即时（1 区块） | 充值只需 1 确认即可入账，极大提升用户体验 |
| 出块时间 | ~3 秒 | 充值/提现确认快 |
| 地址格式 | 0x... (EVM) | 与 ETH 完全一致，无需额外适配 |
| 充值检测 | eth_getBlockByNumber | 标准以太坊扫块流程 |
| 提现发送 | eth_sendRawTransaction | 标准以太坊签名交易 |
| HD 派生路径 | m/44'/60'/0'/0/N | 与 ETH 一致 |
| Gas 机制 | EIP-1559 | 与 ETH 一致 |

---

## 二、CEX 节点部署指南

### 2.1 硬件要求

CEX 建议部署 **全节点 + Archive 节点**：

| 节点类型 | CPU | 内存 | 磁盘 | 用途 |
|---------|-----|------|------|------|
| 全节点（热钱包用） | 8 核 | 32 GB | 1 TB NVMe SSD | 充值扫块、提现发送 |
| Archive 节点 | 8 核 | 64 GB | 4 TB NVMe SSD | 历史余额查询、对账 |

### 2.2 节点部署步骤

**方式一：二进制部署**

```bash
# 1. 下载预编译二进制（或从源码编译）
wget https://github.com/energy-chain/energy-chain/releases/download/v1.0.0/energychaind-linux-amd64
chmod +x energychaind-linux-amd64
mv energychaind-linux-amd64 /usr/local/bin/energychaind

# 2. 初始化
energychaind init cex-node --chain-id energychain_1-1

# 3. 下载创世文件
wget -O ~/.energychaind/config/genesis.json \
  https://raw.githubusercontent.com/energy-chain/mainnet/main/genesis.json

# 4. 配置 seeds
sed -i 's/seeds = ""/seeds = "<seed_node_list>"/' ~/.energychaind/config/config.toml

# 5. 配置 JSON-RPC（CEX 访问）
# 编辑 app.toml，确保 JSON-RPC 开启
# [json-rpc]
# enable = true
# address = "0.0.0.0:8545"
# ws-address = "0.0.0.0:8546"
# api = "eth,net,web3,txpool"

# 6. 启动
energychaind start \
  --pruning nothing \
  --minimum-gas-prices=10000000000uecy \
  --json-rpc.api eth,txpool,net,web3
```

**方式二：Docker 部署**

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY . .
RUN go build -o energychaind ./cmd/energychaind

FROM alpine:3.19
COPY --from=builder /build/energychaind /usr/local/bin/
EXPOSE 8545 8546 26656 26657 9090 1317
ENTRYPOINT ["energychaind"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  energychain-node:
    image: energychain/node:v1.0.0
    ports:
      - "8545:8545"   # JSON-RPC HTTP
      - "8546:8546"   # JSON-RPC WebSocket
      - "26656:26656" # P2P
      - "26657:26657" # CometBFT RPC
      - "9090:9090"   # gRPC
      - "1317:1317"   # REST API
    volumes:
      - energychain-data:/root/.energychaind
    command: >
      start
      --pruning nothing
      --minimum-gas-prices=10000000000uecy
      --json-rpc.api eth,txpool,net,web3
    restart: unless-stopped

volumes:
  energychain-data:
```

### 2.3 同步方式

| 方式 | 耗时 | 磁盘 | 适用场景 |
|------|------|------|---------|
| 创世同步 | 数小时~数天 | 完整历史 | Archive 节点 |
| State Sync | 5-15 分钟 | 仅最新状态 | 全节点快速启动 |
| Snapshot 恢复 | 30-60 分钟 | 取决于快照 | 推荐的标准方式 |

**State Sync 配置（推荐 CEX 使用）：**

```toml
# config.toml
[statesync]
enable = true
rpc_servers = "https://rpc1.energychain.io:443,https://rpc2.energychain.io:443"
trust_height = 500000
trust_hash = "ABCDEF1234567890..."
trust_period = "168h0m0s"
```

### 2.4 关键配置参数说明

**config.toml：**

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `max_num_inbound_peers` | 40 | 入站连接上限 |
| `max_num_outbound_peers` | 10 | 出站连接上限 |
| `recv_rate` | 10240000 | 接收速率限制 |
| `send_rate` | 10240000 | 发送速率限制 |
| `timeout_commit` | "3s" | 出块间隔（主网参数） |

**app.toml：**

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `minimum-gas-prices` | "10000000000uecy" | 最低 Gas 价格（10 Gwei） |
| `pruning` | "nothing" | Archive 模式：保留全部历史 |
| `json-rpc.enable` | true | 启用 EVM JSON-RPC |
| `json-rpc.api` | "eth,net,web3,txpool" | 启用的 API 模块 |
| `json-rpc.gas-cap` | 30000000 | 预估 Gas 上限 |
| `json-rpc.evm-timeout` | "30s" | EVM 调用超时 |

---

## 三、钱包集成 SDK 技术规格

### 3.1 SDK 功能矩阵

| 功能 | 方法 | JSON-RPC 调用 | 说明 |
|------|------|-------------|------|
| 地址生成 | `createWallet()` | 无（本地） | HD 派生 m/44'/60'/0'/0/N |
| 地址验证 | `isValidAddress(addr)` | 无（本地） | 校验 0x 地址格式 |
| ECY 余额查询 | `getBalance(addr)` | `eth_getBalance` | 原生代币余额 |
| ERC-20 余额 | `getTokenBalance(addr, token)` | `eth_call` | 调用 balanceOf() |
| 扫块充值 | `scanBlock(height)` | `eth_getBlockByNumber` | 检测充值交易 |
| ERC-20 充值 | `scanLogs(from, to)` | `eth_getLogs` | 监听 Transfer 事件 |
| ECY 提现 | `sendTransaction(to, amount)` | `eth_sendRawTransaction` | 构造签名交易 |
| ERC-20 提现 | `sendToken(token, to, amount)` | `eth_sendRawTransaction` | 构造 ERC-20 transfer |
| Gas 估算 | `estimateGas(tx)` | `eth_estimateGas` | 预估 Gas 消耗 |
| Gas 价格 | `getGasPrice()` | `eth_gasPrice` | 当前 Gas 价格 |
| 交易状态 | `getReceipt(txHash)` | `eth_getTransactionReceipt` | 确认交易成功/失败 |
| Nonce 管理 | `getNonce(addr)` | `eth_getTransactionCount` | 获取下一个 nonce |
| Chain ID | `getChainId()` | `eth_chainId` | 返回链 ID |

### 3.2 Node.js SDK 接口设计

```typescript
// SDK 核心接口定义
interface EnergyChainSDK {
  // 钱包管理
  createWallet(): { address: string; privateKey: string; mnemonic: string };
  fromPrivateKey(key: string): Wallet;
  fromMnemonic(mnemonic: string, index?: number): Wallet;

  // 余额查询
  getBalance(address: string): Promise<bigint>;               // ECY (uecy)
  getTokenBalance(address: string, token: string): Promise<bigint>; // ERC-20

  // 充值检测
  getLatestBlockNumber(): Promise<number>;
  scanBlockForDeposits(
    blockNumber: number,
    watchAddresses: Set<string>
  ): Promise<Deposit[]>;
  scanLogsForTokenDeposits(
    fromBlock: number,
    toBlock: number,
    tokenAddress: string,
    watchAddresses: Set<string>
  ): Promise<TokenDeposit[]>;

  // 提现
  sendECY(
    privateKey: string,
    to: string,
    amount: bigint,
    options?: TxOptions
  ): Promise<TxResult>;
  sendToken(
    privateKey: string,
    tokenAddress: string,
    to: string,
    amount: bigint,
    options?: TxOptions
  ): Promise<TxResult>;

  // 交易确认
  waitForTransaction(txHash: string, timeout?: number): Promise<Receipt>;
  getTransactionReceipt(txHash: string): Promise<Receipt | null>;

  // Gas
  estimateGas(tx: TxRequest): Promise<bigint>;
  getGasPrice(): Promise<bigint>;
  getFeeHistory(blockCount: number): Promise<FeeHistory>;
}

interface Deposit {
  txHash: string;
  from: string;
  to: string;
  amount: bigint;        // uecy
  blockNumber: number;
  blockTimestamp: number;
}

interface TokenDeposit extends Deposit {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

interface TxResult {
  txHash: string;
  nonce: number;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: 'success' | 'failed';
}
```

### 3.3 Python SDK 接口设计

```python
class EnergyChainSDK:
    """EnergyChain CEX Integration SDK"""

    def __init__(self, rpc_url: str, chain_id: int = 1):
        ...

    # 钱包
    def create_wallet(self) -> dict:
        """返回 {address, private_key, mnemonic}"""
        ...

    def from_private_key(self, key: str) -> Account:
        ...

    # 余额
    def get_balance(self, address: str) -> int:
        """返回 uecy 余额"""
        ...

    def get_token_balance(self, address: str, token: str) -> int:
        """返回 ERC-20 余额"""
        ...

    # 充值扫块
    def scan_block(self, block_number: int, watch_addresses: set) -> list[Deposit]:
        """扫描指定区块中向 watch_addresses 的 ECY 转账"""
        ...

    def scan_token_deposits(
        self,
        from_block: int,
        to_block: int,
        token_address: str,
        watch_addresses: set
    ) -> list[TokenDeposit]:
        """扫描 ERC-20 Transfer 事件"""
        ...

    # 提现
    def send_ecy(self, private_key: str, to: str, amount: int, **kwargs) -> TxResult:
        """发送 ECY 提现交易"""
        ...

    def send_token(
        self,
        private_key: str,
        token_address: str,
        to: str,
        amount: int,
        **kwargs
    ) -> TxResult:
        """发送 ERC-20 提现交易"""
        ...

    # 交易确认
    def wait_for_transaction(self, tx_hash: str, timeout: int = 60) -> Receipt:
        ...

    def get_receipt(self, tx_hash: str) -> Receipt | None:
        ...

    # Gas
    def estimate_gas(self, tx: dict) -> int:
        ...

    def get_gas_price(self) -> int:
        ...
```

### 3.4 充值扫块核心逻辑

CEX 充值检测是最关键的集成逻辑，伪代码如下：

```
ECY 原生代币充值扫块流程：
──────────────────────────
1. 记录上次扫描的区块高度 lastScannedBlock
2. 循环 {
     currentBlock = eth_blockNumber()
     for height in (lastScannedBlock + 1 ... currentBlock) {
       block = eth_getBlockByNumber(height, fullTx=true)
       for tx in block.transactions {
         if tx.to in watchAddresses AND tx.value > 0 {
           // 检测到充值
           receipt = eth_getTransactionReceipt(tx.hash)
           if receipt.status == 1 {
             recordDeposit(tx.to, tx.from, tx.value, height)
           }
         }
       }
     }
     lastScannedBlock = currentBlock
     sleep(3s)  // 出块间隔
   }

ERC-20 Token 充值扫块流程：
──────────────────────────
1. Transfer 事件签名: keccak256("Transfer(address,address,uint256)")
   = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
2. 循环 {
     logs = eth_getLogs({
       fromBlock: lastScannedBlock + 1,
       toBlock: 'latest',
       address: tokenContractAddress,
       topics: [TRANSFER_TOPIC]
     })
     for log in logs {
       to = decodeAddress(log.topics[2])
       if to in watchAddresses {
         amount = decodeUint256(log.data)
         recordTokenDeposit(to, log.transactionHash, amount, log.blockNumber)
       }
     }
     lastScannedBlock = latestBlock
     sleep(3s)
   }
```

### 3.5 提现核心逻辑

```
ECY 提现流程：
──────────────
1. nonce = eth_getTransactionCount(hotWalletAddress, 'pending')
2. gasPrice = eth_gasPrice()
3. 构造交易 tx = {
     nonce: nonce,
     to: withdrawAddress,
     value: amount,
     gasLimit: 21000,          // 普通转账固定 21000
     maxFeePerGas: gasPrice * 2,
     maxPriorityFeePerGas: gasPrice / 10,
     chainId: 1,
     type: 2                   // EIP-1559
   }
4. signedTx = sign(tx, hotWalletPrivateKey)
5. txHash = eth_sendRawTransaction(signedTx)
6. 轮询 receipt = eth_getTransactionReceipt(txHash)
7. if receipt.status == 1 → 提现成功
   if receipt.status == 0 → 提现失败，需人工介入

ERC-20 提现流程：
──────────────
1. 构造 calldata = abi.encode("transfer(address,uint256)", [to, amount])
2. gasLimit = eth_estimateGas({to: tokenContract, data: calldata, from: hotWallet})
3. 交易同上，但 to=tokenContract, value=0, data=calldata
```

### 3.6 Nonce 管理注意事项

由于 CEX 可能同时发出多笔提现交易，需要做 nonce 管理：

- **方案 A：串行发送** — 每次等上一笔确认再发下一笔（简单但慢）
- **方案 B：本地 nonce 管理** — 维护一个本地 nonce 计数器，允许并行发送（推荐）
  - 本地维护 `nextNonce`，每次发交易 +1
  - 定期与链上 `eth_getTransactionCount` 对账
  - 如果某笔交易失败，需要重新补发（用相同 nonce 覆盖）
- **方案 C：队列 + Worker** — 提现请求进队列，单 worker 串行发送（稳定可靠）

---

## 四、CEX 上币申请技术对接流程

### 4.1 各交易所技术对接要求

**Binance（币安）**

| 项目 | 要求 |
|------|------|
| 技术文档 | 节点部署指南 + RPC 接口文档 |
| 源码 | 开源 GitHub 仓库 |
| 审计报告 | 至少 1 家知名审计机构 |
| 公共 RPC | 至少 2 个稳定的 RPC 端点 |
| 区块浏览器 | 可公开访问 |
| 测试环境 | 提供测试网 + 水龙头 |
| 技术对接人 | 7x24 在线技术支持 |
| 集成周期 | 通常 4-8 周 |

**OKX**

| 项目 | 要求 |
|------|------|
| 技术文档 | 标准化的资产对接文档 |
| SDK/Demo | 提供充值/提现 demo 代码 |
| 审计报告 | 需要 |
| 支持 EIP-1559 | 需确认 |
| 链上多签 | 推荐（Gnosis Safe 或类似） |
| 集成周期 | 通常 3-6 周 |

**Coinbase**

| 项目 | 要求 |
|------|------|
| 合规 | 最严格，需要 Howey Test 法律意见 |
| 注册地 | Token 发行主体不能在受制裁地区 |
| 源码审计 | 强制要求 |
| Rosetta API | 推荐实现 Coinbase Rosetta 标准 |
| 集成周期 | 通常 2-4 个月 |

### 4.2 技术对接交付物清单

CEX 上币申请时需要准备以下技术交付物：

```
交付物清单：
├── 1. 节点部署指南（Node Deployment Guide）
│   ├── 硬件要求
│   ├── 二进制/Docker 部署步骤
│   ├── 配置说明（config.toml, app.toml）
│   ├── 同步方式（State Sync / Snapshot）
│   └── 升级流程
│
├── 2. 钱包集成 SDK
│   ├── Node.js SDK + 使用示例
│   ├── Python SDK + 使用示例
│   └── 完整 API 文档
│
├── 3. RPC 接口文档
│   ├── 支持的 JSON-RPC 方法列表
│   ├── 与标准以太坊的差异点（如有）
│   ├── Rate Limit 说明
│   └── WebSocket 订阅说明
│
├── 4. 安全文档
│   ├── 链代码审计报告
│   ├── 智能合约审计报告
│   ├── Bug Bounty 计划
│   └── 安全事件响应流程
│
├── 5. Tokenomics 文档
│   ├── 总供应量、流通量
│   ├── 分配方案、锁仓计划
│   ├── 通胀/销毁机制
│   └── 多签地址和链上透明度
│
├── 6. 基础设施
│   ├── 公共 RPC 端点（带 SLA 保障）
│   ├── 区块浏览器
│   ├── 测试网 + 水龙头
│   └── 监控大盘（可选分享）
│
└── 7. 团队与法律
    ├── 团队背景
    ├── 法律实体信息
    ├── Token 法律意见书
    └── 合规声明
```

### 4.3 上币后持续技术支持

上币后 CEX 需要项目方提供的持续技术支持：

- **7x24 技术响应**：链故障、RPC 异常时即时沟通
- **链升级提前通知**：至少提前 7 天通知 CEX，协助测试
- **节点版本管理**：提供清晰的版本发布计划和变更日志
- **突发事件处理**：分叉、共识停滞等极端情况的应急预案
