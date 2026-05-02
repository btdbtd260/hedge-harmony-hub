## Objectif

Configurer la zone DNS de `tailledehaieacf.ca` chez **Web Host Canada (cPanel)** pour vérifier le sous-domaine `notify.tailledehaieacf.ca`, puis activer l'envoi de courriels Lovable et tester un envoi réel.

---

## Étape 1 — Se connecter à Web Host Canada

1. Aller sur https://whc.ca → **Espace Client (Client Area)**.
2. Menu **Domaines → Mes domaines**, puis cliquer sur `tailledehaieacf.ca`.
3. Ouvrir l'onglet **Gestion DNS** (ou **Zone Editor** dans cPanel si le domaine pointe vers un hébergement WHC).

> Si tu utilises **cPanel** : Tableau de bord → section **Domaines** → **Zone Editor** → bouton **Manage** à côté de `tailledehaieacf.ca`.

---

## Étape 2 — Ajouter les 3 enregistrements DNS

Dans la zone DNS, ajouter exactement ces 3 entrées (rien d'autre, ne touche à aucun autre enregistrement existant du domaine principal) :

### Enregistrement 1 — TXT (vérification)
```text
Type  : TXT
Nom   : _lovable-email.notify
TTL   : 3600 (ou Auto)
Valeur: lovable_email_verify=b997afbd8b3c84f1e88cb6cdb4158ee0...
```
> ⚠️ Copie la valeur **complète** depuis Cloud → Emails → Manage Domains (le bouton copier à droite de la ligne TXT).

### Enregistrement 2 — NS (délégation #1)
```text
Type  : NS
Nom   : notify
TTL   : 3600 (ou Auto)
Valeur: ns3.lovable.cloud
```

### Enregistrement 3 — NS (délégation #2)
```text
Type  : NS
Nom   : notify
TTL   : 3600 (ou Auto)
Valeur: ns4.lovable.cloud
```

---

## Particularités Web Host Canada

- Le champ **Nom** doit contenir uniquement `notify` (et `_lovable-email.notify` pour le TXT). WHC ajoute automatiquement `.tailledehaieacf.ca` à la fin.
- Si l'interface ajoute déjà le domaine en suffixe et affiche `notify.tailledehaieacf.ca` en gris, c'est correct — n'écris pas le domaine deux fois.
- **Supprime tout enregistrement existant** sur `notify` (A, CNAME, MX, NS) avant d'ajouter les nouveaux.
- WHC bloque parfois l'ajout de NS sur un sous-domaine via Zone Editor → si c'est le cas, ouvre un ticket support WHC en demandant : *"Please add NS records for the subdomain `notify.tailledehaieacf.ca` pointing to `ns3.lovable.cloud` and `ns4.lovable.cloud`."* (réponse en quelques heures).
- Ne modifie **jamais** les NS du domaine racine (`tailledehaieacf.ca`) — uniquement le sous-domaine `notify`.

---

## Étape 3 — Activer les courriels du projet

Une fois les 3 enregistrements sauvegardés chez WHC, je vais :

1. Activer Lovable Emails sur le projet (actuellement désactivé — c'est la cause directe du message *"Emails disabled for this project"* dans les logs).
2. Vérifier le statut de propagation DNS via l'outil de vérification.
3. Confirmer que la file d'attente courriel reprend normalement.

---

## Étape 4 — Test d'envoi

Quand le statut passe à **Active** (15 min à 2 h en général chez WHC, jusqu'à 72 h dans le pire cas) :

1. Aller dans **Estimations → Historique**.
2. Cliquer **Envoyer par courriel** sur une estimation existante vers `btdbtd260@gmail.com`.
3. Vérifier la réception (inbox + spam) avec le bouton *Télécharger l'estimation (PDF)*.
4. Si rien n'arrive après 5 min, je consulte `email_send_log` pour diagnostiquer.

---

## Ce que je vais exécuter (côté Lovable)

| # | Action | Outil |
|---|--------|-------|
| 1 | Activer l'envoi de courriels du projet | `toggle_project_emails(enabled: true)` |
| 2 | Re-vérifier le statut du domaine | `check_email_domain_status` |
| 3 | Surveiller les logs après ton premier envoi test | `read_query` sur `email_send_log` |

Aucune modification de code n'est nécessaire — l'infrastructure courriel, les templates, le PDF en pièce jointe (lien signé) et l'UI sont déjà en place et fonctionnels. Le seul blocage est DNS + activation projet.

---

## Critères de réussite

- Les 3 enregistrements DNS sont visibles avec un outil comme https://dnschecker.org (chercher `notify.tailledehaieacf.ca` type NS).
- Le statut dans Cloud → Emails passe de **Pending** à **Active**.
- Un envoi test depuis l'app génère une ligne `sent` (et non `failed`) dans `email_send_log`.
- Le client reçoit le courriel avec le bouton de téléchargement PDF fonctionnel.
