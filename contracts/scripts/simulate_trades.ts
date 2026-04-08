import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type Phase = "accumulate" | "rally" | "consolidate" | "pullback" | "breakout";

const PHASE_CONFIG: Record<Phase, {
  buyPct: number;
  buyMin: number; buyMax: number;
  sellMin: number; sellMax: number;
  minDelay: number; maxDelay: number;
}> = {
  accumulate:  { buyPct: 0.75, buyMin: 200,  buyMax: 800,   sellMin: 10,  sellMax: 60,   minDelay: 2000, maxDelay: 5000 },
  rally:       { buyPct: 0.90, buyMin: 500,  buyMax: 2500,  sellMin: 15,  sellMax: 80,   minDelay: 1000, maxDelay: 3000 },
  consolidate: { buyPct: 0.60, buyMin: 100,  buyMax: 500,   sellMin: 8,   sellMax: 50,   minDelay: 3000, maxDelay: 7000 },
  pullback:    { buyPct: 0.40, buyMin: 150,  buyMax: 600,   sellMin: 20,  sellMax: 100,  minDelay: 2000, maxDelay: 5000 },
  breakout:    { buyPct: 0.93, buyMin: 800,  buyMax: 3500,  sellMin: 10,  sellMax: 50,   minDelay: 800,  maxDelay: 2500 },
};

const PHASE_ORDER: Phase[] = ["accumulate", "rally", "consolidate", "pullback", "rally", "breakout", "consolidate"];
const TRADES_PER_PHASE = { min: 15, max: 30 };

async function main() {
  const deploymentPath = path.join(__dirname, "..", "dex-deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { WECY: wecyAddr, UniswapV2Router02: routerAddr, TestUSDT: usdtAddr } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  const router = await ethers.getContractAt("UniswapV2Router02", routerAddr);
  const usdt = await ethers.getContractAt("SimpleERC20", usdtAddr);

  const ecyBal = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
  const usdtBal = ethers.formatEther(await usdt.balanceOf(deployer.address));

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   EnergyChain Auto-Trading Bot           ║");
  console.log("║   Press Ctrl+C to stop                   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Deployer : ${deployer.address}`);
  console.log(`ECY      : ${parseFloat(ecyBal).toFixed(2)}`);
  console.log(`USDT     : ${parseFloat(usdtBal).toFixed(2)}`);
  console.log("");

  const approveTx = await usdt.approve(routerAddr, ethers.MaxUint256);
  await approveTx.wait();
  console.log("✓ USDT unlimited approval set\n");

  const deadline = () => Math.floor(Date.now() / 1000) + 3600;
  let totalTrades = 0;
  let buyCount = 0;
  let sellCount = 0;
  let round = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    round++;
    const phaseIdx = (round - 1) % PHASE_ORDER.length;
    const phase = PHASE_ORDER[phaseIdx]!;
    const cfg = PHASE_CONFIG[phase];
    const tradesInPhase = randInt(TRADES_PER_PHASE.min, TRADES_PER_PHASE.max);

    console.log(`\n━━━ Round ${round} | Phase: ${phase.toUpperCase()} | ${tradesInPhase} trades ━━━`);

    for (let i = 0; i < tradesInPhase; i++) {
      totalTrades++;
      const isBuy = Math.random() < cfg.buyPct;
      const baseAmount = isBuy ? rand(cfg.buyMin, cfg.buyMax) : rand(cfg.sellMin, cfg.sellMax);
      const amount = Math.round(baseAmount * 100) / 100;
      const tag = `#${totalTrades}`;

      try {
        if (isBuy) {
          const usdtAmount = ethers.parseEther(amount.toString());
          const amountsOut = await router.getAmountsOut(usdtAmount, [usdtAddr, wecyAddr]);
          const got = parseFloat(ethers.formatEther(amountsOut[1])).toFixed(4);

          const tx = await router.swapExactTokensForETH(
            usdtAmount, 0,
            [usdtAddr, wecyAddr],
            deployer.address,
            deadline(),
            { gasLimit: 500000 }
          );
          await tx.wait();
          buyCount++;
          console.log(`  ${tag} BUY  ${amount} USDT → ${got} ECY ✅`);
        } else {
          const ecyAmount = ethers.parseEther(amount.toString());
          const amountsOut = await router.getAmountsOut(ecyAmount, [wecyAddr, usdtAddr]);
          const got = parseFloat(ethers.formatEther(amountsOut[1])).toFixed(4);

          const tx = await router.swapExactETHForTokens(
            0,
            [wecyAddr, usdtAddr],
            deployer.address,
            deadline(),
            { value: ecyAmount, gasLimit: 500000 }
          );
          await tx.wait();
          sellCount++;
          console.log(`  ${tag} SELL ${amount} ECY  → ${got} USDT ✅`);
        }
      } catch (err: any) {
        const msg = err.message?.substring(0, 80) || "unknown";
        console.error(`  ${tag} ${isBuy ? "BUY" : "SELL"} FAILED: ${msg}`);
      }

      const delayMs = randInt(cfg.minDelay, cfg.maxDelay);
      await sleep(delayMs);
    }

    const curEcy = parseFloat(ethers.formatEther(await ethers.provider.getBalance(deployer.address))).toFixed(2);
    const curUsdt = parseFloat(ethers.formatEther(await usdt.balanceOf(deployer.address))).toFixed(2);
    console.log(`  ── Phase done | Total: ${totalTrades} (${buyCount}B/${sellCount}S) | ECY: ${curEcy} | USDT: ${curUsdt}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
