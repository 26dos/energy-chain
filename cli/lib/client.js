import { ethers } from "ethers";
import { CONTRACT_ABI } from "./abi.js";

export function getProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getWallet(privateKey, provider) {
  return new ethers.Wallet(privateKey, provider);
}

export function getContract(contractAddress, signerOrProvider) {
  return new ethers.Contract(contractAddress, CONTRACT_ABI, signerOrProvider);
}

export function hashData(data) {
  if (typeof data === "string") {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }
  return ethers.keccak256(data);
}

export function formatAttestation(att) {
  return {
    dataHash: att.dataHash,
    submitter: att.submitter,
    timestamp: new Date(Number(att.timestamp) * 1000).toISOString(),
    blockNumber: Number(att.blockNumber),
    dataType: att.dataType,
    memo: att.memo,
  };
}
