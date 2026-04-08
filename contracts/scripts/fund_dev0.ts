import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "dex-deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { TestUSDT: usdtAddr } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  const usdt = await ethers.getContractAt("SimpleERC20", usdtAddr);

  const dev0 = "0x014FA5e36BF05a8F4292B0079fFB3ecD5D tried32";
  // Derive dev0 address from mnemonic
  const dev0Addr = "0x014FA5e36BF05a8F4292B0079fFB3ecD5D48e5E4";

  console.log("Funding dev0 account for manual DEX testing...");
  console.log("Deployer:", deployer.address);

  // Get dev0 address by deriving from the known private key
  const dev0Wallet = new ethers.Wallet("0xf91067ef80b57c9d04d8f6e45f458d81d6b65397ebecce54693e398a6af6d347");
  const dev0Address = dev0Wallet.address;
  console.log("Dev0 address:", dev0Address);

  // 1. Send 10,000 ECY to dev0
  const ecyAmount = ethers.parseEther("10000");
  console.log("\n1. Sending 10,000 ECY to dev0...");
  const tx1 = await deployer.sendTransaction({
    to: dev0Address,
    value: ecyAmount,
  });
  await tx1.wait();
  console.log("   Done. Tx:", tx1.hash);

  // 2. Send 100,000 USDT to dev0
  const usdtAmount = ethers.parseEther("100000");
  console.log("2. Sending 100,000 USDT to dev0...");
  const tx2 = await usdt.transfer(dev0Address, usdtAmount);
  await tx2.wait();
  console.log("   Done. Tx:", tx2.hash);

  // 3. Verify balances
  const ecyBal = ethers.formatEther(await ethers.provider.getBalance(dev0Address));
  const usdtBal = ethers.formatEther(await usdt.balanceOf(dev0Address));
  console.log(`\n=== Dev0 Balances ===`);
  console.log(`Address: ${dev0Address}`);
  console.log(`ECY:  ${ecyBal}`);
  console.log(`USDT: ${usdtBal}`);
  console.log(`\nImport this private key in MetaMask:`);
  console.log(`f91067ef80b57c9d04d8f6e45f458d81d6b65397ebecce54693e398a6af6d347`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
