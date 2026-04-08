import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying DEX contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ECY\n");

  // 1. Deploy WECY
  console.log("1/6 Deploying WECY...");
  const WECY = await ethers.getContractFactory("WECY");
  const wecy = await WECY.deploy();
  await wecy.waitForDeployment();
  const wecyAddr = await wecy.getAddress();
  console.log("    WECY:", wecyAddr);

  // 2. Deploy UniswapV2Factory
  console.log("2/6 Deploying UniswapV2Factory...");
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("    Factory:", factoryAddr);

  // 3. Deploy UniswapV2Router02
  console.log("3/6 Deploying UniswapV2Router02...");
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factoryAddr, wecyAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("    Router:", routerAddr);

  // 4. Deploy Multicall3
  console.log("4/6 Deploying Multicall3...");
  const Multicall = await ethers.getContractFactory("Multicall3");
  const multicall = await Multicall.deploy();
  await multicall.waitForDeployment();
  const multicallAddr = await multicall.getAddress();
  console.log("    Multicall3:", multicallAddr);

  // 5. Deploy ERC20TokenFactory
  console.log("5/6 Deploying ERC20TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("ERC20TokenFactory");
  const tokenFactory = await TokenFactory.deploy();
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddr = await tokenFactory.getAddress();
  console.log("    TokenFactory:", tokenFactoryAddr);

  // 6. Create a test ERC-20 token (USDT mock) for demo
  console.log("6/6 Creating test USDT token...");
  const tf = await ethers.getContractAt("ERC20TokenFactory", tokenFactoryAddr);
  const tx = await tf.createToken("Test USDT", "USDT", 18, ethers.parseEther("1000000000"));
  const receipt = await tx.wait();
  const tokenCreatedEvent = receipt?.logs.find((log: any) => {
    try {
      return tf.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TokenCreated";
    } catch { return false; }
  });
  let usdtAddr = "";
  if (tokenCreatedEvent) {
    const parsed = tf.interface.parseLog({ topics: tokenCreatedEvent.topics as string[], data: tokenCreatedEvent.data });
    usdtAddr = parsed?.args[0] || "";
  }
  console.log("    USDT (mock):", usdtAddr);

  // Save deployment
  const deployment = {
    network: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      WECY: wecyAddr,
      UniswapV2Factory: factoryAddr,
      UniswapV2Router02: routerAddr,
      Multicall3: multicallAddr,
      ERC20TokenFactory: tokenFactoryAddr,
      TestUSDT: usdtAddr,
    },
  };

  const outPath = path.join(__dirname, "..", "dex-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment saved to:", outPath);
  console.log("\n=== DEX Deployment Complete ===");
  console.log(JSON.stringify(deployment.contracts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
