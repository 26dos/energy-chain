#!/usr/bin/env node
/**
 * Script B — EVM 原始交易存证
 *
 * 读取有功功率 xlsx，对每条记录计算 keccak256 哈希，
 * 发送一笔原始 EVM 交易（自转 0 ECY），将 hash + 元数据
 * 编码在交易的 data (input) 字段中。
 *
 * 与 Script A 的区别：
 *   A) 数据写入合约 storage — 可通过合约函数查询
 *   B) 数据写入交易 calldata — 更便宜，按 txHash 查询
 */

import { ethers } from "ethers";
import { parseXlsx } from "./parse_xlsx.js";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY =
  process.env.PRIVATE_KEY_B ||
  "0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305";

const GAS_LIMIT = 100000;

function encodeAttestation(record) {
  const json = JSON.stringify(record);
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(json));
  const payload = JSON.stringify({
    schema: "energy_attestation_v1",
    category: "active_power",
    data_hash: dataHash,
    meter: record.meter,
    time: record.time,
    value: record.value,
  });
  return ethers.hexlify(ethers.toUtf8Bytes(payload));
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Script B — EVM 原始交易存证 (Calldata)           ║");
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

  const feeData = await provider.getFeeData();
  console.log(`     gasPrice: ${ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} Gwei\n`);

  console.log("[3/4] 开始上链 (顺序提交, 不等确认) ...");
  const startTime = Date.now();
  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  let successCount = 0;
  let failCount = 0;
  let lastTxHash = null;

  for (let i = 0; i < records.length; i++) {
    const calldata = encodeAttestation(records[i]);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const tx = await wallet.sendTransaction({
          to: wallet.address,
          value: 0,
          data: calldata,
          nonce,
          gasLimit: GAS_LIMIT,
          gasPrice: feeData.gasPrice || ethers.parseUnits("20", "gwei"),
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

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n✔ 完成！成功 ${successCount}/${records.length} 笔原始交易存证`,
  );
  console.log(`  耗时 ${elapsed}s\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
