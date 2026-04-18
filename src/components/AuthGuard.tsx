import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) { setApproved(null); return; }
    setApproved(null);
    supabase.from("parameters").select("id").limit(1).then(({ error, data }) => {
      setApproved(!error && Array.isArray(data));
    });
  }, [session?.user?.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  if (approved === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Vérification de l'accès…</div>;
  }
  if (!approved) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
};
