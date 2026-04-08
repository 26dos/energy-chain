import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useBalance, usePublicClient } from "wagmi";
import { formatUnits, parseAbi, type Address } from "viem";
import { RefreshCw, Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS } from "@/config/contracts";
import { USDT_TOKEN } from "@/config/tokens";

const WECY = CONTRACTS.WECY as Address;

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);
const factoryAbi = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
]);
const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function balanceOf(address) view returns (uint256)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
]);

interface TokenBal { symbol: string; name: string; balance: string; raw: number; isNative?: boolean; }
interface TxRecord { hash: string; type: string; time: string; blockNumber: number; }

export function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: nativeBal } = useBalance({ address, query: { enabled: !!address } });

  const [tokenBals, setTokenBals] = useState<TokenBal[]>([]);
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!publicClient || !address) return;
    setLoading(true);
    try {
      const tokenAddrs = new Set<string>();
      tokenAddrs.add(WECY.toLowerCase());
      tokenAddrs.add((USDT_TOKEN.address as Address).toLowerCase());

      const pairLen = await publicClient.readContract({ address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairsLength" });
      const pairAddrs: Address[] = [];
      for (let i = 0n; i < pairLen; i++) {
        const pa = await publicClient.readContract({ address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairs", args: [i] }) as Address;
        pairAddrs.push(pa);
        const [t0, t1] = await Promise.all([
          publicClient.readContract({ address: pa, abi: pairAbi, functionName: "token0" }),
          publicClient.readContract({ address: pa, abi: pairAbi, functionName: "token1" }),
        ]);
        tokenAddrs.add((t0 as string).toLowerCase());
        tokenAddrs.add((t1 as string).toLowerCase());
      }

      const bals: TokenBal[] = [];
      for (const tAddr of tokenAddrs) {
        try {
          const [sym, dec, bal] = await Promise.all([
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "symbol" }),
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "decimals" }),
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
          ]);
          const num = parseFloat(formatUnits(bal, Number(dec)));
          bals.push({ symbol: sym, name: sym, balance: num.toLocaleString(undefined, { maximumFractionDigits: 6 }), raw: num });
        } catch {}
      }

      for (const pa of pairAddrs) {
        try {
          const lpBal = await publicClient.readContract({ address: pa, abi: pairAbi, functionName: "balanceOf", args: [address] });
          const num = parseFloat(formatUnits(lpBal, 18));
          if (num > 0) {
            const [t0, t1] = await Promise.all([
              publicClient.readContract({ address: pa, abi: pairAbi, functionName: "token0" }),
              publicClient.readContract({ address: pa, abi: pairAbi, functionName: "token1" }),
            ]);
            let s0 = "?", s1 = "?";
            try { s0 = await publicClient.readContract({ address: t0 as Address, abi: erc20Abi, functionName: "symbol" }); } catch {}
            try { s1 = await publicClient.readContract({ address: t1 as Address, abi: erc20Abi, functionName: "symbol" }); } catch {}
            bals.push({ symbol: `${s0}/${s1} LP`, name: "LP Token", balance: num.toLocaleString(undefined, { maximumFractionDigits: 6 }), raw: num });
          }
        } catch {}
      }

      setTokenBals(bals.filter(b => b.raw > 0));

      // Recent transactions (Swap events involving the user)
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;
      const allTxs: TxRecord[] = [];

      for (const pa of pairAddrs) {
        try {
          const logs = await publicClient.getLogs({
            address: pa,
            event: pairAbi[4],
            fromBlock,
            toBlock: latestBlock,
          });
          for (const log of logs) {
            const args = log.args as any;
            const sender = args?.sender?.toLowerCase() ?? "";
            const to = args?.to?.toLowerCase() ?? "";
            if (sender === address.toLowerCase() || to === address.toLowerCase()) {
              let timeStr = "—";
              try {
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
                timeStr = new Date(Number(block.timestamp) * 1000).toLocaleString();
              } catch {}
              allTxs.push({
                hash: log.transactionHash ? `${log.transactionHash.slice(0, 8)}…${log.transactionHash.slice(-4)}` : "—",
                type: "Swap",
                time: timeStr,
                blockNumber: Number(log.blockNumber ?? 0),
              });
            }
          }
        } catch {}
      }

      allTxs.sort((a, b) => b.blockNumber - a.blockNumber);
      setTxs(allTxs.slice(0, 20));
    } catch (e) {
      console.error("Portfolio fetch error:", e);
    }
    setLoading(false);
  }, [publicClient, address]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const nativeNum = nativeBal ? parseFloat(formatUnits(nativeBal.value, nativeBal.decimals)) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">Portfolio</h1>
          {isConnected && (
            <button onClick={fetchAll} className="rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-white/5">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
        {!isConnected && <div className="[&_button]:rounded-xl"><ConnectButton /></div>}
      </div>

      {/* Total balance card */}
      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-primary/10 via-[#1e293b] to-[#1e293b] p-6 shadow-lg ring-1 ring-white/5">
        <div className="flex items-center gap-3 text-slate-400">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">ECY Balance</span>
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
          {isConnected ? nativeNum.toLocaleString(undefined, { maximumFractionDigits: 4 }) + " ECY" : "—"}
        </p>
        {isConnected && address && (
          <p className="mt-2 truncate font-mono text-xs text-slate-500">{address}</p>
        )}
      </div>

      {/* Token balances */}
      <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Token Balances</h2>
        {!isConnected ? (
          <p className="py-6 text-center text-sm text-slate-500">Connect your wallet to view balances.</p>
        ) : loading ? (
          <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : tokenBals.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No ERC-20 tokens found.</p>
        ) : (
          <ul className="space-y-2">
            {tokenBals.map((t, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0f172a] px-4 py-3 hover:border-white/10">
                <div>
                  <div className="font-medium text-white">{t.symbol}</div>
                  <div className="text-xs text-slate-500">{t.name}</div>
                </div>
                <div className="text-right tabular-nums text-slate-200">{t.balance}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Transactions</h2>
        {!isConnected ? (
          <p className="py-6 text-center text-sm text-slate-500">Connect wallet to view transactions.</p>
        ) : txs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{loading ? "Loading..." : "No recent swap transactions."}</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {txs.map((tx, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                <div>
                  <span className="font-mono text-sm text-primary">{tx.hash}</span>
                  <span className="ml-2 text-sm text-slate-300">{tx.type}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{tx.time}</span>
                  <span className="rounded-md bg-green-500/15 px-2 py-0.5 font-medium text-green-400">Success</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
