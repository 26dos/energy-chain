import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { PriceService } from "../services/PriceService.js";

export function createRouter(prisma: PrismaClient) {
  const router = Router();
  const priceService = new PriceService(prisma);

  // GET /api/v1/tokens
  router.get("/tokens", async (_req, res) => {
    const tokens = await prisma.token.findMany({ orderBy: { volume24h: "desc" } });
    res.json(tokens);
  });

  // GET /api/v1/tokens/:address
  router.get("/tokens/:address", async (req, res) => {
    const token = await prisma.token.findUnique({
      where: { address: req.params.address.toLowerCase() },
      include: { pairsAsToken0: true, pairsAsToken1: true },
    });
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(token);
  });

  // GET /api/v1/pairs
  router.get("/pairs", async (_req, res) => {
    const pairs = await prisma.pair.findMany({
      include: { token0: true, token1: true },
      orderBy: { tvlUsd: "desc" },
    });
    res.json(pairs);
  });

  // GET /api/v1/pairs/:address
  router.get("/pairs/:address", async (req, res) => {
    const pair = await prisma.pair.findUnique({
      where: { address: req.params.address.toLowerCase() },
      include: { token0: true, token1: true },
    });
    if (!pair) return res.status(404).json({ error: "Pair not found" });
    res.json(pair);
  });

  // GET /api/v1/pairs/:address/swaps
  router.get("/pairs/:address/swaps", async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const swaps = await prisma.swap.findMany({
      where: { pairAddr: req.params.address.toLowerCase() },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.swap.count({ where: { pairAddr: req.params.address.toLowerCase() } });
    res.json({ data: swaps, total, page, limit });
  });

  // GET /api/v1/pairs/:address/ohlcv
  router.get("/pairs/:address/ohlcv", async (req, res) => {
    const interval = (req.query.interval as string) || "1h";
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);
    const candles = await prisma.oHLCV.findMany({
      where: { pairAddr: req.params.address.toLowerCase(), interval },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    res.json(candles.reverse());
  });

  // GET /api/v1/stats
  router.get("/stats", async (_req, res) => {
    const [pairCount, totalSwaps, pairs] = await Promise.all([
      prisma.pair.count(),
      prisma.swap.count(),
      prisma.pair.findMany(),
    ]);
    const totalTvl = pairs.reduce((sum, p) => sum + p.tvlUsd, 0);
    const totalVolume24h = pairs.reduce((sum, p) => sum + p.volume24h, 0);
    res.json({ pairCount, totalSwaps, totalTvl, totalVolume24h, tokenCount: await prisma.token.count() });
  });

  // GET /api/v1/user/:address/txs
  router.get("/user/:address/txs", async (req, res) => {
    const addr = req.params.address.toLowerCase();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const swaps = await prisma.swap.findMany({
      where: { OR: [{ sender: addr }, { to: addr }] },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    res.json(swaps);
  });

  // GET /api/v1/search
  router.get("/search", async (req, res) => {
    const q = (req.query.q as string || "").toLowerCase();
    if (!q) return res.json({ tokens: [], pairs: [] });

    const tokens = await prisma.token.findMany({
      where: {
        OR: [
          { symbol: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { address: { startsWith: q } },
        ],
      },
      take: 10,
    });

    const pairs = await prisma.pair.findMany({
      where: { address: { startsWith: q } },
      include: { token0: true, token1: true },
      take: 5,
    });

    res.json({ tokens, pairs });
  });

  return router;
}
