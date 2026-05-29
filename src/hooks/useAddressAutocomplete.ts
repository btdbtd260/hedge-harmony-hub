import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Dedicated Supabase URL for the address-autocomplete edge function.
 * This is different from the main app VITE_SUPABASE_URL.
 */
export const ADDRESS_AUTOCOMPLETE_SUPABASE_URL =
  "https://atipsraxpxbjbecjobuv.supabase.co";

export interface AddressSuggestion {
  adresse_complete: string;
  ville: string;
  code_postal: string;
  distance_km: number;
  latitude: number;
  longitude: number;
}

export interface GetAddressAutocompleteUrlOptions {
  /** Override for testability — defaults to import.meta.env.DEV */
  isDev?: boolean;
  /**
   * Override for testability — defaults to ADDRESS_AUTOCOMPLETE_SUPABASE_URL.
   * Does NOT use the main app VITE_SUPABASE_URL.
   */
  supabaseUrl?: string;
}

/**
 * Build the full address-autocomplete URL for the given query and max results.
 *
 * - DEV:  /api/address-autocomplete?q=...&max=...
 * - PROD: {ADDRESS_AUTOCOMPLETE_SUPABASE_URL}/functions/v1/address-autocomplete?q=...&max=...
 *
 * The production URL uses the dedicated autocomplete Supabase project
 * (ADDRESS_AUTOCOMPLETE_SUPABASE_URL), NOT the main app VITE_SUPABASE_URL.
 *
 * Accepts optional options hash for testability (isDev / supabaseUrl overrides).
 */
export function getAddressAutocompleteUrl(
  query: string,
  max: number = 10,
  options: GetAddressAutocompleteUrlOptions = {},
): string {
  const isDev = options.isDev ?? import.meta.env.DEV;
  const supabaseUrl = options.supabaseUrl ?? ADDRESS_AUTOCOMPLETE_SUPABASE_URL;

  if (!isDev && !supabaseUrl) {
    throw new Error(
      "Supabase URL is not configured: set VITE_SUPABASE_URL or provide supabaseUrl option",
    );
  }

  const base = isDev
    ? "/api/address-autocomplete"
    : `${supabaseUrl}/functions/v1/address-autocomplete`;

  const params = new URLSearchParams({ q: query, max: String(max) });
  return `${base}?${params.toString()}`;
}

interface UseAddressAutocompleteOptions {
  debounceMs?: number;
  minChars?: number;
  maxResults?: number;
}

interface UseAddressAutocompleteReturn {
  suggestions: AddressSuggestion[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
  clear: () => void;
}

export function useAddressAutocomplete(
  options: UseAddressAutocompleteOptions = {},
): UseAddressAutocompleteReturn {
  const { debounceMs = 200, minChars = 2, maxResults = 10 } = options;

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setSuggestions([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      const trimmed = query.trim();

      if (trimmed.length < minChars) {
        setSuggestions([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      debounceRef.current = setTimeout(async () => {
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const url = getAddressAutocompleteUrl(trimmed, maxResults);

          const response = await fetch(url, {
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
          });

          if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status}`);
          }

          const data = await response.json();
          setSuggestions(data.suggestions ?? []);
          setError(null);
        } catch (err: any) {
          if (err.name === "AbortError") return;
          setError(err.message ?? "Erreur de recherche");
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs, minChars, maxResults],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { suggestions, isLoading, error, search, clear };
}
