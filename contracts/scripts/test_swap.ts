import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "dex-deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { WECY: wecyAddr, UniswapV2Router02: routerAddr, UniswapV2Factory: factoryAddr, TestUSDT: usdtAddr } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  console.log("Testing swap with:", deployer.address);

  const router = await ethers.getContractAt("UniswapV2Router02", routerAddr);
  const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddr);
  const usdt = await ethers.getContractAt("SimpleERC20", usdtAddr);

  const pairAddr = await factory.getPair(usdtAddr, wecyAddr);
  console.log("Pair address:", pairAddr);

  const pair = await ethers.getContractAt("UniswapV2Pair", pairAddr);
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  console.log("WECY:", wecyAddr);
  console.log("USDT:", usdtAddr);

  const [r0, r1] = await pair.getReserves();
  console.log("Reserves:", ethers.formatEther(r0), "/", ethers.formatEther(r1));

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const swapAmountIn = ethers.parseEther("10");

  // Test getAmountsOut first
  const amountsOut = await router.getAmountsOut(swapAmountIn, [wecyAddr, usdtAddr]);
  console.log("\nExpected output for 10 ECY:", ethers.formatEther(amountsOut[1]), "USDT");

  // Try swap with explicit gas limit
  console.log("\nAttempting swapExactETHForTokens with explicit gas limit...");
  try {
    const tx = await router.swapExactETHForTokens(
      0,
      [wecyAddr, usdtAddr],
      deployer.address,
      deadline,
      { value: swapAmountIn, gasLimit: 500000 }
    );
    console.log("Tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Tx mined! Status:", receipt?.status);
    console.log("Gas used:", receipt?.gasUsed.toString());

    const usdtBal = await usdt.balanceOf(deployer.address);
    console.log("USDT balance after swap:", ethers.formatEther(usdtBal));
  } catch (err: any) {
    console.error("Swap failed:", err.message?.substring(0, 200));

    // Try alternative: manually wrap ECY to WECY, approve, then swapExactTokensForTokens
    console.log("\n--- Trying alternative: manual WECY wrap + token-to-token swap ---");
    const wecy = await ethers.getContractAt("WECY", wecyAddr);

    console.log("1. Wrapping 10 ECY to WECY...");
    const wrapTx = await wecy.deposit({ value: swapAmountIn, gasLimit: 100000 });
    await wrapTx.wait();
    const wecyBal = await wecy.balanceOf(deployer.address);
    console.log("   WECY balance:", ethers.formatEther(wecyBal));

    console.log("2. Approving WECY for Router...");
    const appTx = await wecy.approve(routerAddr, swapAmountIn);
    await appTx.wait();

    console.log("3. Swapping WECY -> USDT via swapExactTokensForTokens...");
    try {
      const swapTx = await router.swapExactTokensForTokens(
        swapAmountIn, 0,
        [wecyAddr, usdtAddr],
        deployer.address,
        deadline,
        { gasLimit: 500000 }
      );
      console.log("   Tx sent:", swapTx.hash);
      const swapReceipt = await swapTx.wait();
      console.log("   Tx mined! Status:", swapReceipt?.status);

      const usdtBal = await usdt.balanceOf(deployer.address);
      console.log("   USDT balance after swap:", ethers.formatEther(usdtBal));
      console.log("\n=== Swap successful via token-to-token route! ===");
    } catch (err2: any) {
      console.error("Token-to-token swap also failed:", err2.message?.substring(0, 300));
    }
  }

  // Print final state
  const [r0After, r1After] = await pair.getReserves();
  console.log("\nFinal reserves:", ethers.formatEther(r0After), "/", ethers.formatEther(r1After));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
