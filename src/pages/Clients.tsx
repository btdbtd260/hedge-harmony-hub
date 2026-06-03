import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCustomers, useJobs, useInsertCustomer, useUpdateCustomer, useHideCustomer, useRestoreCustomer, useDeleteCustomerCascade, type DbCustomer } from "@/hooks/useSupabaseData";
import { AddressAutocomplete } from "@/components/clients/AddressAutocomplete";
import { Search, Eye, EyeOff, Plus, Trash2, RotateCcw, AlertTriangle, Pencil, Calculator, Users } from "lucide-react";
import { toast } from "sonner";
import { formatPhone, formatPhoneLive } from "@/lib/phoneFormat";
import { resolveBillingInfo } from "@/lib/billingInfo";
import type { BillingInfo } from "@/types";

// Technical archive customer used to preserve Finance history.
// Hidden from every list — never editable from the UI.
const ARCHIVE_CUSTOMER_ID = "00000000-0000-0000-0000-0000000d3137";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  next_year: "bg-purple-100 text-purple-700",
};

const Clients = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: customers = [] } = useCustomers();
  const { data: jobs = [] } = useJobs();
  const insertCustomer = useInsertCustomer();
  const updateCustomer = useUpdateCustomer();
  const hideCustomer = useHideCustomer();
  const restoreCustomer = useRestoreCustomer();
  const deleteCustomerCascade = useDeleteCustomerCascade();

  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selectedClient, setSelectedClient] = useState<DbCustomer | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formBillingName, setFormBillingName] = useState("");
  const [formBillingCommercialName, setFormBillingCommercialName] = useState("");
  const [formBillingAddress, setFormBillingAddress] = useState("");
  const [formBillingPhone, setFormBillingPhone] = useState("");
  const [formBillingEmail, setFormBillingEmail] = useState("");
  const [formBillingTaxId, setFormBillingTaxId] = useState("");
  const [clientToDelete, setClientToDelete] = useState<DbCustomer | null>(null);
  const [clientToPurge, setClientToPurge] = useState<DbCustomer | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [clientToEdit, setClientToEdit] = useState<DbCustomer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editBillingName, setEditBillingName] = useState("");
  const [editBillingCommercialName, setEditBillingCommercialName] = useState("");
  const [editBillingAddress, setEditBillingAddress] = useState("");
  const [editBillingPhone, setEditBillingPhone] = useState("");
  const [editBillingEmail, setEditBillingEmail] = useState("");
  const [editBillingTaxId, setEditBillingTaxId] = useState("");

  const filtered = customers
    // Always hide the technical archive customer used to preserve Finance history
    .filter((c) => c.id !== ARCHIVE_CUSTOMER_ID)
    .filter((c) => showHidden || !c.hidden)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase()));

  // Set of client IDs that have at least one job scheduled or completed.
  // These are "real" active clients. Anyone else with no such job is
  // considered "estimation-only" and shown in the dedicated tab.
  const realClientIds = useMemo(() => {
    const ids = new Set<string>();
    jobs.forEach((j) => {
      if (j.status === "scheduled" || j.status === "completed") ids.add(j.client_id);
    });
    return ids;
  }, [jobs]);

  const isEstimationOnly = (c: DbCustomer) => !realClientIds.has(c.id);

  const currentYear = filtered.filter((c) => c.status !== "next_year" && !isEstimationOnly(c));
  const estimationOnly = filtered.filter((c) => c.status !== "next_year" && isEstimationOnly(c));
  const nextYear = filtered.filter((c) => c.status === "next_year");

  const buildBillingInfo = (name: string, commercial_name: string, address: string, phone: string, email: string, tax_id: string): BillingInfo => ({
    name,
    commercial_name,
    address,
    phone,
    email,
    tax_id,
  });

  const handleAdd = async () => {
    if (!formName.trim()) return;
    try {
      const billingInfo = buildBillingInfo(formBillingName.trim(), formBillingCommercialName.trim(), formBillingAddress.trim(), formBillingPhone.trim(), formBillingEmail.trim(), formBillingTaxId.trim());
      await insertCustomer.mutateAsync({ name: formName.trim(), phone: formPhone.trim(), email: formEmail.trim(), address: formAddress.trim(), billing_info: billingInfo });
      setShowAddDialog(false);
      setFormName(""); setFormPhone(""); setFormEmail(""); setFormAddress(""); setFormCity("");
      setFormBillingName(""); setFormBillingCommercialName(""); setFormBillingAddress(""); setFormBillingPhone(""); setFormBillingEmail(""); setFormBillingTaxId("");
      toast.success("Client créé");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleHideClient = async () => {
    if (!clientToDelete) return;
    try {
      await hideCustomer.mutateAsync(clientToDelete.id);
      setClientToDelete(null);
      setSelectedClient(null);
      toast.success("Client masqué");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRestoreClient = async (client: DbCustomer) => {
    try {
      await restoreCustomer.mutateAsync(client.id);
      toast.success("Client restauré");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handlePurgeClient = async () => {
    if (!clientToPurge) return;
    try {
      await deleteCustomerCascade.mutateAsync(clientToPurge.id);
      setClientToPurge(null);
      setPurgeConfirmText("");
      setSelectedClient(null);
      toast.success("Client supprimé définitivement");
    } catch (e: any) {
      toast.error(e.message ?? "Échec de la suppression");
    }
  };

  const openEditDialog = (client: DbCustomer) => {
    setEditName(client.name ?? "");
    setEditPhone(formatPhone(client.phone ?? ""));
    setEditEmail(client.email ?? "");
    setEditAddress(client.address ?? "");
    setEditCity(client.ville ?? "");

    // Pre-fill billing info from existing billing_info or fall back to customer fields
    const resolved = resolveBillingInfo({
      name: client.name ?? "",
      address: client.address ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      billing_info: client.billing_info as BillingInfo | null | undefined,
    });
    setEditBillingName(resolved.name);
    setEditBillingCommercialName(resolved.commercial_name ?? "");
    setEditBillingAddress(resolved.address);
    setEditBillingPhone(resolved.phone);
    setEditBillingEmail(resolved.email);
    setEditBillingTaxId(resolved.tax_id);

    setClientToEdit(client);
  };

  const handleSaveEdit = async () => {
    if (!clientToEdit || !editName.trim()) return;
    try {
      const billingInfo = buildBillingInfo(editBillingName.trim(), editBillingCommercialName.trim(), editBillingAddress.trim(), editBillingPhone.trim(), editBillingEmail.trim(), editBillingTaxId.trim());
      await updateCustomer.mutateAsync({
        id: clientToEdit.id,
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        billing_info: billingInfo,
      });
      setClientToEdit(null);
      toast.success("Client mis à jour");
    } catch (e: any) {
      toast.error(e.message ?? "Échec de la mise à jour");
    }
  };

  const clientJobs = selectedClient ? jobs.filter((j) => j.client_id === selectedClient.id) : [];

  // Keep selectedClient in sync with fresh data
  const liveSelectedClient = selectedClient ? customers.find((c) => c.id === selectedClient.id) ?? selectedClient : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Gérez votre liste de clients</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un client…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? <><EyeOff className="h-4 w-4 mr-1" /> Masquer</> : <><Eye className="h-4 w-4 mr-1" /> Voir masqués</>}
        </Button>
      </div>

      {/* Tabs : vrais clients (au moins 1 job scheduled/completed) vs estimation seulement */}
      <Tabs value={location.pathname === "/clients/estimation" ? "estimation" : "clients"} onValueChange={(val) => navigate(val === "estimation" ? "/clients/estimation" : "/clients", { replace: true })}>
        <TabsList>
          <TabsTrigger value="clients">
            <Users className="h-4 w-4 mr-1" /> Clients ({currentYear.length})
          </TabsTrigger>
          <TabsTrigger value="estimation">
            <Calculator className="h-4 w-4 mr-1" /> Estimation ({estimationOnly.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <CollapsibleCard title={`Clients actifs (${currentYear.length})`}>
            {currentYear.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun client avec une job planifiée ou complétée.</p>
            ) : currentYear.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedClient(c)}>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.address}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(c.phone)} · {c.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{jobs.filter((j) => j.client_id === c.id).length} job(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColor[c.status]}>{c.status}</Badge>
                  {c.hidden && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleRestoreClient(c); }}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CollapsibleCard>
        </TabsContent>

        <TabsContent value="estimation" className="mt-4">
          <CollapsibleCard title={`Estimation seulement (${estimationOnly.length})`}>
            {estimationOnly.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune estimation en attente.</p>
            ) : estimationOnly.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedClient(c)}>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.address}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(c.phone)} · {c.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {jobs.filter((j) => j.client_id === c.id).length} estimation/job pending
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-muted">Estimation</Badge>
                  {c.hidden && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleRestoreClient(c); }}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CollapsibleCard>
        </TabsContent>
      </Tabs>

      {nextYear.length > 0 && (
        <CollapsibleCard title={`Année prochaine (${nextYear.length})`}>
          {nextYear.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedClient(c)}>
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.address}</p>
              </div>
              <Badge className={statusColor.next_year}>année prochaine</Badge>
            </div>
          ))}
        </CollapsibleCard>
      )}

      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent>
          {liveSelectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {liveSelectedClient.name}
                  {liveSelectedClient.hidden && <Badge variant="outline" className="text-xs bg-muted">Masqué</Badge>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Téléphone</span><span>{formatPhone(liveSelectedClient.phone)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Email</span><span>{liveSelectedClient.email}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Adresse</span><span>{liveSelectedClient.address}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Statut</span><Badge className={statusColor[liveSelectedClient.status]}>{liveSelectedClient.status}</Badge></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Année active</span><span>{liveSelectedClient.active_year}</span></div>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Historique des jobs ({clientJobs.length})</p>
                  {clientJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun job.</p>
                  ) : clientJobs.map((j) => (
                    <div key={j.id} className="flex justify-between text-sm p-2 rounded border mb-1">
                      <span>{j.cut_type} · {j.scheduled_date}</span>
                      <div className="flex items-center gap-2">
                        <span>${j.estimated_profit}</span>
                        <Badge className={`text-xs ${statusColor[j.status] || ""}`}>{j.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {liveSelectedClient.billing_info && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Facturation</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nom</span>
                        <span>{(liveSelectedClient.billing_info as BillingInfo).name}</span>
                      </div>
                      {(liveSelectedClient.billing_info as BillingInfo).commercial_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nom commercial</span>
                          <span>{(liveSelectedClient.billing_info as BillingInfo).commercial_name}</span>
                        </div>
                      )}
                      {(liveSelectedClient.billing_info as BillingInfo).address && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Adresse</span>
                          <span>{(liveSelectedClient.billing_info as BillingInfo).address}</span>
                        </div>
                      )}
                      {(liveSelectedClient.billing_info as BillingInfo).phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Téléphone</span>
                          <span>{(liveSelectedClient.billing_info as BillingInfo).phone}</span>
                        </div>
                      )}
                      {(liveSelectedClient.billing_info as BillingInfo).email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Courriel</span>
                          <span>{(liveSelectedClient.billing_info as BillingInfo).email}</span>
                        </div>
                      )}
                      {(liveSelectedClient.billing_info as BillingInfo).tax_id && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">N° de taxes</span>
                          <span>{(liveSelectedClient.billing_info as BillingInfo).tax_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="border-t pt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(liveSelectedClient)}>
                    <Pencil className="h-4 w-4 mr-1" /> Modifier
                  </Button>
                  {!liveSelectedClient.hidden ? (
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setClientToDelete(liveSelectedClient)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Masquer ce client
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleRestoreClient(liveSelectedClient)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restaurer ce client
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setPurgeConfirmText(""); setClientToPurge(liveSelectedClient); }}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" /> Supprimer définitivement
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nom complet" /></div>
            <div className="space-y-1"><Label>Téléphone</Label><Input value={formPhone} onChange={(e) => setFormPhone(formatPhoneLive(e.target.value))} placeholder="514-555-0000" inputMode="tel" maxLength={12} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemple.com" /></div>
            <div className="space-y-1"><Label>Adresse</Label><AddressAutocomplete value={formAddress} onChange={setFormAddress} onSelect={(addr) => setFormCity(addr.ville)} placeholder="123 Rue Exemple" /></div>
            <div className="space-y-1"><Label>Ville</Label><Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Ville" /></div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Informations de facturation</p>
              <div className="space-y-2">
                <div className="space-y-1"><Label>Nom de facturation</Label><Input value={formBillingName} onChange={(e) => setFormBillingName(e.target.value)} placeholder="Nom de l'entreprise" /></div>
                <div className="space-y-1"><Label>Nom commercial</Label><Input value={formBillingCommercialName} onChange={(e) => setFormBillingCommercialName(e.target.value)} placeholder="Nom commercial" /></div>
                <div className="space-y-1"><Label>Adresse de facturation</Label><Input value={formBillingAddress} onChange={(e) => setFormBillingAddress(e.target.value)} placeholder="Adresse de facturation" /></div>
                <div className="space-y-1"><Label>Téléphone de facturation</Label><Input value={formBillingPhone} onChange={(e) => setFormBillingPhone(formatPhoneLive(e.target.value))} placeholder="514-555-0000" inputMode="tel" maxLength={12} /></div>
                <div className="space-y-1"><Label>Courriel de facturation</Label><Input value={formBillingEmail} onChange={(e) => setFormBillingEmail(e.target.value)} placeholder="factures@exemple.com" /></div>
                <div className="space-y-1"><Label>N° de taxes (TPS/TVQ)</Label><Input value={formBillingTaxId} onChange={(e) => setFormBillingTaxId(e.target.value)} placeholder="FR12345678901" /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!formName.trim() || insertCustomer.isPending}>{insertCustomer.isPending ? "Création…" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!clientToEdit} onOpenChange={(open) => !open && setClientToEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom complet" /></div>
            <div className="space-y-1"><Label>Téléphone</Label><Input value={editPhone} onChange={(e) => setEditPhone(formatPhoneLive(e.target.value))} placeholder="514-555-0000" inputMode="tel" maxLength={12} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemple.com" /></div>
            <div className="space-y-1"><Label>Adresse</Label><AddressAutocomplete value={editAddress} onChange={setEditAddress} onSelect={(addr) => setEditCity(addr.ville)} placeholder="123 Rue Exemple" /></div>
            <div className="space-y-1"><Label>Ville</Label><Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Ville" /></div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Informations de facturation</p>
              <div className="space-y-2">
                <div className="space-y-1"><Label>Nom de facturation</Label><Input value={editBillingName} onChange={(e) => setEditBillingName(e.target.value)} placeholder="Nom de l'entreprise" /></div>
                <div className="space-y-1"><Label>Nom commercial</Label><Input value={editBillingCommercialName} onChange={(e) => setEditBillingCommercialName(e.target.value)} placeholder="Nom commercial" /></div>
                <div className="space-y-1"><Label>Adresse de facturation</Label><Input value={editBillingAddress} onChange={(e) => setEditBillingAddress(e.target.value)} placeholder="Adresse de facturation" /></div>
                <div className="space-y-1"><Label>Téléphone de facturation</Label><Input value={editBillingPhone} onChange={(e) => setEditBillingPhone(formatPhoneLive(e.target.value))} placeholder="514-555-0000" inputMode="tel" maxLength={12} /></div>
                <div className="space-y-1"><Label>Courriel de facturation</Label><Input value={editBillingEmail} onChange={(e) => setEditBillingEmail(e.target.value)} placeholder="factures@exemple.com" /></div>
                <div className="space-y-1"><Label>N° de taxes (TPS/TVQ)</Label><Input value={editBillingTaxId} onChange={(e) => setEditBillingTaxId(e.target.value)} placeholder="FR12345678901" /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientToEdit(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || updateCustomer.isPending}>{updateCustomer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Masquer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le client <strong>{clientToDelete?.name}</strong> sera masqué de la liste. Vous pourrez toujours le retrouver via « Voir masqués ». Cette action ne supprime aucune donnée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleHideClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Masquer le client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!clientToPurge}
        onOpenChange={(open) => { if (!open) { setClientToPurge(null); setPurgeConfirmText(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Supprimer définitivement ce client ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Cette action va <strong>supprimer définitivement</strong> le client{" "}
                  <strong>{clientToPurge?.name}</strong> ainsi que toutes les données reliées :
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>les jobs (passés non payés et à venir)</li>
                  <li>les estimations</li>
                  <li>les factures non payées</li>
                  <li>les éléments du calendrier (rappels, demandes, messages)</li>
                </ul>
                <p className="text-foreground">
                  ✅ Les <strong>profits dans Finance</strong> sont conservés : les factures déjà payées
                  sont archivées sous « Client supprimé » pour préserver l'historique financier.
                </p>
                <p>
                  Pour confirmer, tape <strong>SUPPRIMER</strong> ci-dessous.
                </p>
                <Input
                  autoFocus
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurgeClient}
              disabled={purgeConfirmText !== "SUPPRIMER" || deleteCustomerCascade.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCustomerCascade.isPending ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;