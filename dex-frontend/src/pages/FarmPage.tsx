import { useCallback, useEffect, useState } from "react";
import { Sprout, RefreshCw } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, parseAbi, type Address } from "viem";
import { CONTRACTS } from "@/config/contracts";

const factoryAbi = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
]);
const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
]);

interface FarmPool {
  pairAddr: Address;
  label: string;
  reserve0: string;
  reserve1: string;
  totalLp: string;
  userLp: string;
  userLpRaw: number;
  sharePercent: string;
}

export function FarmPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [farms, setFarms] = useState<FarmPool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFarms = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const len = await publicClient.readContract({ address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairsLength" });
      const pools: FarmPool[] = [];
      for (let i = 0n; i < len; i++) {
        const pAddr = await publicClient.readContract({ address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairs", args: [i] }) as Address;
        const [t0, t1, reserves, supply] = await Promise.all([
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "token0" }),
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "token1" }),
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "getReserves" }),
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "totalSupply" }),
        ]);
        let userLp = 0n;
        if (address) {
          userLp = await publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "balanceOf", args: [address] });
        }
        let s0 = "?", s1 = "?";
        try { s0 = await publicClient.readContract({ address: t0 as Address, abi: erc20Abi, functionName: "symbol" }); } catch {}
        try { s1 = await publicClient.readContract({ address: t1 as Address, abi: erc20Abi, functionName: "symbol" }); } catch {}

        const userLpNum = parseFloat(formatUnits(userLp, 18));
        const totalNum = parseFloat(formatUnits(supply, 18));
        const share = totalNum > 0 ? ((userLpNum / totalNum) * 100).toFixed(2) : "0.00";

        pools.push({
          pairAddr: pAddr,
          label: `${s0} / ${s1}`,
          reserve0: parseFloat(formatUnits(reserves[0], 18)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
          reserve1: parseFloat(formatUnits(reserves[1], 18)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
          totalLp: totalNum.toLocaleString(undefined, { maximumFractionDigits: 4 }),
          userLp: userLpNum.toLocaleString(undefined, { maximumFractionDigits: 4 }),
          userLpRaw: userLpNum,
          sharePercent: share,
        });
      }
      setFarms(pools);
    } catch (e) {
      console.error("Farm fetch error:", e);
    }
    setLoading(false);
  }, [publicClient, address]);

  useEffect(() => { fetchFarms(); }, [fetchFarms]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Liquidity Pools</h1>
          <p className="mt-1 text-sm text-slate-400">View all active pools and your LP positions</p>
        </div>
        <button onClick={fetchFarms} className="rounded-lg p-2 text-slate-400 hover:text-primary hover:bg-white/5">
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : farms.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-12 text-center shadow-lg">
          <p className="text-slate-400">No pools found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {farms.map(f => (
            <div key={f.pairAddr} className="rounded-2xl border border-white/5 bg-[#1e293b] p-5 shadow-lg hover:border-white/10 transition-colors">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Sprout className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{f.label}</p>
                    <p className="text-xs text-slate-400 font-mono">{f.pairAddr.slice(0, 10)}…{f.pairAddr.slice(-6)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-6 text-center sm:text-right">
                  <div>
                    <p className="text-xs text-slate-500">Reserve 0</p>
                    <p className="font-medium tabular-nums text-white">{f.reserve0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Reserve 1</p>
                    <p className="font-medium tabular-nums text-white">{f.reserve1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total LP</p>
                    <p className="font-medium tabular-nums text-white">{f.totalLp}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Your LP</p>
                    <p className={`font-medium tabular-nums ${f.userLpRaw > 0 ? "text-primary" : "text-slate-500"}`}>{f.userLp}</p>
                    {f.userLpRaw > 0 && <p className="text-xs text-slate-500">{f.sharePercent}%</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
