export const CHAIN_ID = 262144;

export const CHAIN_CONFIG = {
  id: CHAIN_ID,
  name: "EnergyChain",
  nativeCurrency: { name: "ECY", symbol: "ECY", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "http://localhost:4000" },
  },
} as const;

export const CONTRACTS = {
  WECY: "0x87613B1B8FD2a3C9e305F05c9c0172D5656452da",
  Factory: "0xCE808a193B7C9338b0Bb4e125B4E14B8142A8dE7",
  Router: "0xbc6A106193cDa5292C7F95f1eBede72e3e5c8c02",
  Multicall3: "0x78C4Cf1b3635fFB121aAc6A03fca306C6cfeB197",
  TokenFactory: "0x70797AEFc03Dc8ecCd7e4dCbFEE8980FFB64C026",
};

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_DEADLINE = 20;
