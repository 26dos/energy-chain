import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { CHAIN_CONFIG } from "@/config/contracts";
import App from "@/App";
import "@rainbow-me/rainbowkit/styles.css";
import "@/index.css";

const energyChain = defineChain({
  id: CHAIN_CONFIG.id,
  name: CHAIN_CONFIG.name,
  nativeCurrency: CHAIN_CONFIG.nativeCurrency,
  rpcUrls: {
    default: { http: [...CHAIN_CONFIG.rpcUrls.default.http] },
    public: { http: [...CHAIN_CONFIG.rpcUrls.public.http] },
  },
  blockExplorers: CHAIN_CONFIG.blockExplorers,
});

const config = getDefaultConfig({
  appName: "EnergySwap",
  projectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ??
    "00000000000000000000000000000000",
  chains: [energyChain],
  ssr: false,
});

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
