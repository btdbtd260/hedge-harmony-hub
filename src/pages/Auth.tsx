import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Adresse courriel invalide" }).max(255);
const passwordSchema = z.string().min(8, { message: "Minimum 8 caractères" }).max(72);

const Auth = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/", { replace: true });
  }, [session, loading, navigate]);

  const handleGoogle = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) { toast.error("Erreur de connexion Google"); return; }
      if (result.redirected) return;
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de connexion");
    }
  };

  const validate = () => {
    const eR = emailSchema.safeParse(email);
    if (!eR.success) { toast.error(eR.error.issues[0].message); return false; }
    const pR = passwordSchema.safeParse(password);
    if (!pR.success) { toast.error(pR.error.issues[0].message); return false; }
    return true;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid")) {
        toast.error("Courriel ou mot de passe invalide");
      } else {
        toast.error(error.message);
      }
    }
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte créé. Connexion en cours…");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <p className="text-sm text-muted-foreground">Accès réservé aux membres autorisés</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGoogle} className="w-full" size="lg" variant="outline">
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuer avec Google
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs text-muted-foreground">
              ou avec courriel (Outlook, Hotmail, etc.)
            </span>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label htmlFor="email-in">Courriel</Label>
                <Input id="email-in" type="email" autoComplete="email" placeholder="vous@exemple.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-in">Mot de passe</Label>
                <Input id="pw-in" type="password" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button onClick={handleSignIn} disabled={submitting} className="w-full">
                Se connecter
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label htmlFor="email-up">Courriel</Label>
                <Input id="email-up" type="email" autoComplete="email" placeholder="vous@outlook.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-up">Mot de passe</Label>
                <Input id="pw-up" type="password" autoComplete="new-password" placeholder="Minimum 8 caractères"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button onClick={handleSignUp} disabled={submitting} className="w-full">
                Créer un compte
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Votre courriel doit être pré-approuvé par un administrateur.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
