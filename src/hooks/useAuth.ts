import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!userId) { setIsAdmin(false); setChecking(false); return; }
    setChecking(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => { setIsAdmin(!!data); setChecking(false); });
  }, [userId]);
  return { isAdmin, checking };
}

export function useApprovalStatus(userId: string | undefined) {
  const [approved, setApproved] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) { setApproved(null); return; }
    // A simple probe: try to read parameters (RLS allows only approved users)
    supabase.from("parameters").select("id").limit(1).then(({ data, error }) => {
      setApproved(!error && Array.isArray(data));
    });
  }, [userId]);
  return approved;
}
