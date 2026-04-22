import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatPhone } from "@/lib/phoneFormat";

export type DbBlockedNumber = Tables<"blocked_numbers">;

/** Numéros protégés qui ne peuvent jamais être débloqués (urgences, frais associés). */
export const PROTECTED_BLOCKED_NUMBERS = new Set(["911"]);

export function isProtectedBlockedNumber(phone_normalized: string | null | undefined): boolean {
  if (!phone_normalized) return false;
  return PROTECTED_BLOCKED_NUMBERS.has(phone_normalized);
}

/**
 * Conserve les chiffres significatifs d'un numéro.
 * - Numéros courts (urgences, ex: 911) : on garde tel quel.
 * - Numéros nord-américains : on conserve les 10 derniers chiffres.
 */
export function normalizeForBlock(input: string | null | undefined): string {
  if (!input) return "";
  const digits = String(input).replace(/\D+/g, "");
  if (digits.length > 0 && digits.length <= 6) return digits; // numéros courts (911, etc.)
  return digits.slice(-10);
}

export function useBlockedNumbers() {
  return useQuery({
    queryKey: ["blocked_numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_numbers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DbBlockedNumber[];
    },
  });
}

export function useAddBlockedNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { phone: string; reason?: string }) => {
      const phone_normalized = normalizeForBlock(params.phone);
      const isShort = phone_normalized.length > 0 && phone_normalized.length <= 6;
      if (!isShort && phone_normalized.length < 10) {
        throw new Error("Numéro invalide (10 chiffres requis)");
      }
      const { data, error } = await supabase
        .from("blocked_numbers")
        .insert({
          phone: isShort ? phone_normalized : formatPhone(params.phone),
          phone_normalized,
          reason: params.reason ?? "",
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Ce numéro est déjà bloqué");
        throw error;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked_numbers"] }),
  });
}

export function useRemoveBlockedNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Garde-fou : on récupère la ligne pour vérifier qu'elle n'est pas protégée
      const { data: row, error: fetchErr } = await supabase
        .from("blocked_numbers")
        .select("phone_normalized")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (row && isProtectedBlockedNumber(row.phone_normalized)) {
        throw new Error("Ce numéro est protégé et ne peut pas être débloqué");
      }
      const { error } = await supabase.from("blocked_numbers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked_numbers"] }),
  });
}

/**
 * Hook utilitaire : retourne true si le numéro fourni est dans la liste de blocage.
 * Utilise la liste déjà chargée — pas de requête supplémentaire.
 */
export function useIsBlocked(phone: string | null | undefined): boolean {
  const { data = [] } = useBlockedNumbers();
  const norm = normalizeForBlock(phone);
  if (!norm) return false;
  return data.some((b) => b.phone_normalized === norm);
}
