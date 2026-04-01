import { ethers } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export class EnergyChainSDK {
  #provider;
  #chainId;

  constructor(rpcUrl, chainId = 262144) {
    this.#provider = new ethers.JsonRpcProvider(rpcUrl);
    this.#chainId = chainId;
  }

  get provider() {
    return this.#provider;
  }

  createWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase ?? "",
    };
  }

  walletFromPrivateKey(privateKey) {
    return new ethers.Wallet(privateKey, this.#provider);
  }

  walletFromMnemonic(mnemonic, path = "m/44'/60'/0'/0/0") {
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
    return hdNode.connect(this.#provider);
  }

  async getBalance(address) {
    return this.#provider.getBalance(address);
  }

  async getTokenBalance(address, tokenAddress) {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.#provider);
    return contract.balanceOf(address);
  }

  async getBlockNumber() {
    return this.#provider.getBlockNumber();
  }

  async getBlock(blockNumber) {
    return this.#provider.getBlock(blockNumber);
  }

  async sendECY(privateKey, to, amount, options = {}) {
    const wallet = new ethers.Wallet(privateKey, this.#provider);
    const tx = await wallet.sendTransaction({
      to,
      value: amount,
      ...options,
    });
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status,
    };
  }

  async sendToken(privateKey, tokenAddress, to, amount, options = {}) {
    const wallet = new ethers.Wallet(privateKey, this.#provider);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const tx = await contract.transfer(to, amount, options);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status,
    };
  }

  async waitForTransaction(txHash, timeout = 60000) {
    return this.#provider.waitForTransaction(txHash, 1, timeout);
  }

  async scanBlockForDeposits(blockNumber, watchAddresses) {
    const block = await this.#provider.getBlock(blockNumber, true);
    if (!block || !block.transactions) return [];

    const deposits = [];
    for (const txHash of block.transactions) {
      const tx = await this.#provider.getTransaction(txHash);
      if (!tx || !tx.to) continue;

      const toAddr = tx.to.toLowerCase();
      if (watchAddresses.has(toAddr)) {
        deposits.push({
          txHash: tx.hash,
          from: tx.from,
          to: tx.to,
          amount: tx.value,
          blockNumber: block.number,
          type: "native",
        });
      }
    }
    return deposits;
  }

  async scanBlockForTokenDeposits(blockNumber, tokenAddress, watchAddresses) {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.#provider);
    const filter = contract.filters.Transfer();
    const events = await contract.queryFilter(filter, blockNumber, blockNumber);

    const deposits = [];
    for (const event of events) {
      const toAddr = event.args?.to?.toLowerCase();
      if (toAddr && watchAddresses.has(toAddr)) {
        deposits.push({
          txHash: event.transactionHash,
          from: event.args.from,
          to: event.args.to,
          amount: event.args.value,
          blockNumber,
          tokenAddress,
          type: "erc20",
        });
      }
    }
    return deposits;
  }

  async getTransactionReceipt(txHash) {
    return this.#provider.getTransactionReceipt(txHash);
  }

  async getNonce(address) {
    return this.#provider.getTransactionCount(address);
  }

  async getGasPrice() {
    const feeData = await this.#provider.getFeeData();
    return {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    };
  }

  async getChainId() {
    const network = await this.#provider.getNetwork();
    return Number(network.chainId);
  }
}
