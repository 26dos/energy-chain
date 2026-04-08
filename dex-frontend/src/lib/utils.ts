import { formatUnits } from "viem";
import { DEFAULT_DEADLINE } from "@/config/contracts";

export function formatAmount(amount: string | bigint, decimals = 18): string {
  if (typeof amount === "bigint") {
    return formatUnits(amount, decimals);
  }
  const t = amount.trim();
  if (t === "") return "0";
  if (/^\d+$/.test(t)) {
    return formatUnits(BigInt(t), decimals);
  }
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(Math.min(decimals, 20));
  return fixed.replace(/\.?0+$/, "") || "0";
}

export function shortenAddress(address: string): string {
  if (!address.startsWith("0x") || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  decimals = 18
): number {
  if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) return 0;
  const rOut = parseFloat(formatUnits(reserveOut, decimals));
  const rIn = parseFloat(formatUnits(reserveIn, decimals));
  const aIn = parseFloat(formatUnits(amountIn, decimals));
  const aOut = parseFloat(formatUnits(amountOut, decimals));
  if (rIn === 0 || aIn === 0) return 0;
  const marketRatio = rOut / rIn;
  const execRatio = aOut / aIn;
  if (marketRatio === 0) return 0;
  return ((marketRatio - execRatio) / marketRatio) * 100;
}

export function getDeadline(minutes?: number): bigint {
  const m = minutes ?? DEFAULT_DEADLINE;
  return BigInt(Math.floor(Date.now() / 1000) + m * 60);
}
