import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { usePublicClient, useReadContract } from "wagmi";
import { formatUnits, parseAbi, type Address } from "viem";
import { TradingChart, type CandleData, type VolumeData } from "@/components/charts/TradingChart";
import { CONTRACTS } from "@/config/contracts";
import { USDT_TOKEN } from "@/config/tokens";

const factoryAbi = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address)",
]);
const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
]);

const WECY_ADDR = CONTRACTS.WECY as Address;

interface TradeRecord {
  time: string;
  timestamp: number;
  side: "Buy" | "Sell";
  price: number;
  amountECY: number;
  amountUSDT: number;
  txHash: string;
}

const INTERVALS: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

export function ChartsPage() {
  const publicClient = usePublicClient();
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [reserves, setReserves] = useState<{ usdt: number; ecy: number }>({ usdt: 0, ecy: 0 });
  const [interval, setSelectedInterval] = useState("1m");

  const { data: pairAddr } = useReadContract({
    address: CONTRACTS.Factory as Address,
    abi: factoryAbi,
    functionName: "getPair",
    args: [USDT_TOKEN.address as Address, WECY_ADDR],
  });

  const fetchReserves = useCallback(async () => {
    if (!pairAddr || pairAddr === "0x0000000000000000000000000000000000000000" || !publicClient) return;
    try {
      const token0 = await publicClient.readContract({
        address: pairAddr,
        abi: pairAbi,
        functionName: "token0",
      });
      const res = await publicClient.readContract({
        address: pairAddr,
        abi: pairAbi,
        functionName: "getReserves",
      });
      const r0 = parseFloat(formatUnits(res[0], 18));
      const r1 = parseFloat(formatUnits(res[1], 18));
      const usdtIsToken0 = token0.toLowerCase() === (USDT_TOKEN.address as Address).toLowerCase();
      const usdtReserve = usdtIsToken0 ? r0 : r1;
      const ecyReserve = usdtIsToken0 ? r1 : r0;
      setReserves({ usdt: usdtReserve, ecy: ecyReserve });
      if (ecyReserve > 0) {
        setCurrentPrice(usdtReserve / ecyReserve);
      }
    } catch (e) {
      console.error("Failed to fetch reserves:", e);
    }
  }, [pairAddr, publicClient]);

  const fetchTrades = useCallback(async () => {
    if (!pairAddr || pairAddr === "0x0000000000000000000000000000000000000000" || !publicClient) return;
    setLoading(true);
    try {
      const token0 = await publicClient.readContract({
        address: pairAddr,
        abi: pairAbi,
        functionName: "token0",
      });
      const usdtIsToken0 = token0.toLowerCase() === (USDT_TOKEN.address as Address).toLowerCase();

      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;

      const logs = await publicClient.getLogs({
        address: pairAddr,
        event: pairAbi[3],
        fromBlock,
        toBlock: latestBlock,
      });

      const tradeRecords: TradeRecord[] = [];
      for (const log of logs) {
        const { amount0In, amount1In, amount0Out, amount1Out } = log.args as any;
        const a0In = parseFloat(formatUnits(amount0In ?? 0n, 18));
        const a1In = parseFloat(formatUnits(amount1In ?? 0n, 18));
        const a0Out = parseFloat(formatUnits(amount0Out ?? 0n, 18));
        const a1Out = parseFloat(formatUnits(amount1Out ?? 0n, 18));

        let side: "Buy" | "Sell";
        let price = 0;
        let amountECY = 0;
        let amountUSDT = 0;

        if (usdtIsToken0) {
          if (a0In > 0 && a1Out > 0) {
            side = "Buy";
            price = a0In / a1Out;
            amountECY = a1Out;
            amountUSDT = a0In;
          } else {
            side = "Sell";
            price = a1In > 0 ? a0Out / a1In : 0;
            amountECY = a1In;
            amountUSDT = a0Out;
          }
        } else {
          if (a1In > 0 && a0Out > 0) {
            side = "Buy";
            price = a1In / a0Out;
            amountECY = a0Out;
            amountUSDT = a1In;
          } else {
            side = "Sell";
            price = a0In > 0 ? a1Out / a0In : 0;
            amountECY = a0In;
            amountUSDT = a1Out;
          }
        }

        let timestamp = Math.floor(Date.now() / 1000);
        try {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
          timestamp = Number(block.timestamp);
        } catch {}

        const d = new Date(timestamp * 1000);
        const timeStr = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

        tradeRecords.push({
          time: timeStr,
          timestamp,
          side,
          price,
          amountECY,
          amountUSDT,
          txHash: log.transactionHash ?? "",
        });
      }

      tradeRecords.sort((a, b) => a.timestamp - b.timestamp);
      setTrades(tradeRecords);
    } catch (e) {
      console.error("Failed to fetch trades:", e);
    }
    setLoading(false);
  }, [pairAddr, publicClient]);

  useEffect(() => {
    fetchTrades();
    fetchReserves();
    const id = window.setInterval(() => { fetchTrades(); fetchReserves(); }, 10000);
    return () => clearInterval(id);
  }, [fetchTrades, fetchReserves]);

  const { candles, volumes } = useMemo(() => {
    if (trades.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      const p = currentPrice > 0 ? currentPrice : 10;
      return {
        candles: [{ time: now, open: p, high: p, low: p, close: p }] as CandleData[],
        volumes: [{ time: now, value: 0, color: "rgba(34,197,94,0.4)" }] as VolumeData[],
      };
    }

    const bucketSec = INTERVALS[interval] ?? 60;
    const bucketMap = new Map<number, { open: number; high: number; low: number; close: number; vol: number }>();
    for (const t of trades) {
      const bucketKey = Math.floor(t.timestamp / bucketSec) * bucketSec;
      const existing = bucketMap.get(bucketKey);
      if (existing) {
        existing.high = Math.max(existing.high, t.price);
        existing.low = Math.min(existing.low, t.price);
        existing.close = t.price;
        existing.vol += t.amountUSDT;
      } else {
        bucketMap.set(bucketKey, { open: t.price, high: t.price, low: t.price, close: t.price, vol: t.amountUSDT });
      }
    }

    const sortedKeys = [...bucketMap.keys()].sort((a, b) => a - b);
    const c: CandleData[] = [];
    const v: VolumeData[] = [];
    for (const key of sortedKeys) {
      const b = bucketMap.get(key)!;
      c.push({ time: key, open: b.open, high: b.high, low: b.low, close: b.close });
      v.push({ time: key, value: b.vol, color: b.close >= b.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)" });
    }
    return { candles: c, volumes: v };
  }, [trades, currentPrice, interval]);

  const stats = useMemo(() => {
    const price = currentPrice > 0 ? currentPrice : (trades.length > 0 ? trades[trades.length - 1]!.price : 0);
    const totalVol = trades.reduce((s, t) => s + t.amountUSDT, 0);
    const prices = trades.map((t) => t.price);
    const high = prices.length > 0 ? Math.max(...prices) : price;
    const low = prices.length > 0 ? Math.min(...prices) : price;
    return { price, totalVol, high, low };
  }, [trades, currentPrice]);

  const recentTrades = useMemo(() => [...trades].reverse().slice(0, 20), [trades]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">Charts</h1>
          <button
            onClick={() => { fetchTrades(); fetchReserves(); }}
            className="rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="relative inline-block w-full sm:w-56">
          <div className="w-full rounded-xl border border-white/10 bg-[#1e293b] py-2.5 pl-3 pr-10 text-sm font-medium text-white">
            ECY / USDT
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Price", value: stats.price > 0 ? stats.price.toFixed(4) + " USDT" : "—" },
          { label: "Total Volume", value: stats.totalVol > 0 ? stats.totalVol.toFixed(2) + " USDT" : "—" },
          { label: "High", value: stats.high > 0 ? stats.high.toFixed(4) + " USDT" : "—" },
          { label: "Low", value: stats.low > 0 ? stats.low.toFixed(4) + " USDT" : "—" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/5 bg-[#1e293b] px-5 py-4 shadow-lg transition-colors hover:border-white/10">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#1e293b] shadow-lg overflow-hidden">
        <TradingChart candles={candles} volumes={volumes} interval={interval} onIntervalChange={setSelectedInterval} />
        <div className="border-t border-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">
            Recent Trades {trades.length > 0 && <span className="text-slate-500 font-normal">({trades.length} total)</span>}
          </h2>
          {recentTrades.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              {loading ? "Loading trades..." : "No trades yet. Make a swap to see trades here."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Side</th>
                    <th className="pb-2 font-medium text-right">Price (USDT)</th>
                    <th className="pb-2 font-medium text-right">Amount (ECY)</th>
                    <th className="pb-2 font-medium text-right">Total (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((t, i) => (
                    <tr key={i} className="border-t border-white/5 transition-colors hover:bg-white/[0.03]">
                      <td className="py-2.5 tabular-nums text-slate-400">{t.time}</td>
                      <td className={t.side === "Buy" ? "py-2.5 font-medium text-green-400" : "py-2.5 font-medium text-red-400"}>{t.side}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-200">{t.price.toFixed(4)}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-300">{t.amountECY.toFixed(4)}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-300">{t.amountUSDT.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
