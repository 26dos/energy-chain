#!/usr/bin/env node

// Node.js 18 默认优先 IPv6，导致连接 127.0.0.1 时走 ::1 失败
import { setDefaultResultOrder } from "dns";
setDefaultResultOrder("ipv4first");

import { Command } from "commander";
import { ethers } from "ethers";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { getProvider, getWallet, getContract, hashData, formatAttestation } from "../lib/client.js";

const program = new Command();

program
  .name("energy-cli")
  .description("能源公链数据存证 CLI — 上链 · 查询 · 溯源验证")
  .version("1.0.0");

// ======================== 全局选项 ========================

function addGlobalOpts(cmd) {
  return cmd
    .option("--rpc <url>", "RPC 节点地址", "http://localhost:8545")
    .option("--contract <address>", "合约地址（或设置 ENERGY_CONTRACT 环境变量）")
    .option("--key <privateKey>", "私钥（或设置 ENERGY_PRIVATE_KEY 环境变量）");
}

function resolveOpts(opts) {
  const rpc = opts.rpc || process.env.ENERGY_RPC_URL || "http://localhost:8545";
  const contractAddr = opts.contract || process.env.ENERGY_CONTRACT;
  const privateKey = opts.key || process.env.ENERGY_PRIVATE_KEY;

  if (!contractAddr) {
    console.error(chalk.red("✗ 请通过 --contract 或 ENERGY_CONTRACT 环境变量指定合约地址"));
    process.exit(1);
  }
  return { rpc, contractAddr, privateKey };
}

function getReadContract(opts) {
  const { rpc, contractAddr } = resolveOpts(opts);
  const provider = getProvider(rpc);
  return getContract(contractAddr, provider);
}

function getWriteContract(opts) {
  const { rpc, contractAddr, privateKey } = resolveOpts(opts);
  if (!privateKey) {
    console.error(chalk.red("✗ 写操作需要私钥，请通过 --key 或 ENERGY_PRIVATE_KEY 环境变量指定"));
    process.exit(1);
  }
  const provider = getProvider(rpc);
  const wallet = getWallet(privateKey, provider);
  return { contract: getContract(contractAddr, wallet), wallet };
}

// ======================== hash 命令 ========================

addGlobalOpts(
  program
    .command("hash")
    .description("计算数据的 keccak256 哈希（不上链，仅本地计算）")
    .option("-d, --data <string>", "直接传入字符串数据")
    .option("-f, --file <path>", "从文件读取数据")
).action(async (opts) => {
  let raw;
  if (opts.file) {
    const filePath = path.resolve(opts.file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`✗ 文件不存在: ${filePath}`));
      process.exit(1);
    }
    raw = fs.readFileSync(filePath);
    const hash = ethers.keccak256(raw);
    console.log(chalk.green("数据哈希 (keccak256):"), hash);
    console.log(chalk.dim(`来源: 文件 ${filePath} (${raw.length} bytes)`));
  } else if (opts.data) {
    const hash = hashData(opts.data);
    console.log(chalk.green("数据哈希 (keccak256):"), hash);
    console.log(chalk.dim(`来源: 字符串 (${opts.data.length} chars)`));
  } else {
    console.error(chalk.red("✗ 请通过 --data 或 --file 指定数据"));
    process.exit(1);
  }
});

// ======================== attest 命令 ========================

addGlobalOpts(
  program
    .command("attest")
    .description("提交数据存证到链上")
    .option("-d, --data <string>", "直接传入字符串数据（CLI 自动计算哈希）")
    .option("-f, --file <path>", "从文件读取数据（CLI 自动计算哈希）")
    .option("-H, --hash <bytes32>", "直接传入已计算好的哈希")
    .option("-t, --type <dataType>", "业务类型标签", "general")
    .option("-m, --memo <memo>", "备注", "")
).action(async (opts) => {
  let dataHash;
  let source;

  if (opts.hash) {
    dataHash = opts.hash;
    source = "预计算哈希";
  } else if (opts.file) {
    const filePath = path.resolve(opts.file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`✗ 文件不存在: ${filePath}`));
      process.exit(1);
    }
    const raw = fs.readFileSync(filePath);
    dataHash = ethers.keccak256(raw);
    source = `文件 ${filePath} (${raw.length} bytes)`;
  } else if (opts.data) {
    dataHash = hashData(opts.data);
    source = `字符串 (${opts.data.length} chars)`;
  } else {
    console.error(chalk.red("✗ 请通过 --data、--file 或 --hash 指定数据"));
    process.exit(1);
  }

  const { contract, wallet } = getWriteContract(opts);
  const spinner = ora("正在提交存证到链上...").start();

  try {
    const tx = await contract.attest(dataHash, opts.type, opts.memo);
    spinner.text = `交易已发送，等待确认... (tx: ${tx.hash})`;
    const receipt = await tx.wait();

    spinner.succeed(chalk.green("存证成功!"));
    console.log();
    console.log(chalk.bold("📋 存证凭证:"));
    console.log("  数据哈希:", chalk.cyan(dataHash));
    console.log("  数据来源:", source);
    console.log("  业务类型:", opts.type);
    console.log("  备    注:", opts.memo || "(无)");
    console.log("  提 交 者:", wallet.address);
    console.log("  交易哈希:", chalk.cyan(tx.hash));
    console.log("  区 块 号:", receipt.blockNumber);
    console.log("  Gas 消耗:", receipt.gasUsed.toString());
    console.log();
    console.log(chalk.dim("溯源验证命令:"));
    console.log(chalk.dim(`  energy-cli verify --hash ${dataHash} --contract ${opts.contract || process.env.ENERGY_CONTRACT}`));
  } catch (err) {
    spinner.fail(chalk.red("存证失败"));
    console.error(chalk.red(err.reason || err.message));
    process.exit(1);
  }
});

// ======================== batch-attest 命令 ========================

addGlobalOpts(
  program
    .command("batch-attest")
    .description("批量提交数据存证（从 JSON 文件读取数据数组）")
    .requiredOption("-f, --file <path>", "JSON 文件路径，格式: string[] 或 { data: string[] }")
    .option("-t, --type <dataType>", "业务类型标签", "general")
    .option("-m, --memo <memo>", "备注", "")
).action(async (opts) => {
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`✗ 文件不存在: ${filePath}`));
    process.exit(1);
  }

  let items;
  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    items = Array.isArray(content) ? content : content.data;
    if (!Array.isArray(items)) throw new Error("invalid format");
  } catch {
    console.error(chalk.red("✗ JSON 格式错误，应为 string[] 或 { data: string[] }"));
    process.exit(1);
  }

  const hashes = items.map((item) => {
    if (typeof item === "string" && item.startsWith("0x") && item.length === 66) {
      return item;
    }
    const str = typeof item === "string" ? item : JSON.stringify(item);
    return hashData(str);
  });

  console.log(chalk.dim(`共 ${hashes.length} 条数据待存证`));

  const { contract, wallet } = getWriteContract(opts);
  const spinner = ora("正在批量提交存证...").start();

  try {
    const tx = await contract.batchAttest(hashes, opts.type, opts.memo);
    spinner.text = `交易已发送，等待确认... (tx: ${tx.hash})`;
    const receipt = await tx.wait();

    spinner.succeed(chalk.green(`批量存证成功! 共 ${hashes.length} 条`));
    console.log("  交易哈希:", chalk.cyan(tx.hash));
    console.log("  区 块 号:", receipt.blockNumber);
    console.log("  Gas 消耗:", receipt.gasUsed.toString());
    console.log("  提 交 者:", wallet.address);
  } catch (err) {
    spinner.fail(chalk.red("批量存证失败"));
    console.error(chalk.red(err.reason || err.message));
    process.exit(1);
  }
});

// ======================== verify 命令 ========================

addGlobalOpts(
  program
    .command("verify")
    .description("溯源验证 — 验证数据是否已上链且未被篡改")
    .option("-d, --data <string>", "原始字符串数据")
    .option("-f, --file <path>", "原始数据文件")
    .option("-H, --hash <bytes32>", "直接传入数据哈希")
).action(async (opts) => {
  let dataHash;
  let source;

  if (opts.hash) {
    dataHash = opts.hash;
    source = "直接哈希";
  } else if (opts.file) {
    const filePath = path.resolve(opts.file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`✗ 文件不存在: ${filePath}`));
      process.exit(1);
    }
    const raw = fs.readFileSync(filePath);
    dataHash = ethers.keccak256(raw);
    source = `文件 ${filePath}`;
  } else if (opts.data) {
    dataHash = hashData(opts.data);
    source = "字符串数据";
  } else {
    console.error(chalk.red("✗ 请通过 --data、--file 或 --hash 指定要验证的数据"));
    process.exit(1);
  }

  const contract = getReadContract(opts);
  const spinner = ora("正在链上查询...").start();

  try {
    const [exists, att] = await contract.verifyByHash(dataHash);

    if (exists) {
      spinner.succeed(chalk.green("✓ 验证通过 — 数据已上链，未被篡改"));
      const info = formatAttestation(att);
      console.log();
      console.log(chalk.bold("📋 链上存证记录:"));
      console.log("  数据哈希:", chalk.cyan(info.dataHash));
      console.log("  提 交 者:", info.submitter);
      console.log("  上链时间:", info.timestamp);
      console.log("  区 块 号:", info.blockNumber);
      console.log("  业务类型:", info.dataType);
      console.log("  备    注:", info.memo || "(无)");
      console.log("  验证来源:", source);
      console.log();
      console.log(chalk.green("溯源结论: 该数据由"), chalk.cyan(info.submitter));
      console.log(chalk.green("         于"), chalk.cyan(info.timestamp), chalk.green("提交上链"));
      console.log(chalk.green("         数据内容与链上哈希一致，证明未被篡改"));
    } else {
      spinner.warn(chalk.yellow("✗ 验证失败 — 链上无此数据记录"));
      console.log("  查询哈希:", chalk.cyan(dataHash));
      console.log("  可能原因:");
      console.log("    1. 数据尚未上链");
      console.log("    2. 数据已被篡改（与原始存证不一致）");
      console.log("    3. 合约地址不正确");
    }
  } catch (err) {
    spinner.fail(chalk.red("查询失败"));
    console.error(chalk.red(err.reason || err.message));
    process.exit(1);
  }
});

// ======================== query 命令 ========================

addGlobalOpts(
  program
    .command("query")
    .description("查询存证记录")
    .option("-i, --id <number>", "按存证 ID 查询")
    .option("-s, --submitter <address>", "按提交者地址查询")
    .option("-t, --type <dataType>", "按业务类型查询")
    .option("--total", "查询总存证数")
).action(async (opts) => {
  const contract = getReadContract(opts);

  try {
    if (opts.total) {
      const total = await contract.totalAttestations();
      console.log(chalk.bold("链上总存证数:"), chalk.cyan(total.toString()));
      return;
    }

    if (opts.id) {
      const att = await contract.getAttestation(Number(opts.id));
      const info = formatAttestation(att);
      console.log(chalk.bold(`存证 #${opts.id}:`));
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    if (opts.submitter) {
      const ids = await contract.getAttestationsBySubmitter(opts.submitter);
      console.log(chalk.bold(`提交者 ${opts.submitter} 的存证 (共 ${ids.length} 条):`));
      for (const id of ids) {
        const att = await contract.getAttestation(id);
        const info = formatAttestation(att);
        console.log(chalk.dim(`--- #${id} ---`));
        console.log(JSON.stringify(info, null, 2));
      }
      return;
    }

    if (opts.type) {
      const ids = await contract.getAttestationsByType(opts.type);
      console.log(chalk.bold(`类型 "${opts.type}" 的存证 (共 ${ids.length} 条):`));
      for (const id of ids) {
        const att = await contract.getAttestation(id);
        const info = formatAttestation(att);
        console.log(chalk.dim(`--- #${id} ---`));
        console.log(JSON.stringify(info, null, 2));
      }
      return;
    }

    console.log(chalk.yellow("请指定查询条件: --id, --submitter, --type, 或 --total"));
  } catch (err) {
    console.error(chalk.red("查询失败:"), err.reason || err.message);
    process.exit(1);
  }
});

// ======================== info 命令 ========================

addGlobalOpts(
  program
    .command("info")
    .description("显示当前配置和连接信息")
).action(async (opts) => {
  const { rpc, contractAddr, privateKey } = resolveOpts(opts);
  const provider = getProvider(rpc);

  console.log(chalk.bold("⚡ Energy Chain CLI 配置:"));
  console.log("  RPC 地址:", chalk.cyan(rpc));
  console.log("  合约地址:", chalk.cyan(contractAddr));

  if (privateKey) {
    const wallet = getWallet(privateKey, provider);
    console.log("  钱包地址:", chalk.cyan(wallet.address));
    try {
      const balance = await provider.getBalance(wallet.address);
      console.log("  余    额:", ethers.formatEther(balance), "ECY");
    } catch {
      console.log("  余    额:", chalk.dim("(无法连接节点)"));
    }
  }

  try {
    const network = await provider.getNetwork();
    console.log("  Chain ID:", chalk.cyan(network.chainId.toString()));
    const blockNum = await provider.getBlockNumber();
    console.log("  最新区块:", chalk.cyan(blockNum.toString()));

    const contract = getContract(contractAddr, provider);
    const total = await contract.totalAttestations();
    console.log("  总存证数:", chalk.cyan(total.toString()));
  } catch {
    console.log(chalk.dim("  (无法连接到节点，部分信息不可用)"));
  }
});

program.parse();
