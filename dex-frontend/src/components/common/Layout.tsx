import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/common/Navbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
