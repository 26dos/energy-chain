/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_CHAIN_NAME?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_BLOCKSCOUT_URL?: string;
  readonly VITE_WECY?: string;
  readonly VITE_FACTORY?: string;
  readonly VITE_ROUTER?: string;
  readonly VITE_MULTICALL3?: string;
  readonly VITE_TOKEN_FACTORY?: string;
  readonly VITE_USDT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
