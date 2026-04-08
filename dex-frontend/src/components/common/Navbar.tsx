import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, X, Zap } from "lucide-react";

const links = [
  { to: "/", label: "Swap" },
  { to: "/pool", label: "Pool" },
  { to: "/charts", label: "Charts" },
  { to: "/tokens", label: "Tokens" },
  { to: "/farm", label: "Farm" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/transfer", label: "Transfer" },
] as const;

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "text-sm font-medium transition-colors px-3 py-2 rounded-lg",
    isActive
      ? "text-primary"
      : "text-slate-400 hover:text-white hover:bg-white/5",
  ].join(" ");

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-90"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight">EnergySwap</span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === "/"} className={navClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block [&_button]:!rounded-xl">
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/5 hover:text-white md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div
        className={[
          "overflow-hidden border-t border-white/5 bg-[#0f172a]/95 backdrop-blur-md transition-all duration-200 md:hidden",
          open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0 border-transparent",
        ].join(" ")}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={navClass}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <div className="pt-2 [&_button]:w-full [&_button]:!justify-center">
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </nav>
      </div>
    </header>
  );
}
