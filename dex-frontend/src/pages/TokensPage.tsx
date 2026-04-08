import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, parseAbi, type Address } from "viem";
import { CONTRACTS } from "@/config/contracts";

const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
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
]);

const WECY = CONTRACTS.WECY as Address;

interface TokenRow {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  userBalance: string;
  priceInUsdt: string;
}

export function TokensPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const fetchTokens = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const tokenSet = new Set<string>();
      tokenSet.add(WECY.toLowerCase());

      const pairLen = await publicClient.readContract({ address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairsLength" });
      const pairData: { t0: Address; t1: Address; r0: bigint; r1: bigint }[] = [];
      for (let i = 0n; i < pairLen; i++) {
        const pAddr = await publicClient.readContract({ address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairs", args: [i] }) as Address;
        const [t0, t1, reserves] = await Promise.all([
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "token0" }),
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "token1" }),
          publicClient.readContract({ address: pAddr, abi: pairAbi, functionName: "getReserves" }),
        ]);
        tokenSet.add((t0 as string).toLowerCase());
        tokenSet.add((t1 as string).toLowerCase());
        pairData.push({ t0: t0 as Address, t1: t1 as Address, r0: reserves[0], r1: reserves[1] });
      }

      const rows: TokenRow[] = [];
      for (const tAddr of tokenSet) {
        try {
          const [sym, name, dec, supply] = await Promise.all([
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "symbol" }),
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "name" }),
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "decimals" }),
            publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "totalSupply" }),
          ]);
          let userBal = 0n;
          if (address) {
            userBal = await publicClient.readContract({ address: tAddr as Address, abi: erc20Abi, functionName: "balanceOf", args: [address] });
          }

          let priceUsdt = "—";
          for (const pd of pairData) {
            const isT0 = pd.t0.toLowerCase() === tAddr;
            const isT1 = pd.t1.toLowerCase() === tAddr;
            if (!isT0 && !isT1) continue;
            const otherAddr = isT0 ? pd.t1.toLowerCase() : pd.t0.toLowerCase();
            const otherIsWecy = otherAddr === WECY.toLowerCase();
            const rSelf = parseFloat(formatUnits(isT0 ? pd.r0 : pd.r1, Number(dec)));
            const rOther = parseFloat(formatUnits(isT0 ? pd.r1 : pd.r0, 18));
            if (rSelf > 0 && rOther > 0) {
              if (tAddr === WECY.toLowerCase()) {
                priceUsdt = (rOther / rSelf).toFixed(4);
              } else if (otherIsWecy) {
                priceUsdt = (rOther / rSelf).toFixed(4) + " ECY";
              } else {
                priceUsdt = (rOther / rSelf).toFixed(4);
              }
            }
          }

          rows.push({
            address: tAddr,
            symbol: sym,
            name: name,
            decimals: Number(dec),
            totalSupply: parseFloat(formatUnits(supply, Number(dec))).toLocaleString(undefined, { maximumFractionDigits: 2 }),
            userBalance: parseFloat(formatUnits(userBal, Number(dec))).toLocaleString(undefined, { maximumFractionDigits: 6 }),
            priceInUsdt: priceUsdt,
          });
        } catch (e) {
          console.error(`Failed to read token ${tAddr}:`, e);
        }
      }

      // Add native ECY
      let nativeBal = 0n;
      if (address) {
        nativeBal = await publicClient.getBalance({ address });
      }
      let ecyPrice = "—";
      for (const pd of pairData) {
        const wecyIsT0 = pd.t0.toLowerCase() === WECY.toLowerCase();
        const wecyIsT1 = pd.t1.toLowerCase() === WECY.toLowerCase();
        if (wecyIsT0 || wecyIsT1) {
          const rWecy = parseFloat(formatUnits(wecyIsT0 ? pd.r0 : pd.r1, 18));
          const rOther = parseFloat(formatUnits(wecyIsT0 ? pd.r1 : pd.r0, 18));
          if (rWecy > 0) ecyPrice = (rOther / rWecy).toFixed(4);
        }
      }
      rows.unshift({
        address: "native",
        symbol: "ECY",
        name: "EnergyChain Native Token",
        decimals: 18,
        totalSupply: "—",
        userBalance: parseFloat(formatUnits(nativeBal, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 }),
        priceInUsdt: ecyPrice,
      });

      setTokens(rows);
    } catch (e) {
      console.error("fetchTokens error:", e);
    }
    setLoading(false);
  }, [publicClient, address]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const filtered = q.trim()
    ? tokens.filter(t => t.symbol.toLowerCase().includes(q.trim().toLowerCase()) || t.name.toLowerCase().includes(q.trim().toLowerCase()))
    : tokens;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Tokens</h1>
        <button onClick={fetchTokens} className="rounded-lg p-1.5 text-slate-400 hover:text-primary hover:bg-white/5">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input type="search" placeholder="Filter by name or symbol" value={q} onChange={e => setQ(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#1e293b] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none ring-primary/30 focus:border-primary/50 focus:ring-2" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1e293b] shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-[#0f172a]/50 text-slate-400">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Your Balance</th>
                  <th className="px-4 py-3 font-medium text-right">Total Supply</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.address} className="border-b border-white/5 last:border-0 hover:bg-white/[0.04]">
                    <td className="px-4 py-3.5 tabular-nums text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-white">{r.symbol}</div>
                      <div className="text-xs text-slate-500">{r.name}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">{r.priceInUsdt}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">{r.userBalance}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">{r.totalSupply}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">No tokens match your filter.</p>
        )}
      </div>
    </div>
  );
}
