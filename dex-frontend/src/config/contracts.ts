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

// Addresses from dex-deployment.json
export const CONTRACTS = {
  WECY: "0x6a407DD067d79659F58a4887Fb7ec188207Fc1A6",
  Factory: "0xfd9C87D909c6b0C8Ef412a185e78722E282d67d4",
  Router: "0xd537D06b2b03E067f0c6FBe6252Fdd280B8b11d7",
  Multicall3: "0xD90d37FE6629233a5BA781AA6B7C309EAcf7c252",
  TokenFactory: "0x86d2db5d33b863d75D3A0bC839c5E2795B0Ad46e",
};

export const DEFAULT_SLIPPAGE = 0.5; // 0.5%
export const DEFAULT_DEADLINE = 20; // 20 minutes
