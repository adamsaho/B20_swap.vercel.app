"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const NAV = [
  { href: "/swap", label: "Swap" },
  { href: "/add-liquidity", label: "Add Liquidity" },
  { href: "/pools", label: "Pools" },
  { href: "/positions", label: "My Positions" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <header style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/swap" className="flex items-center gap-2">
            <span
              style={{ color: "var(--accent-light)" }}
              className="text-xl font-bold"
            >
              ⚡
            </span>
            <span
              className="font-bold tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              ZEEME DEFI
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full ml-1"
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent-light)",
              }}
            >
              Base Sepolia
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: active ? "var(--accent-dim)" : "transparent",
                    color: active ? "var(--accent-light)" : "var(--ink-dim)",
                  }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono px-2.5 py-1 rounded-full"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--line)",
                color: "var(--ink-dim)",
              }}
            >
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </span>
            <button
              onClick={() => disconnect()}
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--line)",
                color: "var(--ink-dim)",
                borderRadius: "0.5rem",
                padding: "0.35rem 0.75rem",
                fontSize: "0.8rem",
              }}
            >
              disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="btn-primary"
            style={{ width: "auto", padding: "0.5rem 1.25rem" }}
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* mobile nav */}
      <nav className="sm:hidden flex gap-1 px-4 pb-2 overflow-x-auto">
        {NAV.map((n) => {
          const active = pathname?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
              style={{
                background: active ? "var(--accent-dim)" : "var(--bg-card)",
                color: active ? "var(--accent-light)" : "var(--ink-dim)",
              }}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
