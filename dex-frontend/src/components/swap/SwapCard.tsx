import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { ArrowDown, ArrowUpDown, Loader2, Settings2 } from "lucide-react";
import { formatUnits, parseUnits, type Address, parseAbi, maxUint256 } from "viem";
import toast from "react-hot-toast";
import type { Token } from "@/config/tokens";
import { NATIVE_TOKEN, TOKENS } from "@/config/tokens";
import { CONTRACTS } from "@/config/contracts";
import { TokenSelector } from "@/components/common/TokenSelector";
import { SwapSettings } from "@/components/swap/SwapSettings";
import { useSwapSettings } from "@/stores/swapSettings";

const routerAbi = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
]);

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
]);

function fmtBal(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return "0.00";
  const s = formatUnits(value, decimals);
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return "0.00";
  return n < 0.0001 ? "<0.0001" : n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function getTokenAddr(t: Token): Address {
  return t.isNative ? (CONTRACTS.WECY as Address) : (t.address as Address);
}

export function SwapCard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const getSlippagePercent = useSwapSettings((s) => s.getSlippagePercent);

  const [tokenIn, setTokenIn] = useState<Token>(TOKENS[0] ?? NATIVE_TOKEN);
  const [tokenOut, setTokenOut] = useState<Token>(TOKENS.length > 2 ? TOKENS[2]! : TOKENS[1] ?? NATIVE_TOKEN);
  const [amountIn, setAmountIn] = useState("");
  const [selectorTarget, setSelectorTarget] = useState<"in" | "out" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: balIn, refetch: refetchBalIn } = useBalance({
    address,
    token: tokenIn.isNative ? undefined : (tokenIn.address as Address),
    query: { enabled: !!address },
  });
  const { data: balOut, refetch: refetchBalOut } = useBalance({
    address,
    token: tokenOut.isNative ? undefined : (tokenOut.address as Address),
    query: { enabled: !!address },
  });

  const parsedAmountIn = useMemo(() => {
    try {
      const v = parseFloat(amountIn);
      if (!v || v <= 0) return 0n;
      return parseUnits(amountIn, tokenIn.decimals);
    } catch { return 0n; }
  }, [amountIn, tokenIn.decimals]);

  const path = useMemo(() => {
    const a = getTokenAddr(tokenIn);
    const b = getTokenAddr(tokenOut);
    return [a, b] as readonly Address[];
  }, [tokenIn, tokenOut]);

  const { data: amountsOut } = useReadContract({
    address: CONTRACTS.Router as Address,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [parsedAmountIn, [...path]],
    query: { enabled: parsedAmountIn > 0n },
  });

  const amountOutRaw = amountsOut?.[1] ?? 0n;
  const amountOutDisplay = amountOutRaw > 0n
    ? parseFloat(formatUnits(amountOutRaw, tokenOut.decimals))
    : 0;

  const rate = useMemo(() => {
    if (!amountOutRaw || amountOutRaw === 0n || parsedAmountIn === 0n) return null;
    const inVal = parseFloat(formatUnits(parsedAmountIn, tokenIn.decimals));
    const outVal = parseFloat(formatUnits(amountOutRaw, tokenOut.decimals));
    if (inVal === 0) return null;
    return outVal / inVal;
  }, [amountOutRaw, parsedAmountIn, tokenIn.decimals, tokenOut.decimals]);

  const slippage = getSlippagePercent();
  const minReceived = amountOutRaw > 0n
    ? (amountOutRaw * BigInt(Math.floor((100 - slippage) * 100))) / 10000n
    : 0n;

  // Check allowance for ERC-20 tokens
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: getTokenAddr(tokenIn),
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, CONTRACTS.Router as Address],
    query: { enabled: !!address && !tokenIn.isNative },
  });

  const needsApproval = !tokenIn.isNative && parsedAmountIn > 0n && (allowance ?? 0n) < parsedAmountIn;

  const { writeContract, data: txHash, isPending: isSending, reset, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) {
      toast.success("Transaction confirmed!");
      setAmountIn("");
      reset();
      refetchBalIn();
      refetchBalOut();
      refetchAllowance();
    }
  }, [isSuccess, txHash, reset, refetchBalIn, refetchBalOut, refetchAllowance]);

  useEffect(() => {
    if (writeError) {
      toast.error((writeError as any)?.shortMessage || writeError?.message || "Transaction failed");
    }
  }, [writeError]);

  const handleApprove = useCallback(() => {
    writeContract({
      address: getTokenAddr(tokenIn),
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.Router as Address, maxUint256],
    });
  }, [tokenIn, writeContract]);

  const handleSwap = useCallback(() => {
    if (!address || parsedAmountIn === 0n) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    if (tokenIn.isNative) {
      writeContract({
        address: CONTRACTS.Router as Address,
        abi: routerAbi,
        functionName: "swapExactETHForTokens",
        args: [minReceived, [...path], address, deadline],
        value: parsedAmountIn,
        gas: 500000n,
      });
    } else if (tokenOut.isNative) {
      writeContract({
        address: CONTRACTS.Router as Address,
        abi: routerAbi,
        functionName: "swapExactTokensForETH",
        args: [parsedAmountIn, minReceived, [...path], address, deadline],
        gas: 500000n,
      });
    } else {
      writeContract({
        address: CONTRACTS.Router as Address,
        abi: routerAbi,
        functionName: "swapExactTokensForTokens",
        args: [parsedAmountIn, minReceived, [...path], address, deadline],
        gas: 500000n,
      });
    }
  }, [address, parsedAmountIn, minReceived, path, tokenIn, tokenOut, writeContract]);

  const balanceInNum = balIn ? parseFloat(formatUnits(balIn.value, balIn.decimals)) : 0;
  const amountInNum = parseFloat(amountIn) || 0;
  const hasAmount = amountIn.trim() !== "" && amountInNum > 0;
  const insufficient = isConnected && hasAmount && amountInNum > balanceInNum;
  const busy = isSending || isConfirming;

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
  }

  type Action = "connect" | "enter" | "insufficient" | "approve" | "swap";
  let action: Action = "swap";
  if (!isConnected) action = "connect";
  else if (!hasAmount) action = "enter";
  else if (insufficient) action = "insufficient";
  else if (needsApproval) action = "approve";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-white/5 bg-[#1e293b] p-4 shadow-xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Swap</h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-primary"
            aria-label="Settings"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        <div className="relative space-y-1">
          {/* From */}
          <div className="rounded-2xl border border-white/5 bg-[#0f172a] p-4 transition-colors hover:border-white/10">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>From</span>
              <span>
                Balance:{" "}
                <button
                  type="button"
                  className="tabular-nums text-slate-300 hover:text-primary"
                  onClick={() => balIn && setAmountIn(formatUnits(balIn.value, balIn.decimals))}
                >
                  {isConnected ? fmtBal(balIn?.value, balIn?.decimals ?? tokenIn.decimals) : "—"}
                </button>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectorTarget("in")}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20"
              >
                {tokenIn.symbol}
                <ArrowDown className="h-4 w-4 text-slate-400" />
              </button>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value.replace(/[^0-9.]/g, ""))}
                className="min-w-0 flex-1 bg-transparent text-right text-2xl font-medium text-white placeholder:text-slate-600 outline-none sm:text-3xl"
              />
            </div>
          </div>

          {/* Flip button */}
          <div className="relative z-10 flex justify-center py-0">
            <button
              type="button"
              onClick={flip}
              className="-my-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#1e293b] text-slate-300 shadow-lg transition-all hover:scale-105 hover:border-primary/40 hover:text-primary"
              aria-label="Flip tokens"
            >
              <ArrowUpDown className="h-5 w-5" />
            </button>
          </div>

          {/* To */}
          <div className="rounded-2xl border border-white/5 bg-[#0f172a] p-4 transition-colors hover:border-white/10">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>To</span>
              <span>
                Balance:{" "}
                <span className="tabular-nums text-slate-300">
                  {isConnected ? fmtBal(balOut?.value, balOut?.decimals ?? tokenOut.decimals) : "—"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectorTarget("out")}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20"
              >
                {tokenOut.symbol}
                <ArrowDown className="h-4 w-4 text-slate-400" />
              </button>
              <div className="min-w-0 flex-1 text-right text-2xl font-medium tabular-nums text-slate-300 sm:text-3xl">
                {amountOutDisplay > 0
                  ? amountOutDisplay.toLocaleString(undefined, { maximumFractionDigits: 6 })
                  : "0.0"}
              </div>
            </div>
          </div>
        </div>

        {/* Info panel */}
        {hasAmount && rate !== null && (
          <div className="mt-4 space-y-2 rounded-xl bg-[#0f172a]/80 px-3 py-3 text-xs text-slate-400">
            <div className="flex justify-between gap-2">
              <span>Rate</span>
              <span className="text-right text-slate-300">
                1 {tokenIn.symbol} ≈ {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Minimum received ({slippage}% slippage)</span>
              <span className="tabular-nums text-slate-300">
                {formatUnits(minReceived, tokenOut.decimals).substring(0, 12)} {tokenOut.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="mt-5">
          {action === "connect" && (
            <div className="[&_button]:w-full [&_button]:!rounded-xl [&_button]:!py-3">
              <ConnectButton />
            </div>
          )}
          {action === "enter" && (
            <button type="button" disabled className="w-full rounded-xl bg-slate-600/50 py-3.5 text-center text-sm font-semibold text-slate-400">
              Enter an amount
            </button>
          )}
          {action === "insufficient" && (
            <button type="button" disabled className="w-full rounded-xl bg-red-500/20 py-3.5 text-center text-sm font-semibold text-red-400 ring-1 ring-red-500/30">
              Insufficient {tokenIn.symbol} balance
            </button>
          )}
          {action === "approve" && (
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              className="w-full rounded-xl bg-amber-500 py-3.5 text-center text-sm font-semibold text-[#0f172a] transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : `Approve ${tokenIn.symbol}`}
            </button>
          )}
          {action === "swap" && (
            <button
              type="button"
              disabled={busy}
              onClick={handleSwap}
              className="w-full rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-[#0f172a] transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Swap"}
            </button>
          )}
        </div>
      </div>

      <TokenSelector
        isOpen={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        selectedToken={selectorTarget === "out" ? tokenOut : tokenIn}
        onSelect={(t) => {
          if (selectorTarget === "in") {
            if (t.address === tokenOut.address) flip();
            else setTokenIn(t);
          } else if (selectorTarget === "out") {
            if (t.address === tokenIn.address) flip();
            else setTokenOut(t);
          }
        }}
      />
      <SwapSettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
