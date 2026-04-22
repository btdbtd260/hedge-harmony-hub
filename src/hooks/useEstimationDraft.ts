import { useEffect, useRef, useState } from "react";

/**
 * Persist a value to localStorage with a TTL (time-to-live).
 *
 * Behaviour:
 * - On mount, hydrates from localStorage if the saved snapshot is younger than `ttlMs`.
 * - If the snapshot is older than `ttlMs`, it is discarded (auto-reset) and the
 *   provided `initialValue` is used instead.
 * - Persists the current value on every change, with a fresh `savedAt` timestamp.
 *
 * Used by the Estimation page to keep an in-progress estimation alive when the
 * user navigates to another section, while resetting it after a period of inactivity.
 */
export function usePersistentDraft<T>(
  key: string,
  initialValue: T,
  ttlMs: number,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  // Hydrate synchronously from localStorage on first render so the UI never
  // flashes the empty initial value before the saved draft appears.
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
      if (
        !parsed ||
        typeof parsed.savedAt !== "number" ||
        Date.now() - parsed.savedAt > ttlMs
      ) {
        window.localStorage.removeItem(key);
        return initialValue;
      }
      return (parsed.value as T) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  // Skip persisting on the very first render to avoid overwriting a fresh
  // hydration with an identical payload (cheap, but also clearer intent).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({ savedAt: Date.now(), value }),
      );
    } catch {
      // localStorage may be full or unavailable (private mode) — fail silently.
    }
  }, [key, value, ttlMs]);

  const clear = () => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  };

  return [value, setValue, clear];
}
