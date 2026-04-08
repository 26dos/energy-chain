import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Token } from "@/config/tokens";
import { TOKENS } from "@/config/tokens";

export interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: Token;
}

export function TokenSelector({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
}: TokenSelectorProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOKENS;
    return TOKENS.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1e293b] shadow-2xl transition-all duration-200">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="text-lg font-semibold text-white">Select a token</h2>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Search by name, symbol, or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0f172a] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none ring-primary/40 focus:border-primary/50 focus:ring-2"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <ul className="space-y-1">
            {filtered.map((token) => {
              const active =
                selectedToken?.address.toLowerCase() ===
                token.address.toLowerCase();
              return (
                <li key={token.address}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(token);
                      onClose();
                      setQuery("");
                    }}
                    className={[
                      "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div>
                      <div className="font-medium text-white">{token.symbol}</div>
                      <div className="text-xs text-slate-400">{token.name}</div>
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <span className="tabular-nums">0.00</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              No tokens match your search.
            </p>
          )}
        </div>

        <div className="border-t border-white/5 p-3">
          <button
            type="button"
            disabled
            className="w-full rounded-xl border border-dashed border-white/15 bg-[#0f172a]/50 py-3 text-sm text-slate-500 transition-colors hover:border-white/25 hover:text-slate-400 disabled:cursor-not-allowed"
          >
            Import by address (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
