import { Routes, Route } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import { Layout } from "@/components/common/Layout";
import { SwapPage } from "@/pages/SwapPage";
import { PoolPage } from "@/pages/PoolPage";
import { ChartsPage } from "@/pages/ChartsPage";
import { TokensPage } from "@/pages/TokensPage";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { TransferPage } from "@/pages/TransferPage";
import { FarmPage } from "@/pages/FarmPage";
import { Toaster } from "react-hot-toast";
import { CHAIN_ID } from "@/config/contracts";

export default function App() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" } }} />
      {isWrongNetwork && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-center py-2 text-sm font-medium">
          Wrong network detected. Please switch to EnergyChain (Chain ID: {CHAIN_ID}).
        </div>
      )}
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<SwapPage />} />
          <Route path="/pool" element={<PoolPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/farm" element={<FarmPage />} />
        </Route>
      </Routes>
    </>
  );
}
