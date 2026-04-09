#!/usr/bin/env node
/**
 * Script A — EVM 合约存证
 *
 * 读取有功功率 xlsx，逐条调用 EnergyDataAttestation.sol 的 attest() 方法，
 * 将每条电表数据的 keccak256 哈希写入合约 storage。
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseXlsx } from "./parse_xlsx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x8be1e5311e4cb31002c5c84cea459b5e598592f1d00c796e3de2880d55fe9990";

const CONTRACT_ABI = [
  "function attest(bytes32 dataHash, string dataType, string memo) returns (uint256 id)",
  "function totalAttestations() view returns (uint256)",
];

const GAS_LIMIT = 600000;

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Script A — EVM 合约存证 (EnergyDataAttestation) ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const records = parseXlsx();
  console.log(`[1/4] 解析 xlsx → ${records.length} 条记录\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  console.log(`[2/4] 连接链 chainId=${network.chainId}  wallet=${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`     余额: ${ethers.formatEther(balance)} ECY`);
  if (balance === 0n) {
    console.log("  ERROR: 钱包余额为 0, 无法支付 gas。请先给钱包转入 ECY。");
    process.exit(1);
  }

  const deployPath = path.join(__dirname, "../contracts/deployment.json");
  const { contract: contractAddr } = JSON.parse(
    fs.readFileSync(deployPath, "utf8"),
  );
  const contract = new ethers.Contract(contractAddr, CONTRACT_ABI, wallet);
  console.log(`     Contract: ${contractAddr}\n`);

  console.log("[3/4] 开始上链 (顺序提交, 不等确认) ...");
  const startTime = Date.now();
  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  let successCount = 0;
  let failCount = 0;
  let lastTxHash = null;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const json = JSON.stringify(record);
    const hash = ethers.keccak256(ethers.toUtf8Bytes(json));
    const memo = `${record.meter}|${record.time}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const tx = await contract.attest(hash, "active_power", memo, {
          nonce,
          gasLimit: GAS_LIMIT,
        });
        lastTxHash = tx.hash;
        nonce++;
        successCount++;
        break;
      } catch (err) {
        if (attempt < 2) {
          if (i === 0 && attempt === 0) {
            console.log(`\n  首笔交易失败: ${err.message?.slice(0, 120)}`);
          }
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          nonce = await provider.getTransactionCount(
            wallet.address,
            "pending",
          );
        } else {
          if (failCount === 0) {
            console.log(`\n  错误详情: ${err.message?.slice(0, 150)}`);
          }
          failCount++;
          nonce++;
        }
      }
    }

    if ((i + 1) % 100 === 0 || i === records.length - 1) {
      const pct = Math.round(((i + 1) / records.length) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(
        `\r     ${i + 1}/${records.length} (${pct}%) 成功${successCount} 失败${failCount} ${elapsed}s`,
      );
    }
  }
  console.log("\n");

  console.log("[4/4] 等待最后一笔交易入块 ...");
  if (lastTxHash) {
    const receipt = await provider.waitForTransaction(lastTxHash, 1, 120000);
    console.log(
      `     tx: ${receipt.hash} block=${receipt.blockNumber} status=${receipt.status}`,
    );
  }

  const total = await contract.totalAttestations();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n✔ 完成！成功 ${successCount}/${records.length}，合约存证 ${total} 条`,
  );
  console.log(`  耗时 ${elapsed}s\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
