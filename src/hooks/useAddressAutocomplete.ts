import { useState, useEffect, useRef, useCallback } from "react";

export interface AddressSuggestion {
  adresse_complete: string;
  ville: string;
  code_postal: string;
  distance_km: number;
  latitude: number;
  longitude: number;
}

const EDGE_FUNCTION_URL = import.meta.env.DEV
  ? "/api/address-autocomplete"
  : import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/address-autocomplete`
    : "/functions/v1/address-autocomplete";

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
          const params = new URLSearchParams({
            q: trimmed,
            max: String(maxResults),
          });

          const response = await fetch(
            `${EDGE_FUNCTION_URL}?${params.toString()}`,
            {
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
            },
          );

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
