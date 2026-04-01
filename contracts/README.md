# EnergyChain — Smart Contracts

Solidity contracts for data attestation and provenance on EnergyChain.

## Contracts

- **EnergyDataAttestation.sol** — Generic data hashing and on-chain provenance

## Setup

```bash
npm install
npx hardhat compile
```

## Deploy

```bash
# Local testnet
npx hardhat run scripts/deploy.ts --network energychain_testnet

# Mainnet (set MAINNET_PRIVATE_KEY in .env)
npx hardhat run scripts/deploy.ts --network energychain_mainnet
```

## Verify

```bash
npx hardhat verify --network energychain_testnet <CONTRACT_ADDRESS>
```
