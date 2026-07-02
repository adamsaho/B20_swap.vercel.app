"use client";

import { useEffect, useRef, useState } from "react";
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
  UNI_ROUTER,
  QUOTER_ADDRESS,
  FEE_TIER,
  erc20Abi,
  wethAbi,
  factoryAbi,
  routerAbi,
  quoterAbi,
} from "@/lib/contracts";
import {
  tokenBySymbol,
  onchainToken,
  WETH_TOKEN,
  type TokenInfo,
} from "@/lib/tokens";
import { useTokenList } from "@/lib/useTokenList";
import TokenPicker from "@/components/TokenPicker";
import AppHeader from "@/components/AppHeader";

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { tokens, custom, addToken, removeToken, loaded } = useTokenList();

  const [symFrom, setSymFrom] = useState("ETH");
  const [symTo, setSymTo] = useState("WETH");

  useEffect(() => {
    if (symFrom === symTo) {
      const alt = tokens.find((t) => t.symbol !== symFrom);
      if (alt) setSymTo(alt.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symFrom, tokens.length]);

  const from = tokenBySymbol(tokens, symFrom) ?? tokens[0];
  const to = tokenBySymbol(tokens, symTo) ?? tokens[1];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center pt-10 px-4 pb-16">
        <div className="w-full max-w-[480px] space-y-4">
          <div className="text-center pb-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              Swap
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
              Swap between any tokens you've added · Uniswap V3 · Base Sepolia
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
                label="From"
                tokens={tokens}
                customTokens={custom}
                value={from.symbol}
                onChange={setSymFrom}
                exclude={to.symbol}
                onAddToken={addToken}
                onRemoveToken={removeToken}
              />
              <TokenPicker
                label="To"
                tokens={tokens}
                customTokens={custom}
                value={to.symbol}
                onChange={setSymTo}
                exclude={from.symbol}
                onAddToken={addToken}
                onRemoveToken={removeToken}
              />
            </div>
          )}

          {loaded && from.symbol !== to.symbol && (
            <SwapCard
              address={address}
              isConnected={isConnected}
              from={from}
              to={to}
            />
          )}
        </div>
      </main>
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

type RouteType =
  | "wrap"
  | "unwrap"
  | "directSwap"
  | "buyViaWeth"
  | "sellViaWeth";

function routeFor(from: TokenInfo, to: TokenInfo): RouteType {
  if (from.isNative && to.symbol === "WETH") return "wrap";
  if (from.symbol === "WETH" && to.isNative) return "unwrap";
  if (from.isNative && !to.isNative && to.symbol !== "WETH")
    return "buyViaWeth";
  if (!from.isNative && from.symbol !== "WETH" && to.isNative)
    return "sellViaWeth";
  return "directSwap"; // any ERC20 <-> ERC20 (incl. WETH<->other) direct pool swap
}

function SwapCard({
  address,
  isConnected,
  from,
  to,
}: {
  address?: Address;
  isConnected: boolean;
  from: TokenInfo;
  to: TokenInfo;
}) {
  const [amount, setAmount] = useState("0.001");
  const routeType = routeFor(from, to);

  const chainFrom = onchainToken(from);
  const chainTo = onchainToken(to);

  const { data: poolAddr } = useReadContract({
    address: UNI_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [chainFrom.address, chainTo.address, FEE_TIER],
    chainId: baseSepolia.id,
    query: { enabled: routeType !== "wrap" && routeType !== "unwrap" },
  });
  const exists = poolAddr && poolAddr !== zeroAddress;

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const balFrom = useTokenBalance(from, address);
  const balTo = useTokenBalance(to, address);
  const balWeth = useTokenBalance(WETH_TOKEN, address);

  const amtIn = parseUnits(amount || "0", from.decimals);

  const swapTokenIn: Address | undefined =
    routeType === "directSwap"
      ? chainFrom.address
      : routeType === "buyViaWeth"
      ? WETH_TOKEN.address
      : routeType === "sellViaWeth"
      ? chainFrom.address
      : undefined;
  const swapTokenOut: Address | undefined =
    routeType === "directSwap"
      ? chainTo.address
      : routeType === "buyViaWeth"
      ? chainTo.address
      : routeType === "sellViaWeth"
      ? WETH_TOKEN.address
      : undefined;

  const touchesRouter =
    routeType === "directSwap" ||
    routeType === "buyViaWeth" ||
    routeType === "sellViaWeth";
  const needWrap = routeType === "buyViaWeth" && (balWeth.raw ?? 0n) < amtIn;

  const { data: allow, refetch: rA } = useReadContract({
    address: swapTokenIn,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && swapTokenIn ? [address, UNI_ROUTER] : undefined,
    query: { enabled: !!address && touchesRouter },
  });
  const needApprove = touchesRouter && !needWrap && (allow ?? 0n) < amtIn;

  const {
    data: quoteData,
    isFetching: quoteLoading,
    refetch: rQuote,
  } = useReadContract({
    address: QUOTER_ADDRESS,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: (swapTokenIn ?? zeroAddress) as Address,
        tokenOut: (swapTokenOut ?? zeroAddress) as Address,
        amountIn: amtIn,
        fee: FEE_TIER,
        sqrtPriceLimitX96: 0n,
      },
    ],
    query: {
      enabled:
        touchesRouter &&
        !!exists &&
        amtIn > 0n &&
        !!swapTokenIn &&
        !!swapTokenOut,
    },
  });
  const quotedOut = quoteData ? (quoteData[0] as bigint) : undefined;

  const [pendingUnwrap, setPendingUnwrap] = useState(false);
  const lastAction = useRef<string | null>(null);

  useEffect(() => setPendingUnwrap(false), [from.symbol, to.symbol, amount]);

  useEffect(() => {
    if (isSuccess) {
      balFrom.refetch?.();
      balTo.refetch?.();
      balWeth.refetch?.();
      if (touchesRouter) rA();
      if (touchesRouter && exists) rQuote();
      if (lastAction.current === "swap" && routeType === "sellViaWeth")
        setPendingUnwrap(true);
      if (lastAction.current === "unwrapRemainder") setPendingUnwrap(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  type Act = "wrap" | "unwrap" | "approve" | "unwrapRemainder" | "swap";
  const act: Act =
    routeType === "wrap"
      ? "wrap"
      : routeType === "unwrap"
      ? "unwrap"
      : needWrap
      ? "wrap"
      : needApprove
      ? "approve"
      : routeType === "sellViaWeth" && pendingUnwrap
      ? "unwrapRemainder"
      : "swap";

  const actionLabel =
    act === "wrap"
      ? `Wrap ${amount || "0"} ETH → WETH`
      : act === "unwrap"
      ? `Unwrap ${amount || "0"} WETH → ETH`
      : act === "approve"
      ? `Approve ${from.isNative ? "WETH" : from.symbol}`
      : act === "unwrapRemainder"
      ? "Unwrap WETH → ETH"
      : `Swap ${from.symbol} → ${to.symbol}`;

  function go() {
    lastAction.current = act;
    if (act === "wrap") {
      writeContract({
        address: WETH_TOKEN.address,
        abi: wethAbi,
        functionName: "deposit",
        value: amtIn,
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (act === "unwrap") {
      writeContract({
        address: WETH_TOKEN.address,
        abi: wethAbi,
        functionName: "withdraw",
        args: [amtIn],
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (act === "unwrapRemainder") {
      writeContract({
        address: WETH_TOKEN.address,
        abi: wethAbi,
        functionName: "withdraw",
        args: [balWeth.raw ?? 0n],
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (act === "approve") {
      writeContract({
        address: swapTokenIn as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [UNI_ROUTER, amtIn * 100n],
        chainId: baseSepolia.id,
      });
    } else {
      writeContract({
        address: UNI_ROUTER,
        abi: routerAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: swapTokenIn as Address,
            tokenOut: swapTokenOut as Address,
            fee: FEE_TIER,
            recipient: address!,
            amountIn: amtIn,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
        chainId: baseSepolia.id,
        gas: 500_000n,
        value: 0n,
      });
    }
  }

  const swapPairMissing = touchesRouter && !exists;
  const outputDisplay =
    routeType === "wrap" || routeType === "unwrap"
      ? amount || "0.0"
      : quoteLoading
      ? "…fetching quote"
      : quotedOut !== undefined
      ? Number(formatUnits(quotedOut, to.decimals)).toFixed(6)
      : swapPairMissing
      ? "—"
      : "0.0";

  return (
    <div className="card space-y-4">
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--line)",
        }}
      >
        <div className="flex justify-between mb-2">
          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
            From: {from.symbol}
          </span>
          {balFrom.formatted && (
            <button
              onClick={() => setAmount(balFrom.formatted!)}
              className="text-xs"
              style={{ color: "var(--accent-light)" }}
            >
              Max: {Number(balFrom.formatted).toFixed(4)}
            </button>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
            {from.symbol}
          </span>
        </div>
      </div>

      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--line)",
        }}
      >
        <p className="text-xs mb-2" style={{ color: "var(--ink-dim)" }}>
          To: {to.symbol}{" "}
          {(routeType === "buyViaWeth" || routeType === "sellViaWeth") &&
            "(via WETH)"}
        </p>
        <p className="text-2xl font-medium" style={{ color: "var(--ink)" }}>
          {outputDisplay}
        </p>
      </div>

      {(routeType === "wrap" || routeType === "unwrap") && (
        <div
          className="text-xs p-2 rounded-lg"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-light)",
          }}
        >
          ℹ️ {routeType === "wrap" ? "Wrapping" : "Unwrapping"} is 1:1, no fees,
          no pool required.
        </div>
      )}
      {(routeType === "buyViaWeth" || routeType === "sellViaWeth") && (
        <div
          className="text-xs p-2 rounded-lg"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-light)",
          }}
        >
          ℹ️ Routes through WETH — you may need to confirm 2–3 transactions.
        </div>
      )}
      {swapPairMissing && (
        <div
          className="text-xs p-2 rounded-lg"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-light)",
          }}
        >
          ⚠️ No pool for this pair yet — add liquidity first.
        </div>
      )}

      {isConnected ? (
        <button
          onClick={go}
          disabled={isPending || !amount || amount === "0" || swapPairMissing}
          className="btn-primary"
        >
          {isPending ? "⏳ Confirm…" : actionLabel}
        </button>
      ) : (
        <p className="text-sm text-center" style={{ color: "var(--ink-dim)" }}>
          Connect wallet to continue
        </p>
      )}

      {hash && (
        <div
          className="text-sm text-center py-2 rounded-lg"
          style={{
            background: isSuccess ? "var(--green-dim)" : "var(--accent-dim)",
            color: isSuccess ? "var(--green)" : "var(--accent-light)",
          }}
        >
          {isSuccess
            ? `✅ ${actionLabel} confirmed!`
            : `⏳ Waiting for ${actionLabel}…`}{" "}
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
