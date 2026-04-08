import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Loader2, Minus, Plus } from "lucide-react";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, parseAbi, type Address, maxUint256 } from "viem";
import toast from "react-hot-toast";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Token } from "@/config/tokens";
import { TOKENS } from "@/config/tokens";
import { CONTRACTS } from "@/config/contracts";
import { TokenSelector } from "@/components/common/TokenSelector";

const routerAbi = parseAbi([
  "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256, uint256, uint256)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)",
  "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256, uint256)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256)",
]);
const factoryAbi = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
  "function getPair(address, address) view returns (address)",
]);
const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
]);
const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
]);

interface PoolInfo {
  pairAddr: Address;
  token0Addr: Address;
  token1Addr: Address;
  token0Symbol: string;
  token1Symbol: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  userLp: bigint;
}

const WECY = CONTRACTS.WECY as Address;

function fmtNum(v: bigint, d = 18, maxFrac = 4) {
  const n = parseFloat(formatUnits(v, d));
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export function PoolPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const addRef = useRef<HTMLDivElement>(null);

  const [tokenA, setTokenA] = useState<Token>(TOKENS[0]!);
  const [tokenB, setTokenB] = useState<Token>(TOKENS.length > 2 ? TOKENS[2]! : TOKENS[1]!);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lastEdited, setLastEdited] = useState<"a" | "b">("a");
  const [sel, setSel] = useState<"a" | "b" | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [removePoolIdx, setRemovePoolIdx] = useState<number | null>(null);
  const [removePercent, setRemovePercent] = useState(100);
  const [pairReserves, setPairReserves] = useState<{ rA: number; rB: number } | null>(null);

  const tokenAAddr = tokenA.isNative ? WECY : (tokenA.address as Address);
  const tokenBAddr = tokenB.isNative ? WECY : (tokenB.address as Address);

  const { data: balA, refetch: refetchBalA } = useBalance({
    address,
    token: tokenA.isNative ? undefined : (tokenA.address as Address),
    query: { enabled: !!address },
  });
  const { data: balB, refetch: refetchBalB } = useBalance({
    address,
    token: tokenB.isNative ? undefined : (tokenB.address as Address),
    query: { enabled: !!address },
  });

  // Fetch current reserves for the selected pair to auto-calc amounts
  const fetchPairReserves = useCallback(async () => {
    if (!publicClient) return;
    try {
      const pairAddr = await publicClient.readContract({
        address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "getPair",
        args: [tokenAAddr, tokenBAddr],
      });
      if (!pairAddr || pairAddr === "0x0000000000000000000000000000000000000000") {
        setPairReserves(null);
        return;
      }
      const token0 = await publicClient.readContract({ address: pairAddr as Address, abi: pairAbi, functionName: "token0" });
      const reserves = await publicClient.readContract({ address: pairAddr as Address, abi: pairAbi, functionName: "getReserves" });
      const aIsToken0 = tokenAAddr.toLowerCase() === (token0 as string).toLowerCase();
      const rA = parseFloat(formatUnits(aIsToken0 ? reserves[0] : reserves[1], 18));
      const rB = parseFloat(formatUnits(aIsToken0 ? reserves[1] : reserves[0], 18));
      setPairReserves({ rA, rB });
    } catch {
      setPairReserves(null);
    }
  }, [publicClient, tokenAAddr, tokenBAddr]);

  useEffect(() => { fetchPairReserves(); }, [fetchPairReserves]);

  // Auto-calculate paired amount when user types
  function handleAmountAChange(val: string) {
    const cleaned = val.replace(/[^0-9.]/g, "");
    setAmountA(cleaned);
    setLastEdited("a");
    if (pairReserves && pairReserves.rA > 0) {
      const numA = parseFloat(cleaned);
      if (numA > 0) {
        const calcB = (numA * pairReserves.rB) / pairReserves.rA;
        setAmountB(calcB.toFixed(6));
      } else {
        setAmountB("");
      }
    }
  }

  function handleAmountBChange(val: string) {
    const cleaned = val.replace(/[^0-9.]/g, "");
    setAmountB(cleaned);
    setLastEdited("b");
    if (pairReserves && pairReserves.rB > 0) {
      const numB = parseFloat(cleaned);
      if (numB > 0) {
        const calcA = (numB * pairReserves.rA) / pairReserves.rB;
        setAmountA(calcA.toFixed(6));
      } else {
        setAmountA("");
      }
    }
  }

  // Fetch pools
  const fetchPools = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const len = await publicClient.readContract({
        address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairsLength",
      });
      const infos: PoolInfo[] = [];
      for (let i = 0n; i < len; i++) {
        const pairAddr = await publicClient.readContract({
          address: CONTRACTS.Factory as Address, abi: factoryAbi, functionName: "allPairs", args: [i],
        }) as Address;
        const [t0, t1, reserves, supply] = await Promise.all([
          publicClient.readContract({ address: pairAddr, abi: pairAbi, functionName: "token0" }),
          publicClient.readContract({ address: pairAddr, abi: pairAbi, functionName: "token1" }),
          publicClient.readContract({ address: pairAddr, abi: pairAbi, functionName: "getReserves" }),
          publicClient.readContract({ address: pairAddr, abi: pairAbi, functionName: "totalSupply" }),
        ]);
        let userLp = 0n;
        if (address) {
          userLp = await publicClient.readContract({ address: pairAddr, abi: pairAbi, functionName: "balanceOf", args: [address] });
        }
        let s0 = "?", s1 = "?";
        try { s0 = await publicClient.readContract({ address: t0 as Address, abi: erc20Abi, functionName: "symbol" }); } catch {}
        try { s1 = await publicClient.readContract({ address: t1 as Address, abi: erc20Abi, functionName: "symbol" }); } catch {}
        infos.push({
          pairAddr, token0Addr: t0 as Address, token1Addr: t1 as Address,
          token0Symbol: s0, token1Symbol: s1,
          reserve0: reserves[0], reserve1: reserves[1], totalSupply: supply, userLp,
        });
      }
      setPools(infos);
    } catch (e) { console.error("Failed to fetch pools:", e); }
    setLoading(false);
  }, [publicClient, address]);

  useEffect(() => { fetchPools(); }, [fetchPools]);

  // Allowance checks
  const { data: allowanceA, refetch: refetchAllowA } = useReadContract({
    address: tokenAAddr, abi: erc20Abi, functionName: "allowance",
    args: [address!, CONTRACTS.Router as Address],
    query: { enabled: !!address && !tokenA.isNative },
  });
  const { data: allowanceB, refetch: refetchAllowB } = useReadContract({
    address: tokenBAddr, abi: erc20Abi, functionName: "allowance",
    args: [address!, CONTRACTS.Router as Address],
    query: { enabled: !!address && !tokenB.isNative },
  });

  const parsedA = useMemo(() => {
    try { return parseFloat(amountA) > 0 ? parseUnits(amountA, tokenA.decimals) : 0n; } catch { return 0n; }
  }, [amountA, tokenA.decimals]);
  const parsedB = useMemo(() => {
    try { return parseFloat(amountB) > 0 ? parseUnits(amountB, tokenB.decimals) : 0n; } catch { return 0n; }
  }, [amountB, tokenB.decimals]);

  const needsApprovalA = !tokenA.isNative && parsedA > 0n && (allowanceA ?? 0n) < parsedA;
  const needsApprovalB = !tokenB.isNative && parsedB > 0n && (allowanceB ?? 0n) < parsedB;

  const { writeContract, data: txHash, isPending, reset, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) {
      toast.success("Transaction confirmed!");
      setAmountA(""); setAmountB("");
      reset();
      refetchAllowA(); refetchAllowB(); refetchBalA(); refetchBalB();
      fetchPools(); fetchPairReserves();
    }
  }, [isSuccess, txHash, reset, refetchAllowA, refetchAllowB, refetchBalA, refetchBalB, fetchPools, fetchPairReserves]);

  useEffect(() => {
    if (writeError) {
      toast.error((writeError as any)?.shortMessage || writeError?.message || "Transaction failed");
    }
  }, [writeError]);

  const busy = isPending || isConfirming;

  function handleApprove(token: Address) {
    writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.Router as Address, maxUint256] });
  }

  function handleAddLiquidity() {
    if (!address || parsedA === 0n || parsedB === 0n) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    // Use 5% slippage for min amounts
    const minA = (parsedA * 1n) / 100n;
    const minB = (parsedB * 1n) / 100n;

    if (tokenA.isNative) {
      writeContract({
        address: CONTRACTS.Router as Address, abi: routerAbi, functionName: "addLiquidityETH",
        args: [tokenBAddr, parsedB, minB, minA, address, deadline],
        value: parsedA, gas: 5000000n,
      });
    } else if (tokenB.isNative) {
      writeContract({
        address: CONTRACTS.Router as Address, abi: routerAbi, functionName: "addLiquidityETH",
        args: [tokenAAddr, parsedA, minA, minB, address, deadline],
        value: parsedB, gas: 5000000n,
      });
    } else {
      writeContract({
        address: CONTRACTS.Router as Address, abi: routerAbi, functionName: "addLiquidity",
        args: [tokenAAddr, tokenBAddr, parsedA, parsedB, minA, minB, address, deadline],
        gas: 5000000n,
      });
    }
  }

  function handleRemoveLiquidity(pool: PoolInfo) {
    if (!address) return;
    const lpToRemove = (pool.userLp * BigInt(removePercent)) / 100n;
    if (lpToRemove === 0n) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    const lpAllowanceCheck = async () => {
      if (!publicClient) return;
      const allowance = await publicClient.readContract({
        address: pool.pairAddr, abi: pairAbi, functionName: "allowance",
        args: [address, CONTRACTS.Router as Address],
      });
      if (allowance < lpToRemove) {
        writeContract({
          address: pool.pairAddr, abi: pairAbi, functionName: "approve",
          args: [CONTRACTS.Router as Address, maxUint256],
        });
        toast("Approving LP tokens... please confirm the next transaction after this one.");
        return;
      }
      const isETHPair = pool.token0Addr.toLowerCase() === WECY.toLowerCase() || pool.token1Addr.toLowerCase() === WECY.toLowerCase();
      if (isETHPair) {
        const otherToken = pool.token0Addr.toLowerCase() === WECY.toLowerCase() ? pool.token1Addr : pool.token0Addr;
        writeContract({
          address: CONTRACTS.Router as Address, abi: routerAbi, functionName: "removeLiquidityETH",
          args: [otherToken, lpToRemove, 0n, 0n, address, deadline], gas: 500000n,
        });
      } else {
        writeContract({
          address: CONTRACTS.Router as Address, abi: routerAbi, functionName: "removeLiquidity",
          args: [pool.token0Addr, pool.token1Addr, lpToRemove, 0n, 0n, address, deadline], gas: 500000n,
        });
      }
    };
    lpAllowanceCheck();
  }

  const hasAmount = parsedA > 0n && parsedB > 0n;
  let action: "connect" | "enter" | "approveA" | "approveB" | "add" = "add";
  if (!isConnected) action = "connect";
  else if (!hasAmount) action = "enter";
  else if (needsApprovalA) action = "approveA";
  else if (needsApprovalB) action = "approveB";

  const priceInfo = pairReserves && pairReserves.rA > 0 && pairReserves.rB > 0
    ? `1 ${tokenA.symbol} ≈ ${(pairReserves.rB / pairReserves.rA).toFixed(4)} ${tokenB.symbol}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Your positions */}
      <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2 text-white">
          <Droplets className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Your Positions</h1>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : pools.filter(p => p.userLp > 0n).length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0f172a]/50 py-10 text-center">
            <p className="text-slate-400">No liquidity positions found</p>
            <button type="button" onClick={() => addRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add liquidity
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pools.filter(p => p.userLp > 0n).map((p, idx) => (
              <div key={p.pairAddr} className="rounded-xl border border-white/5 bg-[#0f172a] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{p.token0Symbol} / {p.token1Symbol}</p>
                    <p className="text-xs text-slate-500">LP: {fmtNum(p.userLp)} / {fmtNum(p.totalSupply)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      Your share: {p.totalSupply > 0n ? ((Number(p.userLp) / Number(p.totalSupply)) * 100).toFixed(2) : 0}%
                    </p>
                    <button onClick={() => setRemovePoolIdx(removePoolIdx === idx ? null : idx)}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20">
                      <Minus className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
                {removePoolIdx === idx && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-3">
                      <input type="range" min={1} max={100} value={removePercent} onChange={e => setRemovePercent(Number(e.target.value))} className="flex-1" />
                      <span className="text-sm font-semibold text-white w-12 text-right">{removePercent}%</span>
                    </div>
                    <button onClick={() => handleRemoveLiquidity(p)} disabled={busy}
                      className="mt-2 w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                      {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : `Remove ${removePercent}% Liquidity`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add liquidity */}
      <div ref={addRef} className="rounded-2xl border border-white/5 bg-[#1e293b] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Add Liquidity</h2>
        {priceInfo && (
          <div className="mb-4 rounded-xl bg-[#0f172a]/80 px-3 py-2 text-xs text-slate-400">
            Current rate: <span className="text-slate-200">{priceInfo}</span>
            {pairReserves && <span className="ml-2">(amounts auto-calculated to match pool ratio)</span>}
          </div>
        )}
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/5 bg-[#0f172a] p-4">
            <div className="mb-2 text-xs text-slate-400">Token A</div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSel("a")}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10">
                {tokenA.symbol}
              </button>
              <input value={amountA} onChange={e => handleAmountAChange(e.target.value)}
                placeholder="0.0" className="min-w-0 flex-1 bg-transparent text-right text-xl font-medium text-white placeholder:text-slate-600 outline-none" />
            </div>
            <div className="mt-1 text-right text-xs text-slate-500">
              Balance:{" "}
              <button type="button" className="hover:text-primary" onClick={() => {
                if (!balA) return;
                const v = formatUnits(balA.value, balA.decimals);
                handleAmountAChange(v);
              }}>
                {balA ? fmtNum(balA.value, balA.decimals, 6) : "0.00"}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#0f172a] p-4">
            <div className="mb-2 text-xs text-slate-400">Token B</div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSel("b")}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10">
                {tokenB.symbol}
              </button>
              <input value={amountB} onChange={e => handleAmountBChange(e.target.value)}
                placeholder="0.0" className="min-w-0 flex-1 bg-transparent text-right text-xl font-medium text-white placeholder:text-slate-600 outline-none" />
            </div>
            <div className="mt-1 text-right text-xs text-slate-500">
              Balance:{" "}
              <button type="button" className="hover:text-primary" onClick={() => {
                if (!balB) return;
                const v = formatUnits(balB.value, balB.decimals);
                handleAmountBChange(v);
              }}>
                {balB ? fmtNum(balB.value, balB.decimals, 6) : "0.00"}
              </button>
            </div>
          </div>

          {action === "connect" ? (
            <div className="[&_button]:w-full [&_button]:!rounded-xl [&_button]:!py-3"><ConnectButton /></div>
          ) : action === "enter" ? (
            <button disabled className="w-full rounded-xl bg-slate-600/50 py-3.5 text-sm font-semibold text-slate-400">Enter amounts</button>
          ) : action === "approveA" ? (
            <button onClick={() => handleApprove(tokenAAddr)} disabled={busy}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-[#0f172a] hover:bg-amber-400 disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : `Approve ${tokenA.symbol}`}
            </button>
          ) : action === "approveB" ? (
            <button onClick={() => handleApprove(tokenBAddr)} disabled={busy}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-[#0f172a] hover:bg-amber-400 disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : `Approve ${tokenB.symbol}`}
            </button>
          ) : (
            <button onClick={handleAddLiquidity} disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-[#0f172a] hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Add Liquidity"}
            </button>
          )}
        </div>
      </div>

      {/* All pools */}
      <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Pools</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : pools.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No pools found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Pool</th>
                  <th className="pb-3 pr-4 font-medium text-right">Reserve 0</th>
                  <th className="pb-3 pr-4 font-medium text-right">Reserve 1</th>
                  <th className="pb-3 font-medium text-right">Total LP</th>
                </tr>
              </thead>
              <tbody>
                {pools.map(p => (
                  <tr key={p.pairAddr} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="py-4 pr-4 font-medium text-white">{p.token0Symbol} / {p.token1Symbol}</td>
                    <td className="py-4 pr-4 tabular-nums text-right text-slate-300">{fmtNum(p.reserve0)}</td>
                    <td className="py-4 pr-4 tabular-nums text-right text-slate-300">{fmtNum(p.reserve1)}</td>
                    <td className="py-4 tabular-nums text-right text-slate-300">{fmtNum(p.totalSupply)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TokenSelector isOpen={sel !== null} onClose={() => setSel(null)}
        selectedToken={sel === "b" ? tokenB : tokenA}
        onSelect={t => {
          if (sel === "a") { setTokenA(t); setAmountA(""); setAmountB(""); }
          else if (sel === "b") { setTokenB(t); setAmountA(""); setAmountB(""); }
        }} />
    </div>
  );
}
