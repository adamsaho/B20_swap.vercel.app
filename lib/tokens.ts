import type { Address } from "viem";
import { WETH_ADDRESS } from "./contracts";

export type TokenInfo = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  isNative?: boolean;
};

export const TOKEN_LIST: TokenInfo[] = [
  {
    symbol: "ZEEME",
    name: "Zeemee",
    address: "0xB200000000000000000000C85708B096DD4D6fbA" as Address,
    decimals: 18,
  },
];

// ── Native pseudo-token (ETH) ──────────────────────────────────────────────
export const NATIVE_ETH: TokenInfo = {
  symbol: "ETH",
  name: "Ether",
  address: "0x0000000000000000000000000000000000000000" as Address,
  decimals: 18,
  isNative: true,
};

export const WETH_TOKEN: TokenInfo = {
  symbol: "WETH",
  name: "Wrapped Ether",
  address: WETH_ADDRESS,
  decimals: 18,
};

// Only ETH + WETH ship by default. Every other token -- ZEEME included -- gets
// added at runtime by pasting its contract address (see useTokenList / AddTokenInput).
export const BASE_TOKENS: TokenInfo[] = [NATIVE_ETH, WETH_TOKEN];

export function tokenBySymbol(
  list: TokenInfo[],
  sym: string
): TokenInfo | undefined {
  return list.find((t) => t.symbol === sym);
}

export function tokenByAddress(
  list: TokenInfo[],
  addr?: Address
): TokenInfo | undefined {
  if (!addr) return undefined;
  return list.find((t) => t.address.toLowerCase() === addr.toLowerCase());
}

/** For pool lookups, ETH is always represented by WETH on-chain. */
export function onchainToken(t: TokenInfo): TokenInfo {
  return t.isNative ? WETH_TOKEN : t;
}

/** All unique unordered pairs of non-native tokens in the list (for "browse pools"). */
export function allPairs(list: TokenInfo[]): [TokenInfo, TokenInfo][] {
  const chainTokens = list.filter((t) => !t.isNative);
  const pairs: [TokenInfo, TokenInfo][] = [];
  for (let i = 0; i < chainTokens.length; i++) {
    for (let j = i + 1; j < chainTokens.length; j++) {
      pairs.push([chainTokens[i], chainTokens[j]]);
    }
  }
  return pairs;
}
