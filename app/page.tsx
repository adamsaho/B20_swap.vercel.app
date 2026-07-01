"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import {
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  type Address,
  zeroAddress,
} from "viem";
import { baseSepolia } from "wagmi/chains";
import {
  ZEEME_ADDRESS,
  WETH_ADDRESS,
  UNI_FACTORY,
  UNI_ROUTER,
  UNI_NFT_PM,
  FEE_TIER,
  erc20Abi,
  wethAbi,
  factoryAbi,
  poolAbi,
  nftPmAbi,
  routerAbi,
  sqrtPriceX96ForPrice,
  MIN_TICK,
  MAX_TICK,
} from "@/lib/contracts";

type Tab = "pool" | "liquidity" | "swap";

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [tab, setTab] = useState<Tab>("pool");

  return (
    <div className="min-h-screen flex flex-col">
      <header style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
              ZEEME SWAP
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
      </header>

      <main className="flex-1 flex flex-col items-center pt-10 px-4 pb-16">
        <div className="w-full max-w-[480px] space-y-4">
          <div className="text-center pb-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              ZEEME ↔ ETH
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
              Powered by Uniswap V3 · Base Sepolia
            </p>
          </div>

          {/* Tab bar */}
          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
            }}
          >
            {(
              [
                ["pool", "1. Create Pool"],
                ["liquidity", "2. Add Liquidity"],
                ["swap", "3. Swap"],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 text-sm font-semibold py-2 rounded-lg transition-all"
                style={{
                  background: tab === t ? "var(--accent-dim)" : "transparent",
                  color: tab === t ? "var(--accent-light)" : "var(--ink-dim)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "pool" && (
            <CreatePool address={address} isConnected={isConnected} />
          )}
          {tab === "liquidity" && (
            <AddLiquidity address={address} isConnected={isConnected} />
          )}
          {tab === "swap" && (
            <Swap address={address} isConnected={isConnected} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Shared ── */
function TxStatus({ hash, label }: { hash?: `0x${string}`; label: string }) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (!hash) return null;
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

function usePoolAddress() {
  return useReadContract({
    address: UNI_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [ZEEME_ADDRESS, WETH_ADDRESS, FEE_TIER],
    chainId: baseSepolia.id,
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
        : "○ No pool yet — create one in Step 1"}
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

/* ── Step 1 ── */
function CreatePool({
  address,
  isConnected,
}: {
  address?: Address;
  isConnected: boolean;
}) {
  const { data: poolAddr, refetch } = usePoolAddress();
  const exists = poolAddr && poolAddr !== zeroAddress;
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess]);

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-bold text-lg" style={{ color: "var(--ink)" }}>
          Step 1 — Create Pool
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
          Create a ZEEME/WETH pool on Uniswap V3 (0.3% fee). Only needs to be
          done once.
        </p>
      </div>
      <PoolBadge addr={poolAddr} />
      <div
        className="rounded-xl p-4 space-y-2 text-sm"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--line)",
        }}
      >
        <Row k="Pair" v="ZEEME / WETH" />
        <Row k="Fee" v="0.3%" />
        <Row k="Network" v="Base Sepolia" />
        <Row k="DEX" v="Uniswap V3" />
      </div>
      {exists ? (
        <div
          className="text-sm text-center py-2 rounded-lg font-semibold"
          style={{ background: "var(--green-dim)", color: "var(--green)" }}
        >
          ✓ Pool exists — proceed to Step 2
        </div>
      ) : !isConnected ? (
        <p className="text-sm text-center" style={{ color: "var(--ink-dim)" }}>
          Connect wallet to continue
        </p>
      ) : (
        <button
          onClick={() =>
            writeContract({
              address: UNI_FACTORY,
              abi: factoryAbi,
              functionName: "createPool",
              args: [ZEEME_ADDRESS, WETH_ADDRESS, FEE_TIER],
              chainId: baseSepolia.id,
              gas: 3_000_000n,
            })
          }
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? "⏳ Confirm in wallet…" : "Create ZEEME/WETH Pool"}
        </button>
      )}
      <TxStatus hash={hash} label="Pool created" />
      {error && (
        <p className="text-xs" style={{ color: "var(--error)" }}>
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}

/* ── Step 2 ── */
// The pool is always ZEEME/WETH under the hood — but the user can fund the
// non-ZEEME side either with native ETH (auto-wrapped) or with WETH they
// already hold (no wrap step needed).
type PairToken = "ETH" | "WETH";

function AddLiquidity({
  address,
  isConnected,
}: {
  address?: Address;
  isConnected: boolean;
}) {
  const { data: poolAddr } = usePoolAddress();
  const exists = poolAddr && poolAddr !== zeroAddress;
  const [zeeme, setZeeme] = useState("100");
  const [pairToken, setPairToken] = useState<PairToken>("ETH");
  const [pairAmount, setPairAmount] = useState("0.001");
  const [price, setPrice] = useState("10000");
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const { data: slot0 } = useReadContract({
    address: poolAddr as Address,
    abi: poolAbi,
    functionName: "slot0",
    query: { enabled: !!exists },
  });
  const isInit = slot0 && slot0[0] > 0n;
  const { data: zeemeBal } = useReadContract({
    address: ZEEME_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: ethBal } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: !!address },
  });
  const { data: wethBal, refetch: rWeth } = useReadContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const zeemeWei = parseUnits(zeeme || "0", 18);
  const pairWei = parseUnits(pairAmount || "0", 18); // same math for ETH or WETH, both 18 decimals
  const { data: zA, refetch: rZA } = useReadContract({
    address: ZEEME_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, UNI_NFT_PM] : undefined,
    query: { enabled: !!address },
  });
  const { data: wA, refetch: rWA } = useReadContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, UNI_NFT_PM] : undefined,
    query: { enabled: !!address },
  });
  useEffect(() => {
    if (isSuccess) {
      rWeth();
      rZA();
      rWA();
    }
  }, [isSuccess]);

  // Only need to wrap if the user chose ETH and doesn't already have enough WETH
  const needWrap = pairToken === "ETH" && (wethBal ?? 0n) < pairWei;
  const needZA = (zA ?? 0n) < zeemeWei;
  const needWA = (wA ?? 0n) < pairWei;
  const act = !isInit
    ? "init"
    : needWrap
    ? "wrap"
    : needZA
    ? "approveZ"
    : needWA
    ? "approveW"
    : "add";
  const labels: Record<string, string> = {
    init: "Initialize Pool Price",
    wrap: `Wrap ${pairAmount} ETH → WETH`,
    approveZ: "Approve ZEEME",
    approveW: "Approve WETH",
    add: "Add Liquidity",
  };

  function go() {
    if (act === "init") {
      writeContract({
        address: poolAddr as Address,
        abi: poolAbi,
        functionName: "initialize",
        args: [sqrtPriceX96ForPrice(Number(price))],
        chainId: baseSepolia.id,
        gas: 500_000n,
      });
    } else if (act === "wrap") {
      writeContract({
        address: WETH_ADDRESS,
        abi: wethAbi,
        functionName: "deposit",
        value: pairWei,
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (act === "approveZ") {
      writeContract({
        address: ZEEME_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [UNI_NFT_PM, zeemeWei * 100n],
        chainId: baseSepolia.id,
      });
    } else if (act === "approveW") {
      writeContract({
        address: WETH_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [UNI_NFT_PM, pairWei * 100n],
        chainId: baseSepolia.id,
      });
    } else {
      const [t0, t1, a0, a1] =
        ZEEME_ADDRESS.toLowerCase() < WETH_ADDRESS.toLowerCase()
          ? [ZEEME_ADDRESS, WETH_ADDRESS, zeemeWei, pairWei]
          : [WETH_ADDRESS, ZEEME_ADDRESS, pairWei, zeemeWei];
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

  if (!exists)
    return (
      <div
        className="card text-center text-sm"
        style={{ color: "var(--ink-dim)" }}
      >
        Create the pool first (Step 1)
      </div>
    );

  const pairBalance =
    pairToken === "ETH"
      ? ethBal
        ? formatEther(ethBal.value)
        : undefined
      : wethBal !== undefined
      ? formatUnits(wethBal, 18)
      : undefined;

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-bold text-lg" style={{ color: "var(--ink)" }}>
          Step 2 — Add Liquidity
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
          Deposit ZEEME + ETH/WETH to create the market. You'll earn 0.3% fees
          on every swap. The pool is always ZEEME/WETH — choose below whether to
          fund it with native ETH (auto-wrapped) or WETH you already hold.
        </p>
      </div>
      <PoolBadge addr={poolAddr} />
      {!isInit && (
        <div>
          <label
            className="block text-xs mb-1.5"
            style={{ color: "var(--ink-dim)" }}
          >
            Initial price: ZEEME per 1 ETH
          </label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-box"
            placeholder="10000"
          />
          <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
            e.g. 10000 means 1 ETH = 10,000 ZEEME
          </p>
        </div>
      )}

      {/* Pair-token toggle */}
      <div>
        <label
          className="block text-xs mb-1.5"
          style={{ color: "var(--ink-dim)" }}
        >
          Fund the other side with
        </label>
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--line)",
          }}
        >
          {(["ETH", "WETH"] as PairToken[]).map((t) => (
            <button
              key={t}
              onClick={() => setPairToken(t)}
              className="flex-1 text-sm font-semibold py-1.5 rounded-lg transition-all"
              style={{
                background:
                  pairToken === t ? "var(--accent-dim)" : "transparent",
                color:
                  pairToken === t ? "var(--accent-light)" : "var(--ink-dim)",
              }}
            >
              {t === "ETH" ? "ETH (auto-wrap)" : "WETH (direct)"}
            </button>
          ))}
        </div>
      </div>

      <AmountRow
        label="ZEEME to deposit"
        value={zeeme}
        onChange={setZeeme}
        balance={zeemeBal !== undefined ? formatUnits(zeemeBal, 18) : undefined}
        symbol="ZEEME"
      />
      <div className="text-center text-xs" style={{ color: "var(--ink-dim)" }}>
        +
      </div>
      <AmountRow
        label={
          pairToken === "ETH"
            ? "ETH to deposit (wraps to WETH)"
            : "WETH to deposit"
        }
        value={pairAmount}
        onChange={setPairAmount}
        balance={pairBalance}
        symbol={pairToken}
      />

      <div className="space-y-1.5 text-xs">
        {[
          ["Initialize price", !!isInit],
          ...(pairToken === "ETH"
            ? ([["Wrap ETH → WETH", !needWrap]] as [string, boolean][])
            : []),
          ["Approve ZEEME", !needZA],
          ["Approve WETH", !needWA],
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
        <p className="text-sm text-center" style={{ color: "var(--ink-dim)" }}>
          Connect wallet first
        </p>
      )}
      <TxStatus hash={hash} label={labels[act]} />
      {error && (
        <p className="text-xs break-words" style={{ color: "var(--error)" }}>
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}

/* ── Step 3: Swap (ETH⇄WETH wrap/unwrap + WETH⇄ZEEME router swap) ── */

type TokenSym = "ETH" | "WETH" | "ZEEME";

// WETH is the hub: ETH only connects to WETH, ZEEME only connects to WETH.
const TOKEN_GRAPH: Record<TokenSym, TokenSym[]> = {
  ETH: ["WETH"],
  WETH: ["ETH", "ZEEME"],
  ZEEME: ["WETH"],
};

function tokenAddress(t: TokenSym): Address | undefined {
  if (t === "WETH") return WETH_ADDRESS;
  if (t === "ZEEME") return ZEEME_ADDRESS;
  return undefined; // ETH is native, no contract address
}

function Swap({
  address,
  isConnected,
}: {
  address?: Address;
  isConnected: boolean;
}) {
  const { data: poolAddr } = usePoolAddress();
  const exists = poolAddr && poolAddr !== zeroAddress;

  const [from, setFrom] = useState<TokenSym>("ETH");
  const [to, setTo] = useState<TokenSym>("WETH");
  const [amount, setAmount] = useState("0.001");

  // Keep "to" valid whenever "from" changes
  useEffect(() => {
    const opts = TOKEN_GRAPH[from];
    if (!opts.includes(to)) setTo(opts[0]);
  }, [from]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: zeemeBal, refetch: rZ } = useReadContract({
    address: ZEEME_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: wethBal, refetch: rW } = useReadContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: ethBal, refetch: rE } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: !!address },
  });

  const actionType: "wrap" | "unwrap" | "swap" =
    from === "ETH" && to === "WETH"
      ? "wrap"
      : from === "WETH" && to === "ETH"
      ? "unwrap"
      : "swap";

  const tokenIn = tokenAddress(from); // undefined for ETH
  const tokenOut = tokenAddress(to);
  const amtIn = parseUnits(amount || "0", 18); // all tokens here are 18 decimals

  // Only relevant for the 'swap' action (WETH <-> ZEEME through the router)
  const { data: allow, refetch: rA } = useReadContract({
    address: tokenIn as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && tokenIn ? [address, UNI_ROUTER] : undefined,
    query: { enabled: !!address && actionType === "swap" },
  });
  const needApprove = actionType === "swap" && (allow ?? 0n) < amtIn;

  useEffect(() => {
    if (isSuccess) {
      rZ();
      rW();
      rE();
      if (actionType === "swap") rA();
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const balanceOf = (t: TokenSym) =>
    t === "ETH"
      ? ethBal
        ? formatEther(ethBal.value)
        : undefined
      : t === "WETH"
      ? wethBal !== undefined
        ? formatUnits(wethBal, 18)
        : undefined
      : zeemeBal !== undefined
      ? formatUnits(zeemeBal, 18)
      : undefined;

  const actionLabel =
    actionType === "wrap"
      ? `Wrap ${amount || "0"} ETH → WETH`
      : actionType === "unwrap"
      ? `Unwrap ${amount || "0"} WETH → ETH`
      : needApprove
      ? `Approve ${from}`
      : `Swap ${from} → ${to}`;

  function go() {
    if (actionType === "wrap") {
      writeContract({
        address: WETH_ADDRESS,
        abi: wethAbi,
        functionName: "deposit",
        value: amtIn,
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (actionType === "unwrap") {
      writeContract({
        address: WETH_ADDRESS,
        abi: wethAbi,
        functionName: "withdraw",
        args: [amtIn],
        chainId: baseSepolia.id,
        gas: 100_000n,
      });
    } else if (needApprove) {
      writeContract({
        address: tokenIn as Address,
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
            tokenIn: tokenIn as Address,
            tokenOut: tokenOut as Address,
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

  function flip() {
    const oldFrom = from;
    setFrom(to);
    setTo(oldFrom);
  }

  const swapPairMissing = actionType === "swap" && !exists;

  return (
    <div className="card space-y-4">
      <h2 className="font-bold text-lg" style={{ color: "var(--ink)" }}>
        Swap
      </h2>
      <PoolBadge addr={poolAddr} />

      {/* From / To token pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="block text-xs mb-1.5"
            style={{ color: "var(--ink-dim)" }}
          >
            From
          </label>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as TokenSym)}
            className="input-box"
            style={{ width: "100%" }}
          >
            {(Object.keys(TOKEN_GRAPH) as TokenSym[]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-xs mb-1.5"
            style={{ color: "var(--ink-dim)" }}
          >
            To
          </label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value as TokenSym)}
            className="input-box"
            style={{ width: "100%" }}
          >
            {TOKEN_GRAPH[from].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AmountRow
        label={`From: ${from}`}
        value={amount}
        onChange={setAmount}
        balance={balanceOf(from)}
        symbol={from}
      />

      <div className="flex justify-center">
        <button
          onClick={flip}
          className="w-10 h-10 rounded-xl text-lg flex items-center justify-center"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--line)",
            color: "var(--ink-dim)",
          }}
        >
          ↕
        </button>
      </div>

      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--line)",
        }}
      >
        <p className="text-xs mb-2" style={{ color: "var(--ink-dim)" }}>
          To: {to}
        </p>
        <p className="text-2xl font-medium" style={{ color: "var(--ink-dim)" }}>
          {actionType === "swap" ? "~ (market price)" : amount || "0.0"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        {(["ETH", "WETH", "ZEEME"] as TokenSym[]).map((t) => (
          <div
            key={t}
            className="rounded-lg px-3 py-2"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--line)",
            }}
          >
            <p style={{ color: "var(--ink-dim)" }}>{t}</p>
            <p
              className="font-mono font-medium"
              style={{ color: "var(--ink)" }}
            >
              {balanceOf(t) !== undefined
                ? Number(balanceOf(t)).toFixed(t === "ZEEME" ? 2 : 4)
                : "—"}
            </p>
          </div>
        ))}
      </div>

      {actionType === "wrap" && (
        <div
          className="text-xs p-2 rounded-lg"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-light)",
          }}
        >
          ℹ️ Wrapping is 1:1, no fees, no pool required.
        </div>
      )}
      {actionType === "unwrap" && (
        <div
          className="text-xs p-2 rounded-lg"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-light)",
          }}
        >
          ℹ️ Unwrapping is 1:1, no fees, no pool required.
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
          ⚠️ No ZEEME/WETH pool yet — complete Step 1 and Step 2 first.
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

      <TxStatus hash={hash} label={actionLabel} />
      {error && (
        <p className="text-xs break-words" style={{ color: "var(--error)" }}>
          {error.message.split("\n")[0]}
        </p>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--ink-dim)" }}>{k}</span>
      <span style={{ color: "var(--ink)" }}>{v}</span>
    </div>
  );
}
