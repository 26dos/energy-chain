import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "dex-deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const {
    WECY: wecyAddr,
    UniswapV2Router02: routerAddr,
    UniswapV2Factory: factoryAddr,
    TestUSDT: usdtAddr,
    ERC20TokenFactory: tokenFactoryAddr,
  } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  console.log("=== DEX Full Contract Test ===");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ECY\n");

  const router = await ethers.getContractAt("UniswapV2Router02", routerAddr);
  const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddr);
  const usdt = await ethers.getContractAt("SimpleERC20", usdtAddr);
  const wecy = await ethers.getContractAt("WECY", wecyAddr);
  const tokenFactory = await ethers.getContractAt("ERC20TokenFactory", tokenFactoryAddr);
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // --- Test 1: Router view functions ---
  console.log("--- 1. Router View Functions ---");
  console.log("  factory():", await router.factory());
  console.log("  WETH():", await router.WETH());
  console.log("  quote(100, 1000, 500):", ethers.formatEther(await router.quote(ethers.parseEther("100"), ethers.parseEther("1000"), ethers.parseEther("500"))));

  // --- Test 2: Factory view functions ---
  console.log("\n--- 2. Factory View Functions ---");
  const pairsLen = await factory.allPairsLength();
  console.log("  allPairsLength():", pairsLen.toString());
  console.log("  getPair(USDT, WECY):", await factory.getPair(usdtAddr, wecyAddr));

  // --- Test 3: WECY deposit/withdraw ---
  console.log("\n--- 3. WECY Deposit/Withdraw ---");
  const wrapAmt = ethers.parseEther("50");
  const tx1 = await wecy.deposit({ value: wrapAmt, gasLimit: 100000 });
  await tx1.wait();
  console.log("  Deposited 50 ECY -> WECY. Balance:", ethers.formatEther(await wecy.balanceOf(deployer.address)));
  const tx2 = await wecy.withdraw(ethers.parseEther("25"), { gasLimit: 100000 });
  await tx2.wait();
  console.log("  Withdrew 25 WECY -> ECY. Balance:", ethers.formatEther(await wecy.balanceOf(deployer.address)));

  // --- Test 4: Create new token via TokenFactory ---
  console.log("\n--- 4. TokenFactory: Create New Token ---");
  const createTx = await tokenFactory.createToken("Green Energy Token", "GET", 18, ethers.parseEther("500000"));
  const createReceipt = await createTx.wait();
  let getAddr = "";
  const tokCreated = createReceipt?.logs.find((log: any) => {
    try { return tokenFactory.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TokenCreated"; }
    catch { return false; }
  });
  if (tokCreated) {
    const parsed = tokenFactory.interface.parseLog({ topics: tokCreated.topics as string[], data: tokCreated.data });
    getAddr = parsed?.args[0] || "";
  }
  console.log("  Created GET token:", getAddr);
  console.log("  allTokensLength:", (await tokenFactory.allTokensLength()).toString());

  const getToken = await ethers.getContractAt("SimpleERC20", getAddr);
  console.log("  GET balance:", ethers.formatEther(await getToken.balanceOf(deployer.address)));

  // --- Test 5: Create GET/ECY pair and add liquidity ---
  console.log("\n--- 5. Add Liquidity: GET/ECY ---");
  const getAmount = ethers.parseEther("50000");
  const ecyForGet = ethers.parseEther("5000");
  await (await getToken.approve(routerAddr, getAmount)).wait();
  console.log("  Approved GET for Router");
  const addLiqTx = await router.addLiquidityETH(
    getAddr, getAmount, getAmount, ecyForGet, deployer.address, deadline,
    { value: ecyForGet, gasLimit: 5000000 }
  );
  const addLiqReceipt = await addLiqTx.wait();
  console.log("  Tx:", addLiqReceipt?.hash);
  const getPairAddr = await factory.getPair(getAddr, wecyAddr);
  console.log("  GET/WECY pair:", getPairAddr);
  const getPair = await ethers.getContractAt("UniswapV2Pair", getPairAddr);
  const [gr0, gr1] = await getPair.getReserves();
  console.log("  Reserves:", ethers.formatEther(gr0), "/", ethers.formatEther(gr1));
  console.log("  LP tokens:", ethers.formatEther(await getPair.balanceOf(deployer.address)));

  // --- Test 6: Swap ECY -> GET ---
  console.log("\n--- 6. Swap: 100 ECY -> GET ---");
  const swapIn = ethers.parseEther("100");
  const amounts = await router.getAmountsOut(swapIn, [wecyAddr, getAddr]);
  console.log("  Expected GET:", ethers.formatEther(amounts[1]));
  const swapTx = await router.swapExactETHForTokens(0, [wecyAddr, getAddr], deployer.address, deadline, { value: swapIn, gasLimit: 500000 });
  await swapTx.wait();
  console.log("  GET balance after swap:", ethers.formatEther(await getToken.balanceOf(deployer.address)));

  // --- Test 7: Swap GET -> ECY ---
  console.log("\n--- 7. Swap: 500 GET -> ECY ---");
  const getSwapAmt = ethers.parseEther("500");
  await (await getToken.approve(routerAddr, getSwapAmt)).wait();
  const amounts2 = await router.getAmountsOut(getSwapAmt, [getAddr, wecyAddr]);
  console.log("  Expected ECY:", ethers.formatEther(amounts2[1]));
  const swapTx2 = await router.swapExactTokensForETH(getSwapAmt, 0, [getAddr, wecyAddr], deployer.address, deadline, { gasLimit: 500000 });
  await swapTx2.wait();
  console.log("  ECY balance after:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // --- Test 8: Swap token-to-token (USDT -> GET via WECY) ---
  console.log("\n--- 8. Swap: 100 USDT -> GET (multi-hop) ---");
  const usdtSwap = ethers.parseEther("100");
  await (await usdt.approve(routerAddr, usdtSwap)).wait();
  const amounts3 = await router.getAmountsOut(usdtSwap, [usdtAddr, wecyAddr, getAddr]);
  console.log("  Expected GET:", ethers.formatEther(amounts3[2]));
  const swapTx3 = await router.swapExactTokensForTokens(usdtSwap, 0, [usdtAddr, wecyAddr, getAddr], deployer.address, deadline, { gasLimit: 800000 });
  await swapTx3.wait();
  console.log("  GET balance after:", ethers.formatEther(await getToken.balanceOf(deployer.address)));

  // --- Test 9: Remove liquidity ---
  console.log("\n--- 9. Remove Liquidity: USDT/ECY ---");
  const usdtPairAddr = await factory.getPair(usdtAddr, wecyAddr);
  const usdtPair = await ethers.getContractAt("UniswapV2Pair", usdtPairAddr);
  const lpBalance = await usdtPair.balanceOf(deployer.address);
  console.log("  LP balance:", ethers.formatEther(lpBalance));
  const removeLp = lpBalance / 10n; // Remove 10%
  await (await usdtPair.approve(routerAddr, removeLp)).wait();
  const removeTx = await router.removeLiquidityETH(usdtAddr, removeLp, 0, 0, deployer.address, deadline, { gasLimit: 500000 });
  await removeTx.wait();
  console.log("  Removed 10% LP. Remaining:", ethers.formatEther(await usdtPair.balanceOf(deployer.address)));
  const [ur0, ur1] = await usdtPair.getReserves();
  console.log("  Reserves after:", ethers.formatEther(ur0), "/", ethers.formatEther(ur1));

  // --- Test 10: ERC-20 transfer ---
  console.log("\n--- 10. ERC-20 Transfer ---");
  const randAddr = "0x1234567890abcdef1234567890abcdef12345678";
  const transferAmt = ethers.parseEther("100");
  await (await getToken.transfer(randAddr, transferAmt)).wait();
  console.log("  Transferred 100 GET to", randAddr);
  console.log("  Recipient GET bal:", ethers.formatEther(await getToken.balanceOf(randAddr)));

  // --- Summary ---
  console.log("\n========================================");
  console.log("=== ALL 10 CONTRACT TESTS PASSED ===");
  console.log("========================================");
  console.log("\nFinal state:");
  console.log("  Total pairs:", (await factory.allPairsLength()).toString());
  console.log("  Total tokens created:", (await tokenFactory.allTokensLength()).toString());
  console.log("  Deployer ECY:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("  Deployer USDT:", ethers.formatEther(await usdt.balanceOf(deployer.address)));
  console.log("  Deployer GET:", ethers.formatEther(await getToken.balanceOf(deployer.address)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
