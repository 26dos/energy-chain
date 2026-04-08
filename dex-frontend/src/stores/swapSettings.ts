import { create } from "zustand";

export type SlippagePreset = "0.1" | "0.5" | "1" | "custom";

interface SwapSettingsState {
  slippagePreset: SlippagePreset;
  customSlippage: string;
  deadlineMinutes: number;
  setSlippagePreset: (p: SlippagePreset) => void;
  setCustomSlippage: (v: string) => void;
  setDeadlineMinutes: (n: number) => void;
  getSlippagePercent: () => number;
}

function parseSlippage(preset: SlippagePreset, custom: string): number {
  if (preset === "custom") {
    const n = parseFloat(custom);
    return Number.isFinite(n) && n > 0 ? n : 0.5;
  }
  return parseFloat(preset);
}

export const useSwapSettings = create<SwapSettingsState>((set, get) => ({
  slippagePreset: "0.5",
  customSlippage: "",
  deadlineMinutes: 20,
  setSlippagePreset: (p) => set({ slippagePreset: p }),
  setCustomSlippage: (v) => set({ customSlippage: v }),
  setDeadlineMinutes: (n) =>
    set({ deadlineMinutes: Math.max(1, Math.min(180, n)) }),
  getSlippagePercent: () =>
    parseSlippage(get().slippagePreset, get().customSlippage),
}));
