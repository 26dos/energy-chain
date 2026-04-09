const env = import.meta.env;

export const CHAIN_ID = Number(env.VITE_CHAIN_ID || "262144");

export const CHAIN_CONFIG = {
  id: CHAIN_ID,
  name: env.VITE_CHAIN_NAME || "EnergyChain",
  nativeCurrency: { name: "ECY", symbol: "ECY", decimals: 18 },
  rpcUrls: {
    default: { http: [env.VITE_RPC_URL || "http://127.0.0.1:8575"] },
    public: { http: [env.VITE_RPC_URL || "http://127.0.0.1:8575"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: env.VITE_BLOCKSCOUT_URL || "http://localhost:3001",
    },
  },
} as const;

export const CONTRACTS = {
  WECY: env.VITE_WECY || "0x8EE1ddb8E5082C75998c510fa50ec4286d7d926A",
  Factory: env.VITE_FACTORY || "0x51E3D92f10cf07bA07EF2da63EE406D74D59f22d",
  Router: env.VITE_ROUTER || "0x6e8d5D2B337730888F414Eb19210eeDB26DC392f",
  Multicall3:
    env.VITE_MULTICALL3 || "0x97D9f6Bb4Df64e09A0a8f74e04c0f8e9c81eDD2B",
  TokenFactory:
    env.VITE_TOKEN_FACTORY || "0xc0C0a018dff7E979BF363b13e97a87bB9266269D",
};

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_DEADLINE = 20;
