import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Default test accounts — DO NOT use in production
const TEST_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

const accounts = process.env.PRIVATE_KEY
  ? [process.env.PRIVATE_KEY]
  : TEST_PRIVATE_KEYS;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    energychain_testnet: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      chainId: 262144,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : ["0x8be1e5311e4cb31002c5c84cea459b5e598592f1d00c796e3de2880d55fe9990"],
    },
    energychain_mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://rpc.energychain.io",
      chainId: 262144,
      accounts: process.env.MAINNET_PRIVATE_KEY
        ? [process.env.MAINNET_PRIVATE_KEY]
        : [],
    },
  },
  etherscan: {
    apiKey: {
      energychain_testnet: process.env.BLOCKSCOUT_API_KEY || "no-api-key",
      energychain_mainnet: process.env.BLOCKSCOUT_API_KEY || "no-api-key",
    },
    customChains: [
      {
        network: "energychain_testnet",
        chainId: 262144,
        urls: {
          apiURL: process.env.BLOCKSCOUT_API_URL || "http://localhost:4000/api",
          browserURL: process.env.BLOCKSCOUT_URL || "http://localhost:4000",
        },
      },
      {
        network: "energychain_mainnet",
        chainId: 262144,
        urls: {
          apiURL: "https://explorer.energychain.io/api",
          browserURL: "https://explorer.energychain.io",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
