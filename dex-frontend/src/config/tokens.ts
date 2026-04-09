import { CONTRACTS } from "./contracts";

export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
}

export const NATIVE_ECY: Token = {
  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  name: "ECY",
  symbol: "ECY",
  decimals: 18,
  isNative: true,
};

export const WECY_TOKEN: Token = {
  address: CONTRACTS.WECY,
  name: "Wrapped ECY",
  symbol: "WECY",
  decimals: 18,
};

export const USDT_TOKEN: Token = {
  address:
    import.meta.env.VITE_USDT ||
    "0xa626fa9678Ca32372cCd7fE5d45088B858a041b2",
  name: "Test USDT",
  symbol: "USDT",
  decimals: 18,
};

export const DEFAULT_TOKENS: Token[] = [NATIVE_ECY, WECY_TOKEN, USDT_TOKEN];

export const TOKENS = DEFAULT_TOKENS;
export const NATIVE_TOKEN = NATIVE_ECY;
