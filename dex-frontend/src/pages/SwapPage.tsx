import { SwapCard } from "@/components/swap/SwapCard";

export function SwapPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-6">
      <h1 className="sr-only">Swap</h1>
      <SwapCard />
    </div>
  );
}
