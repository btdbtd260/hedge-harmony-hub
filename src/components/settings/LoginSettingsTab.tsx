import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type ApprovedEmail = { id: string; email: string; is_admin: boolean };
type ApprovedDomain = { id: string; domain: string };
type AppSettings = { id: string; require_login: boolean; google_signin_enabled: boolean };

const emailSchema = z.string().trim().email().max(255);
const domainSchema = z.string().trim().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domaine invalide").max(255);

export const LoginSettingsTab = () => {
  const [emails, setEmails] = useState<ApprovedEmail[]>([]);
  const [domains, setDomains] = useState<ApprovedDomain[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailAdmin, setNewEmailAdmin] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  const refresh = async () => {
    const [e, d, s] = await Promise.all([
      supabase.from("approved_emails").select("*").order("email"),
      supabase.from("approved_domains").select("*").order("domain"),
      supabase.from("app_settings").select("*").limit(1).maybeSingle(),
    ]);
    if (e.data) setEmails(e.data as ApprovedEmail[]);
    if (d.data) setDomains(d.data as ApprovedDomain[]);
    if (s.data) setSettings(s.data as AppSettings);
  };

  useEffect(() => { refresh(); }, []);

  const addEmail = async () => {
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) { toast.error("Email invalide"); return; }
    const { error } = await supabase.from("approved_emails").insert({ email: parsed.data.toLowerCase(), is_admin: newEmailAdmin });
    if (error) { toast.error(error.message); return; }
    setNewEmail(""); setNewEmailAdmin(false); refresh(); toast.success("Email ajouté");
  };

  const removeEmail = async (id: string) => {
    const { error } = await supabase.from("approved_emails").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const addDomain = async () => {
    const parsed = domainSchema.safeParse(newDomain);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const { error } = await supabase.from("approved_domains").insert({ domain: parsed.data.toLowerCase() });
    if (error) { toast.error(error.message); return; }
    setNewDomain(""); refresh(); toast.success("Domaine ajouté");
  };

  const removeDomain = async (id: string) => {
    const { error } = await supabase.from("approved_domains").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const updateSetting = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const { error } = await supabase.from("app_settings").update(patch).eq("id", settings.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Préférences de connexion</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Exiger la connexion</Label><p className="text-xs text-muted-foreground">Tout l'application est protégée.</p></div>
            <Switch checked={settings?.require_login ?? true} onCheckedChange={(v) => updateSetting({ require_login: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Connexion Google</Label><p className="text-xs text-muted-foreground">Activer Sign in with Google.</p></div>
            <Switch checked={settings?.google_signin_enabled ?? true} onCheckedChange={(v) => updateSetting({ google_signin_enabled: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Emails approuvés</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Email</Label>
              <Input placeholder="utilisateur@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={newEmailAdmin} onCheckedChange={setNewEmailAdmin} />
              <Label className="text-xs">Admin</Label>
            </div>
            <Button onClick={addEmail}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {emails.length === 0 && <p className="text-sm text-muted-foreground">Aucun email approuvé.</p>}
            {emails.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{e.email}</span>
                  {e.is_admin && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Admin</span>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeEmail(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Domaines approuvés (optionnel)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Domaine</Label>
              <Input placeholder="exemple.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
            </div>
            <Button onClick={addDomain}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {domains.length === 0 && <p className="text-sm text-muted-foreground">Aucun domaine approuvé.</p>}
            {domains.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">@{d.domain}</span>
                <Button variant="ghost" size="icon" onClick={() => removeDomain(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
