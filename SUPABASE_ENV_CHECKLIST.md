# Checklist Environnement Supabase

> Liste de vérification pour configurer un environnement Supabase
> pour le projet Hedge Harmony Hub.

---

## 1. Fichier `.env`

Créer un fichier `.env` à la racine du projet avec les variables suivantes :

```env
# Obligatoire — URL du projet Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Obligatoire — Clé publique anon (publique, sans risque côté client)
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Important :** Ne jamais exposer la clé `service_role` (`SUPABASE_SERVICE_ROLE_KEY`)
> dans le frontend. Utiliser les Edge Functions pour les opérations privilégiées.

### Obtenir les valeurs

1. Aller dans [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner le projet
3. Aller dans **Settings** → **API**
4. Copier l'**URL du projet** et la **clé anon** (publique)

---

## 2. Configuration du projet Supabase

### Prérequis

- [ ] Un projet Supabase existe et est accessible
- [ ] Le projet est lié à l'instance locale (`supabase link --project-ref <ref>`)
- [ ] L'authentification est activée (Auth > Settings > enable)
- [ ] Les Email Templates sont configurés pour l'environnement

### Vérifications

```bash
# Vérifier la liaison du projet
supabase status

# Vérifier les services actifs
supabase services

# Lister les migrations déjà appliquées
# (via Supabase Table Editor > schema_migrations)
```

---

## 3. Extensions PostgreSQL requises

Après avoir appliqué la migration 1, vérifier :

```sql
SELECT extname, extversion FROM pg_extension ORDER BY extname;
```

Extensions attendues :

| Extension | Utilité |
|-----------|---------|
| `pgcrypto` | `gen_random_uuid()` pour les clés primaires |
| `pg_net` | Requêtes HTTP depuis les Edge Functions |
| `supabase_vault` | Stockage chiffré de secrets |
| `pgmq` | File d'attente de messages email |

> **Note :** `pg_cron` n'est pas inclus car il n'est pas disponible sur le plan Free tier.
> Le traitement automatique des emails sera géré ultérieurement via Edge Function ou
> planificateur externe.

---

## 4. Types ENUM

Après la migration 2, vérifier :

```sql
SELECT enum_range(NULL::public.app_role);
-- Résultat attendu : {admin,member}
```

---

## 5. Fonctions utilitaires

Après la migration 3, vérifier :

```sql
SELECT proname, prolang, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('set_updated_at', 'is_email_approved', 'has_role', 'current_user_approved')
ORDER BY proname;
```

Fonctions attendues :

| Fonction | Signature | Retour |
|----------|-----------|--------|
| `set_updated_at` | `()` | `trigger` |
| `is_email_approved` | `(_email text)` | `boolean` |
| `has_role` | `(_user_id uuid, _role app_role)` | `boolean` |
| `current_user_approved` | `()` | `boolean` |

---

## 6. Schéma de base de données

### Tables attendues (toutes dans le schema `public`)

- [ ] `app_settings` — Configuration globale de l'application
- [ ] `approved_domains` — Domaines email autorisés
- [ ] `approved_emails` — Emails autorisés
- [ ] `blocked_numbers` — Numéros de téléphone bloqués
- [ ] `customers` — Clients
- [ ] `email_send_log` — Journal d'envoi d'emails
- [ ] `email_send_state` — État et configuration des envois
- [ ] `email_unsubscribe_tokens` — Jetons de désabonnement
- [ ] `employee_jobs` — Assignation employés ↔ jobs
- [ ] `employees` — Employés
- [ ] `estimation_requests` — Demandes d'estimation entrantes
- [ ] `estimations` — Estimations
- [ ] `expenses` — Dépenses
- [ ] `invoices` — Factures
- [ ] `jobs` — Travaux
- [ ] `messages` — Messages SMS
- [ ] `parameters` — Paramètres de l'entreprise
- [ ] `reminders` — Rappels
- [ ] `suppressed_emails` — Emails supprimés (bounces, plaintes)
- [ ] `user_roles` — Rôles utilisateurs

### Colonnes vérifiées (migration 4)

- [ ] `customers.billing_info` (JSONB)
- [ ] `employees.is_admin` (boolean)
- [ ] `employee_jobs.is_present` (boolean)
- [ ] `jobs.tip` (numeric)
- [ ] `jobs.pauses` (jsonb)
- [ ] `jobs.total_pause_minutes` (integer)
- [ ] `jobs.estimated_duration_minutes` (integer)
- [ ] `jobs.duration_variance_minutes` (integer)
- [ ] `parameters.two_sides_multiplier` (numeric)
- [ ] `parameters.company_website` (text)
- [ ] `parameters.company_logo_url` (text)
- [ ] `parameters.price_per_foot_restoration` (numeric)
- [ ] `parameters.rounding_enabled` (boolean)
- [ ] `parameters.rounding_multiple` (integer)
- [ ] `estimations.back_left_length` (numeric)
- [ ] `estimations.back_right_length` (numeric)
- [ ] `estimations.height_back_left` (numeric)
- [ ] `estimations.height_back_right` (numeric)
- [ ] `estimation_requests.photos` (text[])
- [ ] `estimation_requests.seen_at` (timestamptz)

---

## 7. Vérification finale

```bash
# 1. Vérifier que toutes les migrations sont appliquées
#    (les fichiers SQL dans supabase/migrations/)

# 2. Lancer les tests du projet
npm test

# 3. Vérifier le fonctionnement de base
#    - L'application démarre sans erreur
#    - La connexion Supabase fonctionne
#    - Les requêtes de base retournent des résultats

# 4. Vérifier les migrations
#    Comparer le contenu de chaque fichier SQL avec l'état
#    actuel de la base de données via :
#    supabase db diff --linked
```

---

## Résolution de problèmes

| Problème | Solution |
|----------|----------|
| `relation "public.xxx" does not exist` | Vérifier que les tables de base ont été créées avant la migration 4 |
| `type "public.app_role" does not exist` | Vérifier que la migration 2 a été appliquée |
| `function public.has_role(uuid, app_role) does not exist` | Vérifier que la migration 3 a été appliquée |
| `column xxx does not exist` | Vérifier que la migration 4 a été appliquée |
| `Failed to fetch` dans le frontend | Vérifier `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `Auth session missing` | Vérifier la configuration Auth dans Supabase Dashboard |
