export const config = {
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  wsUrl: process.env.WS_URL || "ws://127.0.0.1:8546",
  port: parseInt(process.env.PORT || "3001"),
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || "2000"),
  startBlock: parseInt(process.env.START_BLOCK || "0"),
};

export const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
  "function getPair(address, address) view returns (address)",
];

export const PAIR_ABI = [
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function totalSupply() view returns (uint256)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
