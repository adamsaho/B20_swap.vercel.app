"use client";

import { useState } from "react";
import { useReadContracts } from "wagmi";
import { isAddress, type Address } from "viem";
import { baseSepolia } from "wagmi/chains";
import { erc20Abi } from "@/lib/contracts";
import type { TokenInfo } from "@/lib/tokens";

const nameAbi = [
  ...erc20Abi,
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export default function AddTokenInput({
  onAdd,
  existing,
}: {
  onAdd: (t: TokenInfo) => void;
  existing: TokenInfo[];
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const valid = isAddress(input);
  const alreadyAdded =
    valid &&
    existing.some((t) => t.address.toLowerCase() === input.toLowerCase());

  const { refetch } = useReadContracts({
    contracts: valid
      ? [
          {
            address: input as Address,
            abi: nameAbi,
            functionName: "symbol",
            chainId: baseSepolia.id,
          },
          {
            address: input as Address,
            abi: nameAbi,
            functionName: "name",
            chainId: baseSepolia.id,
          },
          {
            address: input as Address,
            abi: nameAbi,
            functionName: "decimals",
            chainId: baseSepolia.id,
          },
        ]
      : [],
    query: { enabled: false },
  });

  async function handleAdd() {
    setError(null);
    if (!valid) {
      setError("Not a valid contract address");
      return;
    }
    if (alreadyAdded) {
      setError("Token already added");
      return;
    }
    setFetching(true);
    try {
      const res = await refetch();
      const symbol = res.data?.[0]?.result as string | undefined;
      const name = res.data?.[1]?.result as string | undefined;
      const decimals = res.data?.[2]?.result as number | undefined;
      if (!symbol || decimals === undefined) {
        setError(
          "Couldn't read this as an ERC20 token on Base Sepolia — check the address"
        );
        return;
      }
      onAdd({
        symbol,
        name: name ?? symbol,
        address: input as Address,
        decimals,
      });
      setInput("");
    } catch {
      setError("Failed to fetch token info — check the address and network");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs" style={{ color: "var(--ink-dim)" }}>
        Add any B20 / ERC20 token by contract address
      </label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.trim())}
          placeholder="0x…"
          className="input-box flex-1"
          style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
        />
        <button
          onClick={handleAdd}
          disabled={!valid || fetching || alreadyAdded}
          className="text-sm font-semibold px-4 rounded-lg shrink-0"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-light)",
            opacity: !valid || fetching || alreadyAdded ? 0.5 : 1,
          }}
        >
          {fetching ? "…" : "Add"}
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
      {alreadyAdded && (
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          This token is already in your list.
        </p>
      )}
    </div>
  );
}
