"use client";

import { TOKEN_LIST, type TokenInfo } from "@/lib/tokens";

export default function TokenSelect({
  value,
  onChange,
  exclude,
}: {
  value: string;
  onChange: (symbol: string) => void;
  exclude?: string;
}) {
  const options = TOKEN_LIST.filter((t) => t.symbol !== exclude);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-box"
      style={{ width: "100%" }}
    >
      {options.map((t: TokenInfo) => (
        <option key={t.symbol} value={t.symbol}>
          {t.symbol} — {t.name}
        </option>
      ))}
    </select>
  );
}
