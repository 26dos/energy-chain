import { X } from "lucide-react";
import { useSwapSettings, type SlippagePreset } from "@/stores/swapSettings";

export interface SwapSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const presets: SlippagePreset[] = ["0.1", "0.5", "1"];

export function SwapSettings({ isOpen, onClose }: SwapSettingsProps) {
  const {
    slippagePreset,
    customSlippage,
    deadlineMinutes,
    setSlippagePreset,
    setCustomSlippage,
    setDeadlineMinutes,
  } = useSwapSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1e293b] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Transaction settings</h3>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">Slippage tolerance</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSlippagePreset(p)}
                  className={[
                    "min-w-[4rem] rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    slippagePreset === p
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "bg-[#0f172a] text-slate-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSlippagePreset("custom")}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  slippagePreset === "custom"
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "bg-[#0f172a] text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                Custom
              </button>
            </div>
            {slippagePreset === "custom" && (
              <div className="mt-3">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.50"
                    value={customSlippage}
                    onChange={(e) => setCustomSlippage(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0f172a] py-2.5 pl-3 pr-8 text-sm text-white placeholder:text-slate-500 outline-none ring-primary/30 focus:border-primary/50 focus:ring-2"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    %
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="deadline"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Transaction deadline
            </label>
            <div className="flex items-center gap-2">
              <input
                id="deadline"
                type="number"
                min={1}
                max={180}
                value={deadlineMinutes}
                onChange={(e) =>
                  setDeadlineMinutes(parseInt(e.target.value, 10) || 20)
                }
                className="w-full rounded-xl border border-white/10 bg-[#0f172a] py-2.5 px-3 text-sm text-white outline-none ring-primary/30 focus:border-primary/50 focus:ring-2"
              />
              <span className="shrink-0 text-sm text-slate-400">minutes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
