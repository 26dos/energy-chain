import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";

export class PriceService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    const token = await this.prisma.token.findUnique({ where: { address: tokenAddress.toLowerCase() } });
    return token?.priceUsd ?? 0;
  }

  async updatePairStats(pairAddr: string) {
    const pair = await this.prisma.pair.findUnique({
      where: { address: pairAddr },
      include: { token0: true, token1: true },
    });
    if (!pair) return;

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const swaps = await this.prisma.swap.findMany({
      where: { pairAddr, timestamp: { gte: dayAgo } },
    });

    let volume24h = 0;
    for (const s of swaps) {
      const amt0 = parseFloat(ethers.formatEther(s.amount0In || "0")) + parseFloat(ethers.formatEther(s.amount0Out || "0"));
      const amt1 = parseFloat(ethers.formatEther(s.amount1In || "0")) + parseFloat(ethers.formatEther(s.amount1Out || "0"));
      volume24h += Math.max(amt0, amt1);
    }

    await this.prisma.pair.update({
      where: { address: pairAddr },
      data: { volume24h, txCount: swaps.length },
    });
  }

  async generateOHLCV(pairAddr: string, interval: string = "1h") {
    const pair = await this.prisma.pair.findUnique({
      where: { address: pairAddr },
      include: { token0: true, token1: true },
    });
    if (!pair) return;

    const intervalMs: Record<string, number> = {
      "1m": 60_000, "5m": 300_000, "15m": 900_000,
      "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
    };
    const ms = intervalMs[interval] || 3_600_000;

    const lastCandle = await this.prisma.oHLCV.findFirst({
      where: { pairAddr, interval },
      orderBy: { timestamp: "desc" },
    });

    const since = lastCandle ? lastCandle.timestamp : new Date(0);
    const swaps = await this.prisma.swap.findMany({
      where: { pairAddr, timestamp: { gt: since } },
      orderBy: { timestamp: "asc" },
    });

    if (swaps.length === 0) return;

    const buckets = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();

    for (const s of swaps) {
      const ts = Math.floor(s.timestamp.getTime() / ms) * ms;
      const r0 = parseFloat(ethers.formatEther(s.amount0Out || s.amount0In || "0"));
      const r1 = parseFloat(ethers.formatEther(s.amount1Out || s.amount1In || "0"));
      const price = r1 > 0 ? r0 / r1 : 0;
      const vol = Math.max(r0, r1);

      if (!buckets.has(ts)) {
        buckets.set(ts, { open: price, high: price, low: price, close: price, volume: vol });
      } else {
        const b = buckets.get(ts)!;
        b.high = Math.max(b.high, price);
        b.low = Math.min(b.low, price);
        b.close = price;
        b.volume += vol;
      }
    }

    for (const [ts, candle] of buckets) {
      await this.prisma.oHLCV.upsert({
        where: { pairAddr_interval_timestamp: { pairAddr, interval, timestamp: new Date(ts) } },
        update: candle,
        create: { pairAddr, interval, timestamp: new Date(ts), ...candle },
      });
    }
  }
}
