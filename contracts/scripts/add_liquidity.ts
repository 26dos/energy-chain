import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "dex-deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("dex-deployment.json not found. Run deploy_dex.ts first.");
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { WECY: wecyAddr, UniswapV2Router02: routerAddr, UniswapV2Factory: factoryAddr, TestUSDT: usdtAddr } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  console.log("Adding liquidity with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ECY\n");

  const router = await ethers.getContractAt("UniswapV2Router02", routerAddr);
  const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddr);
  const usdt = await ethers.getContractAt("SimpleERC20", usdtAddr);

  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // 1. Add USDT/ECY liquidity pool
  // Initial price: 1 ECY = 10 USDT (100,000 USDT : 10,000 ECY)
  const usdtAmount = ethers.parseEther("100000");
  const ecyAmount = ethers.parseEther("10000");

  console.log("1. Approving USDT for Router...");
  const approveTx = await usdt.approve(routerAddr, usdtAmount);
  await approveTx.wait();
  console.log("   Approved", ethers.formatEther(usdtAmount), "USDT");

  console.log("2. Adding USDT/ECY liquidity...");
  console.log("   USDT:", ethers.formatEther(usdtAmount), "| ECY:", ethers.formatEther(ecyAmount));
  const addLiqTx = await router.addLiquidityETH(
    usdtAddr,
    usdtAmount,
    usdtAmount,
    ecyAmount,
    deployer.address,
    deadline,
    { value: ecyAmount }
  );
  const addLiqReceipt = await addLiqTx.wait();
  console.log("   Tx:", addLiqReceipt?.hash);

  // Check pair
  const pairAddr = await factory.getPair(usdtAddr, wecyAddr);
  console.log("   Pair:", pairAddr);

  const pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);
  const [r0, r1] = await pair.getReserves();
  console.log("   Reserves:", ethers.formatEther(r0), "/", ethers.formatEther(r1));

  const lpBalance = await pair.balanceOf(deployer.address);
  console.log("   LP tokens:", ethers.formatEther(lpBalance));

  // 3. Test swap: swap 100 ECY for USDT
  console.log("\n3. Testing swap: 100 ECY -> USDT...");
  const swapAmountIn = ethers.parseEther("100");
  const amountsOut = await router.getAmountsOut(swapAmountIn, [wecyAddr, usdtAddr]);
  console.log("   Expected output:", ethers.formatEther(amountsOut[1]), "USDT");

  const swapTx = await router.swapExactETHForTokens(
    0,
    [wecyAddr, usdtAddr],
    deployer.address,
    deadline,
    { value: swapAmountIn, gasLimit: 500000 }
  );
  const swapReceipt = await swapTx.wait();
  console.log("   Swap tx:", swapReceipt?.hash);

  const usdtBalance = await usdt.balanceOf(deployer.address);
  console.log("   Deployer USDT balance:", ethers.formatEther(usdtBalance));

  // 4. Print summary
  const [r0After, r1After] = await pair.getReserves();
  console.log("\n=== Liquidity Pool Status ===");
  console.log("Pair:", pairAddr);
  console.log("Reserves after swap:", ethers.formatEther(r0After), "/", ethers.formatEther(r1After));
  console.log("Total pairs:", (await factory.allPairsLength()).toString());
  console.log("\n=== Initial Liquidity Setup Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
