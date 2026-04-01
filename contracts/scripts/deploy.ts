import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ECY");

  const factory = await ethers.getContractFactory("EnergyDataAttestation");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("EnergyDataAttestation deployed to:", address);

  const fs = await import("fs");
  const path = await import("path");
  const output = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    contract: address,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log("Deployment info saved to:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
