import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { config } from "./config/index.js";
import { createRouter } from "./api/routes.js";
import { EventIndexer } from "./indexer/EventIndexer.js";
import { PriceService } from "./services/PriceService.js";

const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "";

async function main() {
  if (!FACTORY_ADDRESS) {
    console.error("FACTORY_ADDRESS env var is required. Set it from dex-deployment.json.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log("[DB] Connected to PostgreSQL");

  const indexer = new EventIndexer(prisma, FACTORY_ADDRESS);
  await indexer.start();

  const priceService = new PriceService(prisma);

  // Periodic stats update
  setInterval(async () => {
    const pairs = await prisma.pair.findMany();
    for (const p of pairs) {
      await priceService.updatePairStats(p.address);
      for (const interval of ["1m", "5m", "1h", "1d"]) {
        await priceService.generateOHLCV(p.address, interval);
      }
    }
  }, 30_000);

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/v1", createRouter(prisma));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.listen(config.port, () => {
    console.log(`[API] DEX Indexer API running on http://localhost:${config.port}`);
    console.log(`[API] Health: http://localhost:${config.port}/health`);
  });
}

main().catch(console.error);
