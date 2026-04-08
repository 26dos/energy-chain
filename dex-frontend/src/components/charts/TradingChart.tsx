import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: number;
  value: number;
  color: string;
}

export const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

interface Props {
  candles: CandleData[];
  volumes: VolumeData[];
  interval: string;
  onIntervalChange: (iv: string) => void;
}

export function TradingChart({ candles, volumes, interval, onIntervalChange }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
      width: chartRef.current.clientWidth,
      height: 420,
    });

    candleSeries.current = chart.addCandlestickSeries({
      upColor: "#22c55e", downColor: "#ef4444",
      borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });

    volumeSeries.current = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartInstance.current = chart;

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current) return;
    candleSeries.current.setData(candles as any);
    volumeSeries.current.setData(volumes as any);
    chartInstance.current?.timeScale().fitContent();
  }, [candles, volumes]);

  return (
    <div>
      <div className="flex gap-1 px-4 pt-4 pb-2">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => onIntervalChange(iv)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              interval === iv ? "bg-primary/20 text-primary" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {iv}
          </button>
        ))}
      </div>
      <div ref={chartRef} className="px-4 pb-4" />
    </div>
  );
}
