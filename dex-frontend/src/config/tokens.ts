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
  address: "0x6a407DD067d79659F58a4887Fb7ec188207Fc1A6",
  name: "Wrapped ECY",
  symbol: "WECY",
  decimals: 18,
};

export const USDT_TOKEN: Token = {
  address: "0x5633fDb95cA11376CE9f8eBF05104Fe6fa60E3fF",
  name: "Test USDT",
  symbol: "USDT",
  decimals: 18,
};

export const DEFAULT_TOKENS: Token[] = [
  NATIVE_ECY,
  WECY_TOKEN,
  USDT_TOKEN,
];

export const TOKENS = DEFAULT_TOKENS;
export const NATIVE_TOKEN = NATIVE_ECY;
