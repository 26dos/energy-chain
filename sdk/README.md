# @energychain/sdk

Node.js SDK for EnergyChain, designed for CEX integration and wallet operations.

## Install

```bash
npm install
```

## Usage

```javascript
import { EnergyChainSDK } from "@energychain/sdk";

const sdk = new EnergyChainSDK("http://127.0.0.1:8545");

// Create a new wallet
const wallet = sdk.createWallet();
console.log(wallet.address, wallet.mnemonic);

// Check balance
const balance = await sdk.getBalance(wallet.address);

// Send ECY
const result = await sdk.sendECY(privateKey, toAddress, amount);

// Scan block for deposits
const deposits = await sdk.scanBlockForDeposits(blockNumber, watchAddresses);
```

## API

| Method | Description |
|--------|-------------|
| `createWallet()` | Generate a new random wallet |
| `walletFromPrivateKey(key)` | Import wallet from private key |
| `getBalance(address)` | Get native ECY balance |
| `getTokenBalance(address, token)` | Get ERC-20 token balance |
| `sendECY(key, to, amount)` | Send native ECY tokens |
| `sendToken(key, token, to, amount)` | Send ERC-20 tokens |
| `scanBlockForDeposits(block, addrs)` | Scan block for native deposits |
| `scanBlockForTokenDeposits(block, token, addrs)` | Scan for ERC-20 deposits |
| `getNonce(address)` | Get transaction count |
| `getGasPrice()` | Get current gas price info |
