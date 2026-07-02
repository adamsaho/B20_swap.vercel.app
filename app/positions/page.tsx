"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, type Address } from "viem";
import { baseSepolia } from "wagmi/chains";
import { UNI_NFT_PM } from "@/lib/contracts";
import { nftPmReadAbi, nftPmWriteAbi, MAX_UINT128 } from "@/lib/positions";
import { tokenByAddress, type TokenInfo } from "@/lib/tokens";
import { useTokenList } from "@/lib/useTokenList";
import AppHeader from "@/components/AppHeader";

export default function PositionsPage() {
  const { address, isConnected } = useAccount();
  const { tokens, loaded } = useTokenList();

  const { data: balance } = useReadContract({
    address: UNI_NFT_PM,
    abi: nftPmReadAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const count = balance ? Number(balance) : 0;

  const { data: tokenIdResults } = useReadContracts({
    contracts: address
      ? Array.from({ length: count }, (_, i) => ({
          address: UNI_NFT_PM,
          abi: nftPmReadAbi,
          functionName: "tokenOfOwnerByIndex" as const,
          args: [address, BigInt(i)] as const,
          chainId: baseSepolia.id,
        }))
      : [],
    query: { enabled: !!address && count > 0 },
  });

  const tokenIds = (tokenIdResults ?? [])
    .map((r) => r.result as bigint | undefined)
    .filter((v): v is bigint => v !== undefined);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center pt-10 px-4 pb-16">
        <div className="w-full max-w-[560px] space-y-4">
          <div className="text-center pb-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              My Liquidity Positions
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
              View and remove liquidity you've provided
            </p>
          </div>

          {!isConnected ? (
            <div
              className="card text-center text-sm"
              style={{ color: "var(--ink-dim)" }}
            >
              Connect wallet to view your positions
            </div>
          ) : count === 0 ? (
            <div
              className="card text-center text-sm"
              style={{ color: "var(--ink-dim)" }}
            >
              You have no liquidity positions yet
            </div>
          ) : !loaded ? (
            <div
              className="card text-center text-sm"
              style={{ color: "var(--ink-dim)" }}
            >
              Loading…
            </div>
          ) : (
            <div className="space-y-3">
              {tokenIds.map((id) => (
                <PositionCard
                  key={id.toString()}
                  tokenId={id}
                  owner={address!}
                  knownTokens={tokens}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PositionCard({
  tokenId,
  owner,
  knownTokens,
}: {
  tokenId: bigint;
  owner: Address;
  knownTokens: TokenInfo[];
}) {
  const { data: pos, refetch } = useReadContract({
    address: UNI_NFT_PM,
    abi: nftPmReadAbi,
    functionName: "positions",
    args: [tokenId],
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess, isLoading } = useWaitForTransactionReceipt({ hash });
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (isSuccess) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  if (!pos) {
    return (
      <div className="card text-sm" style={{ color: "var(--ink-dim)" }}>
        Loading position #{tokenId.toString()}…
      </div>
    );
  }

  const [, , token0, token1, fee, , , liquidity, , , tokensOwed0, tokensOwed1] =
    pos as readonly [
      bigint,
      Address,
      Address,
      Address,
      number,
      number,
      number,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint
    ];

  // Resolve symbols from tokens the user has added; fall back to a truncated
  // address if this pool involves a token not in the local list.
  const t0 = tokenByAddress(knownTokens, token0);
  const t1 = tokenByAddress(knownTokens, token1);
  const sym0 = t0?.symbol ?? `${token0.slice(0, 6)}…`;
  const sym1 = t1?.symbol ?? `${token1.slice(0, 6)}…`;
  const dec0 = t0?.decimals ?? 18;
  const dec1 = t1?.decimals ?? 18;

  const isEmpty = liquidity === 0n && tokensOwed0 === 0n && tokensOwed1 === 0n;

  function removeLiquidity() {
    const liqToRemove = (liquidity * BigInt(pct)) / 100n;
    writeContract({
      address: UNI_NFT_PM,
      abi: nftPmWriteAbi,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity: liqToRemove,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
        },
      ],
      chainId: baseSepolia.id,
      gas: 500_000n,
    });
  }

  function collectFees() {
    writeContract({
      address: UNI_NFT_PM,
      abi: nftPmWriteAbi,
      functionName: "collect",
      args: [
        {
          tokenId,
          recipient: owner,
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        },
      ],
      chainId: baseSepolia.id,
      gas: 300_000n,
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold" style={{ color: "var(--ink)" }}>
          {sym0} / {sym1}
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--bg-raised)", color: "var(--ink-dim)" }}
        >
          #{tokenId.toString()} · {fee / 10000}%
        </span>
      </div>

      {isEmpty ? (
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          Position closed — no liquidity or fees remaining.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--line)",
              }}
            >
              <p style={{ color: "var(--ink-dim)" }}>Liquidity</p>
              <p className="font-mono" style={{ color: "var(--ink)" }}>
                {liquidity.toString()}
              </p>
            </div>
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--line)",
              }}
            >
              <p style={{ color: "var(--ink-dim)" }}>Unclaimed fees</p>
              <p className="font-mono text-xs" style={{ color: "var(--ink)" }}>
                {formatUnits(tokensOwed0, dec0).slice(0, 8)} {sym0}
                <br />
                {formatUnits(tokensOwed1, dec1).slice(0, 8)} {sym1}
              </p>
            </div>
          </div>

          {liquidity > 0n && (
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs" style={{ color: "var(--ink-dim)" }}>
                  Amount to remove
                </label>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--accent-light)" }}
                >
                  {pct}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex gap-1 mt-1">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPct(p)}
                    className="flex-1 text-xs py-1 rounded-md"
                    style={{
                      background:
                        pct === p ? "var(--accent-dim)" : "var(--bg-raised)",
                      color:
                        pct === p ? "var(--accent-light)" : "var(--ink-dim)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {liquidity > 0n && (
              <button
                onClick={removeLiquidity}
                disabled={isPending}
                className="btn-primary flex-1"
              >
                {isPending && isLoading ? "⏳…" : `Remove ${pct}% Liquidity`}
              </button>
            )}
            {(tokensOwed0 > 0n || tokensOwed1 > 0n) && (
              <button
                onClick={collectFees}
                disabled={isPending}
                className="flex-1 text-sm font-semibold rounded-lg"
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
              >
                Collect Fees
              </button>
            )}
          </div>
        </>
      )}

      {hash && (
        <div
          className="text-xs text-center py-1.5 rounded-lg"
          style={{
            background: isSuccess ? "var(--green-dim)" : "var(--accent-dim)",
            color: isSuccess ? "var(--green)" : "var(--accent-light)",
          }}
        >
          {isLoading ? "⏳ Confirming…" : "✅ Confirmed"}{" "}
          <a
            href={`https://sepolia.basescan.org/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="underline opacity-70"
          >
            view ↗
          </a>
        </div>
      )}
      {error && (
        <p className="text-xs break-words" style={{ color: "var(--error)" }}>
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}
