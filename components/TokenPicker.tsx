"use client";

import { useState } from "react";
import type { Address } from "viem";
import type { TokenInfo } from "@/lib/tokens";
import AddTokenInput from "./AddTokenInput";

export default function TokenPicker({
  label,
  tokens,
  customTokens,
  value,
  onChange,
  exclude,
  onAddToken,
  onRemoveToken,
}: {
  label: string;
  tokens: TokenInfo[];
  customTokens: TokenInfo[];
  value: string;
  onChange: (symbol: string) => void;
  exclude?: string;
  onAddToken: (t: TokenInfo) => void;
  onRemoveToken: (address: Address) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const options = tokens.filter((t) => t.symbol !== exclude);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {label}
        </label>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="text-xs font-semibold"
          style={{ color: "var(--accent-light)" }}
        >
          {showAdd ? "Close" : "+ Add token"}
        </button>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-box"
        style={{ width: "100%" }}
      >
        {options.map((t) => (
          <option key={t.address + t.symbol} value={t.symbol}>
            {t.symbol} — {t.name}
          </option>
        ))}
      </select>

      {showAdd && (
        <div
          className="mt-2 p-3 rounded-lg space-y-3"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--line)",
          }}
        >
          <AddTokenInput
            existing={tokens}
            onAdd={(t) => {
              onAddToken(t);
              onChange(t.symbol);
              setShowAdd(false);
            }}
          />
          {customTokens.length > 0 && (
            <div
              className="space-y-1 pt-2"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
                Your added tokens
              </p>
              {customTokens.map((t) => (
                <div
                  key={t.address}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md"
                  style={{ background: "var(--bg-card)" }}
                >
                  <span style={{ color: "var(--ink)" }}>
                    {t.symbol}{" "}
                    <span
                      className="font-mono"
                      style={{ color: "var(--ink-dim)" }}
                    >
                      {t.address.slice(0, 6)}…{t.address.slice(-4)}
                    </span>
                  </span>
                  <button
                    onClick={() => onRemoveToken(t.address)}
                    style={{ color: "var(--error)" }}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
