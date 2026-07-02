"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { parseUnits, formatUnits, zeroAddress, type Address } from "viem";
import { baseSepolia } from "wagmi/chains";
import {
  UNI_FACTORY,
  UNI_NFT_PM,
  FEE_TIER,
  erc20Abi,
  wethAbi,
  factoryAbi,
  poolAbi,
  nftPmAbi,
  sqrtPriceX96ForPrice,
  MIN_TICK,
  MAX_TICK,
} from "@/lib/contracts";
import { tokenBySymbol, onchainToken, type TokenInfo } from "@/lib/tokens";
import { useTokenList } from "@/lib/useTokenList";
import TokenPicker from "@/components/TokenPicker";
import AppHeader from "@/components/AppHeader";

export default function AddLiquidityPage() {
  const { address, isConnected } = useAccount();
  const { tokens, custom, addToken, removeToken, loaded } = useTokenList();

  const [symA, setSymA] = useState("ETH");
  const [symB, setSymB] = useState("WETH");

  useEffect(() => {
    if (symA === symB) {
      const alt = tokens.find((t) => t.symbol !== symA);
      if (alt) setSymB(alt.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symA, tokens.length]);

  const tokenA = tokenBySymbol(tokens, symA) ?? tokens[0];
  const tokenB = tokenBySymbol(tokens, symB) ?? tokens[1];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center pt-10 px-4 pb-16">
        <div className="w-full max-w-[480px] space-y-4">
          <div className="text-center pb-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              Add Liquidity
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
              Add any two B20/ERC20 tokens to create or top up a pool
            </p>
          </div>

          {!loaded ? (
            <div
              className="card text-center text-sm"
              style={{ color: "var(--ink-dim)" }}
            >
              Loading…
            </div>
          ) : (
            <div className="card space-y-3">
              <TokenPicker
                label="Token A"
                tokens={tokens}
                customTokens={custom}
                value={tokenA.symbol}
                onChange={setSymA}
                exclude={tokenB.symbol}
                onAddToken={addToken}
                onRemoveToken={removeToken}
              />
              <TokenPicker
                label="Token B"
                tokens={tokens}
                customTokens={custom}
                value={tokenB.symbol}
                onChange={setSymB}
                exclude={tokenA.symbol}
                onAddToken={addToken}
                onRemoveToken={removeToken}
              />
            </div>
          )}

          {loaded && symA !== symB && (
            <LiquidityForm
              address={address}
              isConnected={isConnected}
              tokenA={tokenA}
              tokenB={tokenB}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function usePoolAddress(tokenA: TokenInfo, tokenB: TokenInfo) {
  const a = onchainToken(tokenA).address;
  const b = onchainToken(tokenB).address;
  return useReadContract({
    address: UNI_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [a, b, FEE_TIER],
    chainId: baseSepolia.id,
    query: { enabled: a.toLowerCase() !== b.toLowerCase() },
  });
}

function PoolBadge({ addr }: { addr?: Address }) {
  const ok = addr && addr !== zeroAddress;
  return (
    <div
      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
        color: ok ? "var(--green)" : "var(--ink-dim)",
      }}
    >
      {ok
        ? `✓ Pool: ${addr?.slice(0, 8)}…${addr?.slice(-6)}`
        : "○ No pool yet — will be created below"}
    </div>
  );
}

function AmountRow({
  label,
  value,
  onChange,
  balance,
  symbol,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  balance?: string;
  symbol: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="flex justify-between mb-2">
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {label}
        </span>
        {balance && (
          <button
            onClick={() => onChange(balance)}
            className="text-xs"
            style={{ color: "var(--accent-light)" }}
          >
            Max: {Number(balance).toFixed(4)}
          </button>
        )}
      </div>
      <div className="flex gap-3 items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          min="0"
          placeholder="0.0"
          className="input-box"
          style={{ background: "transparent", border: "none", padding: 0 }}
        />
        <span
          className="font-bold text-sm px-3 py-1.5 rounded-lg shrink-0"
          style={{ background: "var(--bg-card)", color: "var(--ink)" }}
        >
          {symbol}
        </span>
      </div>
    </div>
  );
}

function useTokenBalance(token: TokenInfo, address?: Address) {
  const native = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: !!address && token.isNative },
  });
  const erc20 = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !token.isNative },
  });
  if (token.isNative) {
    return {
      raw: native.data?.value,
      formatted: native.data
        ? formatUnits(native.data.value, token.decimals)
        : undefined,
      refetch: native.refetch,
    };
  }
  return {
    raw: erc20.data as bigint | undefined,
    formatted:
      erc20.data !== undefined
        ? formatUnits(erc20.data as bigint, token.decimals)
        : undefined,
    refetch: erc20.refetch,
  };
}

function LiquidityForm({
  address,
  isConnected,
  tokenA,
  tokenB,
}: {
  address?: Address;
  isConnected: boolean;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
}) {
  const { data: poolAddr, refetch: refetchPool } = usePoolAddress(
    tokenA,
    tokenB
  );
  const exists = poolAddr && poolAddr !== zeroAddress;

  const [amtA, setAmtA] = useState("1");
  const [amtB, setAmtB] = useState("1");
  const [price, setPrice] = useState("1"); // tokenA per 1 tokenB, only used pre-init

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: slot0 } = useReadContract({
    address: poolAddr as Address,
    abi: poolAbi,
    functionName: "slot0",
    query: { enabled: !!exists },
  });
  const isInit = slot0 && (slot0 as any)[0] > 0n;

  const balA = useTokenBalance(tokenA, address);
  const balB = useTokenBalance(tokenB, address);

  const chainA = onchainToken(tokenA);
  const chainB = onchainToken(tokenB);
  const weiA = parseUnits(amtA || "0", tokenA.decimals);
  const weiB = parseUnits(amtB || "0", tokenB.decimals);

  const nativeSideIsA = tokenA.isNative;
  const nativeSideIsB = tokenB.isNative;

  const { data: wethBalRaw, refetch: rWeth } = useReadContract({
    address: nativeSideIsA ? chainA.address : chainB.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && (nativeSideIsA || nativeSideIsB) },
  });

  const { data: allowA, refetch: rAA } = useReadContract({
    address: chainA.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, UNI_NFT_PM] : undefined,
    query: { enabled: !!address },
  });
  const { data: allowB, refetch: rAB } = useReadContract({
    address: chainB.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, UNI_NFT_PM] : undefined,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (isSuccess) {
      refetchPool();
      rWeth();
      rAA();
      rAB();
      balA.refetch?.();
      balB.refetch?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const nativeWeiNeeded = nativeSideIsA ? weiA : nativeSideIsB ? weiB : 0n;
  const needWrap =
    (nativeSideIsA || nativeSideIsB) && (wethBalRaw ?? 0n) < nativeWeiNeeded;

  const needApproveA = !tokenA.isNative && (allowA ?? 0n) < weiA;
  const needApproveB = !tokenB.isNative && (allowB ?? 0n) < weiB;

  type Act = "init" | "wrap" | "approveA" | "approveB" | "add";
  const act: Act = !isInit
    ? "init"
    : needWrap
    ? "wrap"
    : needApproveA
    ? "approveA"
    : needApproveB
    ? "approveB"
    : "add";

  const labels: Record<Act, string> = {
    init: "Initialize Pool Price",
    wrap: `Wrap ${nativeSideIsA ? amtA : amtB} ETH → WETH`,
    approveA: `Approve ${tokenA.symbol}`,
    approveB: `Approve ${tokenB.symbol}`,
    add: "Add Liquidity",
  };

  function go() {
    if (act === "init") {
      const t0IsA = chainA.address.toLowerCase() < chainB.address.toLowerCase();
      const priceForToken0PerToken1 = t0IsA ? Number(price) : 1 / Number(price);
      writeContract({
        address: poolAddr as Address,
        abi: poolAbi,
        functionName: "initialize",
        args: [sqrtPriceX96ForPrice(priceForToken0PerToken1)],
        chainId: baseSepolia.id,
        gas: 500_000n,
      });
    } else if (act === "wrap") {
      writeContract({
        address: nativeSideIsA ? chainA.address : chainB.address,
        abi: wethAbi,
        functionName: "deposit",
        value: nativeWeiNeeded,
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (act === "approveA") {
      writeContract({
        address: chainA.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [UNI_NFT_PM, weiA * 100n],
        chainId: baseSepolia.id,
      });
    } else if (act === "approveB") {
      writeContract({
        address: chainB.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [UNI_NFT_PM, weiB * 100n],
        chainId: baseSepolia.id,
      });
    } else {
      const [t0, t1, a0, a1] =
        chainA.address.toLowerCase() < chainB.address.toLowerCase()
          ? [chainA.address, chainB.address, weiA, weiB]
          : [chainB.address, chainA.address, weiB, weiA];
      writeContract({
        address: UNI_NFT_PM,
        abi: nftPmAbi,
        functionName: "mint",
        args: [
          {
            token0: t0,
            token1: t1,
            fee: FEE_TIER,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: a0,
            amount1Desired: a1,
            amount0Min: 0n,
            amount1Min: 0n,
            recipient: address!,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
          },
        ],
        chainId: baseSepolia.id,
        gas: 5_000_000n,
      });
    }
  }

  const needCreatePool = !exists;
  const {
    writeContract: createPoolWrite,
    data: createHash,
    isPending: creating,
  } = useWriteContract();
  const { isSuccess: createSuccess } = useWaitForTransactionReceipt({
    hash: createHash,
  });
  useEffect(() => {
    if (createSuccess) refetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSuccess]);

  return (
    <div className="card space-y-4">
      <PoolBadge addr={poolAddr as Address} />

      {needCreatePool && (
        <button
          onClick={() =>
            createPoolWrite({
              address: UNI_FACTORY,
              abi: factoryAbi,
              functionName: "createPool",
              args: [chainA.address, chainB.address, FEE_TIER],
              chainId: baseSepolia.id,
              gas: 3_000_000n,
            })
          }
          disabled={creating || !isConnected}
          className="btn-primary"
        >
          {creating
            ? "⏳ Confirm in wallet…"
            : `Create ${tokenA.symbol}/${tokenB.symbol} Pool`}
        </button>
      )}

      {!needCreatePool && !isInit && (
        <div>
          <label
            className="block text-xs mb-1.5"
            style={{ color: "var(--ink-dim)" }}
          >
            Initial price: {tokenA.symbol} per 1 {tokenB.symbol}
          </label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-box"
            placeholder="1"
          />
        </div>
      )}

      {!needCreatePool && (
        <>
          <AmountRow
            label={`${tokenA.symbol} to deposit`}
            value={amtA}
            onChange={setAmtA}
            balance={balA.formatted}
            symbol={tokenA.symbol}
          />
          <div
            className="text-center text-xs"
            style={{ color: "var(--ink-dim)" }}
          >
            +
          </div>
          <AmountRow
            label={`${tokenB.symbol} to deposit`}
            value={amtB}
            onChange={setAmtB}
            balance={balB.formatted}
            symbol={tokenB.symbol}
          />

          <div className="space-y-1.5 text-xs">
            {[
              ["Initialize price", !!isInit],
              ...(nativeSideIsA || nativeSideIsB
                ? ([["Wrap ETH → WETH", !needWrap]] as [string, boolean][])
                : []),
              [`Approve ${tokenA.symbol}`, !needApproveA],
              [`Approve ${tokenB.symbol}`, !needApproveB],
              ["Add liquidity", false],
            ].map(([l, d], i) => (
              <div key={i} className="flex items-center gap-2">
                <span style={{ color: d ? "var(--green)" : "var(--ink-dim)" }}>
                  {d ? "✓" : `${i + 1}.`}
                </span>
                <span
                  style={{
                    color: d ? "var(--ink-dim)" : "var(--ink)",
                    textDecoration: d ? "line-through" : "none",
                  }}
                >
                  {l as string}
                </span>
              </div>
            ))}
          </div>

          {isConnected ? (
            <button onClick={go} disabled={isPending} className="btn-primary">
              {isPending ? "⏳ Confirm…" : labels[act]}
            </button>
          ) : (
            <p
              className="text-sm text-center"
              style={{ color: "var(--ink-dim)" }}
            >
              Connect wallet first
            </p>
          )}
        </>
      )}

      {hash && <TxLine hash={hash} label={labels[act]} />}
      {createHash && <TxLine hash={createHash} label="Pool created" />}
      {error && (
        <p className="text-xs break-words" style={{ color: "var(--error)" }}>
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}

function TxLine({ hash, label }: { hash: `0x${string}`; label: string }) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  return (
    <div
      className="text-sm text-center py-2 rounded-lg"
      style={{
        background: isSuccess ? "var(--green-dim)" : "var(--accent-dim)",
        color: isSuccess ? "var(--green)" : "var(--accent-light)",
      }}
    >
      {isLoading ? `⏳ Waiting for ${label}…` : `✅ ${label} confirmed!`}{" "}
      <a
        href={`https://sepolia.basescan.org/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="underline opacity-70"
      >
        view ↗
      </a>
    </div>
  );
}
