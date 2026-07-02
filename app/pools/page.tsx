"use client";

import { useReadContracts } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { baseSepolia } from "wagmi/chains";
import Link from "next/link";
import { UNI_FACTORY, FEE_TIER, factoryAbi, poolAbi } from "@/lib/contracts";
import { allPairs } from "@/lib/tokens";
import { useTokenList } from "@/lib/useTokenList";
import AppHeader from "@/components/AppHeader";

export default function PoolsPage() {
  const { tokens, loaded } = useTokenList();
  const pairs = allPairs(tokens);

  const { data: poolAddrs, isLoading } = useReadContracts({
    contracts: pairs.map(([a, b]) => ({
      address: UNI_FACTORY,
      abi: factoryAbi,
      functionName: "getPool",
      args: [a.address, b.address, FEE_TIER],
      chainId: baseSepolia.id,
    })),
    query: { enabled: loaded && pairs.length > 0 },
  });

  const rows = pairs.map(([a, b], i) => ({
    a,
    b,
    pool: poolAddrs?.[i]?.result as Address | undefined,
  }));

  const existingPools = rows.filter((r) => r.pool && r.pool !== zeroAddress);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center pt-10 px-4 pb-16">
        <div className="w-full max-w-[640px] space-y-4">
          <div className="text-center pb-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              All Pools
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
              Pools across the tokens you've added · 0.3% fee tier
            </p>
          </div>

          {!loaded ? (
            <div
              className="card text-center text-sm"
              style={{ color: "var(--ink-dim)" }}
            >
              Loading…
            </div>
          ) : pairs.length === 0 ? (
            <div className="card text-center py-8 space-y-3">
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                You haven't added any tokens yet, so there's nothing to pair.
              </p>
              <Link
                href="/add-liquidity"
                className="btn-primary inline-block"
                style={{ width: "auto", padding: "0.5rem 1.25rem" }}
              >
                Add a token & create a pool
              </Link>
            </div>
          ) : (
            <div className="card space-y-2">
              {isLoading && (
                <p
                  className="text-sm text-center py-6"
                  style={{ color: "var(--ink-dim)" }}
                >
                  Loading pools…
                </p>
              )}

              {!isLoading && existingPools.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                    No pools exist yet for your added tokens.
                  </p>
                  <Link
                    href="/add-liquidity"
                    className="btn-primary inline-block"
                    style={{ width: "auto", padding: "0.5rem 1.25rem" }}
                  >
                    Create a pool
                  </Link>
                </div>
              )}

              {existingPools.map((r) => (
                <PoolRow
                  key={`${r.a.symbol}-${r.b.symbol}`}
                  tokenASymbol={r.a.symbol}
                  tokenBSymbol={r.b.symbol}
                  poolAddr={r.pool!}
                />
              ))}
            </div>
          )}

          {!isLoading && pairs.length > 0 && (
            <details className="card">
              <summary
                className="text-sm cursor-pointer"
                style={{ color: "var(--ink-dim)" }}
              >
                Show {rows.length - existingPools.length} pair(s) without a pool
                yet
              </summary>
              <div className="pt-3 space-y-2">
                {rows
                  .filter((r) => !r.pool || r.pool === zeroAddress)
                  .map((r) => (
                    <div
                      key={`${r.a.symbol}-${r.b.symbol}-empty`}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-lg"
                      style={{
                        background: "var(--bg-raised)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <span style={{ color: "var(--ink)" }}>
                        {r.a.symbol} / {r.b.symbol}
                      </span>
                      <Link
                        href="/add-liquidity"
                        className="text-xs"
                        style={{ color: "var(--accent-light)" }}
                      >
                        Create →
                      </Link>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}

function PoolRow({
  tokenASymbol,
  tokenBSymbol,
  poolAddr,
}: {
  tokenASymbol: string;
  tokenBSymbol: string;
  poolAddr: Address;
}) {
  const { data } = useReadContracts({
    contracts: [
      {
        address: poolAddr,
        abi: poolAbi,
        functionName: "liquidity",
        chainId: baseSepolia.id,
      },
      {
        address: poolAddr,
        abi: poolAbi,
        functionName: "slot0",
        chainId: baseSepolia.id,
      },
    ],
  });

  const liquidity = data?.[0]?.result as bigint | undefined;
  const slot0 = data?.[1]?.result as
    | readonly [bigint, number, number, number, number, number, boolean]
    | undefined;
  const initialized = slot0 && slot0[0] > 0n;

  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-xl"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
      }}
    >
      <div>
        <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
          {tokenASymbol} / {tokenBSymbol}
        </p>
        <p className="text-xs font-mono" style={{ color: "var(--ink-dim)" }}>
          {poolAddr.slice(0, 10)}…{poolAddr.slice(-8)}
        </p>
      </div>
      <div className="text-right">
        <p
          className="text-xs font-semibold"
          style={{ color: initialized ? "var(--green)" : "var(--error)" }}
        >
          {initialized ? "Active" : "Not initialized"}
        </p>
        <p className="text-xs font-mono" style={{ color: "var(--ink-dim)" }}>
          liquidity: {liquidity !== undefined ? liquidity.toString() : "…"}
        </p>
      </div>
    </div>
  );
}
