import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatPhone } from "@/lib/phoneFormat";

export type DbBlockedNumber = Tables<"blocked_numbers">;

/** Conserve les 10 derniers chiffres — clef de comparaison côté serveur. */
export function normalizeForBlock(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\D+/g, "").slice(-10);
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
      if (phone_normalized.length < 10) {
        throw new Error("Numéro invalide (10 chiffres requis)");
      }
      const { data, error } = await supabase
        .from("blocked_numbers")
        .insert({
          phone: formatPhone(params.phone),
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
