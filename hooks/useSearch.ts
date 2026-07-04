"use client";

import { useState, useMemo, useCallback } from "react";
import { getTools } from "@/registry";
import type { Tool } from "@/types/tool";

export interface UseSearchReturn {
  query: string;
  results: Tool[];
  isSearching: boolean;
  setQuery: (q: string) => void;
  clearSearch: () => void;
}

export function useSearch(): UseSearchReturn {
  const [query, setQueryState] = useState("");

  const results = useMemo<Tool[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return getTools({ query: trimmed });
  }, [query]);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const clearSearch = useCallback(() => {
    setQueryState("");
  }, []);

  return {
    query,
    results,
    isSearching: query.trim().length > 0,
    setQuery,
    clearSearch,
  };
}
