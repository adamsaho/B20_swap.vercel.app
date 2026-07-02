"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { BASE_TOKENS, type TokenInfo } from "./tokens";

const STORAGE_KEY = "defi-app:custom-tokens:base-sepolia:v1";

function loadCustomTokens(): TokenInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomTokens(tokens: TokenInfo[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

/**
 * Manages the token list for the whole app: the two base tokens (ETH, WETH)
 * plus any B20/ERC20 tokens the user has added by address. Persisted in
 * localStorage so tokens don't have to be re-added on every visit.
 */
export function useTokenList() {
  const [custom, setCustom] = useState<TokenInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCustom(loadCustomTokens());
    setLoaded(true);
  }, []);

  const addToken = useCallback((token: TokenInfo) => {
    setCustom((prev) => {
      if (
        prev.some(
          (t) => t.address.toLowerCase() === token.address.toLowerCase()
        )
      ) {
        return prev;
      }
      const next = [...prev, token];
      saveCustomTokens(next);
      return next;
    });
  }, []);

  const removeToken = useCallback((address: Address) => {
    setCustom((prev) => {
      const next = prev.filter(
        (t) => t.address.toLowerCase() !== address.toLowerCase()
      );
      saveCustomTokens(next);
      return next;
    });
  }, []);

  const tokens: TokenInfo[] = [...BASE_TOKENS, ...custom];

  return { tokens, custom, addToken, removeToken, loaded };
}
