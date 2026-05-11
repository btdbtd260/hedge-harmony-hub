import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

const Unauthorized = () => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
          <CardTitle>Accès non autorisé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Votre compte n'est pas approuvé pour accéder à cette application.
            Contactez l'administrateur si vous pensez que c'est une erreur.
          </p>
          <Button variant="outline" onClick={handleSignOut} className="w-full">
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unauthorized;
