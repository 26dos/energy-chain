import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import { config, FACTORY_ABI, PAIR_ABI, ERC20_ABI } from "../config/index.js";

export class EventIndexer {
  private provider: ethers.JsonRpcProvider;
  private prisma: PrismaClient;
  private factoryAddress: string;
  private trackedPairs = new Set<string>();

  constructor(prisma: PrismaClient, factoryAddress: string) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.prisma = prisma;
    this.factoryAddress = factoryAddress;
  }

  async start() {
    console.log("[Indexer] Starting event indexer...");
    console.log("[Indexer] Factory:", this.factoryAddress);

    await this.loadExistingPairs();
    await this.syncHistorical();
    this.pollNewBlocks();
  }

  private async loadExistingPairs() {
    const pairs = await this.prisma.pair.findMany();
    for (const p of pairs) {
      this.trackedPairs.add(p.address.toLowerCase());
    }
    console.log(`[Indexer] Loaded ${this.trackedPairs.size} existing pairs`);
  }

  private async syncHistorical() {
    const state = await this.prisma.indexerState.findUnique({ where: { key: "lastBlock" } });
    let fromBlock = state ? parseInt(state.value) + 1 : config.startBlock;
    const currentBlock = await this.provider.getBlockNumber();

    if (fromBlock >= currentBlock) {
      console.log("[Indexer] Already synced to block", currentBlock);
      return;
    }

    console.log(`[Indexer] Syncing blocks ${fromBlock} -> ${currentBlock}`);

    const batchSize = 500;
    for (let start = fromBlock; start <= currentBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, currentBlock);
      await this.processBlockRange(start, end);
    }

    await this.prisma.indexerState.upsert({
      where: { key: "lastBlock" },
      update: { value: currentBlock.toString() },
      create: { key: "lastBlock", value: currentBlock.toString() },
    });
  }

  private async processBlockRange(from: number, to: number) {
    const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
    const pairCreatedLogs = await factory.queryFilter(factory.filters.PairCreated(), from, to);

    for (const log of pairCreatedLogs) {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed) {
        await this.handlePairCreated(parsed.args[0], parsed.args[1], parsed.args[2], log.blockNumber);
      }
    }

    for (const pairAddr of this.trackedPairs) {
      await this.indexPairEvents(pairAddr, from, to);
    }
  }

  private async handlePairCreated(token0: string, token1: string, pairAddr: string, blockNumber: number) {
    const addr = pairAddr.toLowerCase();
    if (this.trackedPairs.has(addr)) return;

    await this.ensureToken(token0);
    await this.ensureToken(token1);

    await this.prisma.pair.upsert({
      where: { address: addr },
      update: {},
      create: {
        address: addr,
        token0Addr: token0.toLowerCase(),
        token1Addr: token1.toLowerCase(),
        blockNumber,
      },
    });

    this.trackedPairs.add(addr);
    console.log(`[Indexer] New pair: ${addr}`);
  }

  private async ensureToken(address: string) {
    const addr = address.toLowerCase();
    const exists = await this.prisma.token.findUnique({ where: { address: addr } });
    if (exists) return;

    try {
      const token = new ethers.Contract(addr, ERC20_ABI, this.provider);
      const [name, symbol, decimals] = await Promise.all([
        token.name().catch(() => "Unknown"),
        token.symbol().catch(() => "???"),
        token.decimals().catch(() => 18),
      ]);

      await this.prisma.token.create({
        data: { address: addr, name, symbol, decimals: Number(decimals) },
      });
      console.log(`[Indexer] Token registered: ${symbol} (${addr})`);
    } catch (e) {
      await this.prisma.token.create({
        data: { address: addr, name: "Unknown", symbol: "???", decimals: 18 },
      });
    }
  }

  private async indexPairEvents(pairAddr: string, from: number, to: number) {
    const pair = new ethers.Contract(pairAddr, PAIR_ABI, this.provider);

    const [swapLogs, mintLogs, burnLogs, syncLogs] = await Promise.all([
      pair.queryFilter(pair.filters.Swap(), from, to),
      pair.queryFilter(pair.filters.Mint(), from, to),
      pair.queryFilter(pair.filters.Burn(), from, to),
      pair.queryFilter(pair.filters.Sync(), from, to),
    ]);

    for (const log of swapLogs) {
      const parsed = pair.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) continue;
      const block = await this.provider.getBlock(log.blockNumber);
      await this.prisma.swap.create({
        data: {
          pairAddr,
          txHash: log.transactionHash,
          sender: parsed.args[0],
          amount0In: parsed.args[1].toString(),
          amount1In: parsed.args[2].toString(),
          amount0Out: parsed.args[3].toString(),
          amount1Out: parsed.args[4].toString(),
          to: parsed.args[5],
          timestamp: new Date((block?.timestamp || 0) * 1000),
          blockNumber: log.blockNumber,
        },
      });
    }

    for (const log of mintLogs) {
      const parsed = pair.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) continue;
      const block = await this.provider.getBlock(log.blockNumber);
      await this.prisma.mint.create({
        data: {
          pairAddr,
          txHash: log.transactionHash,
          sender: parsed.args[0],
          amount0: parsed.args[1].toString(),
          amount1: parsed.args[2].toString(),
          timestamp: new Date((block?.timestamp || 0) * 1000),
          blockNumber: log.blockNumber,
        },
      });
    }

    for (const log of burnLogs) {
      const parsed = pair.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) continue;
      const block = await this.provider.getBlock(log.blockNumber);
      await this.prisma.burn.create({
        data: {
          pairAddr,
          txHash: log.transactionHash,
          sender: parsed.args[0],
          amount0: parsed.args[1].toString(),
          amount1: parsed.args[2].toString(),
          timestamp: new Date((block?.timestamp || 0) * 1000),
          blockNumber: log.blockNumber,
        },
      });
    }

    if (syncLogs.length > 0) {
      const lastSync = syncLogs[syncLogs.length - 1];
      const parsed = pair.interface.parseLog({ topics: lastSync.topics as string[], data: lastSync.data });
      if (parsed) {
        await this.prisma.pair.update({
          where: { address: pairAddr },
          data: {
            reserve0: parsed.args[0].toString(),
            reserve1: parsed.args[1].toString(),
          },
        });
      }
    }
  }

  private pollNewBlocks() {
    let lastProcessed = 0;

    setInterval(async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        if (currentBlock <= lastProcessed) return;

        const from = lastProcessed === 0 ? currentBlock : lastProcessed + 1;
        await this.processBlockRange(from, currentBlock);
        lastProcessed = currentBlock;

        await this.prisma.indexerState.upsert({
          where: { key: "lastBlock" },
          update: { value: currentBlock.toString() },
          create: { key: "lastBlock", value: currentBlock.toString() },
        });
      } catch (err) {
        console.error("[Indexer] Poll error:", err);
      }
    }, config.pollingInterval);

    console.log(`[Indexer] Polling every ${config.pollingInterval}ms`);
  }
}
