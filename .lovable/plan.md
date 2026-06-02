# Plan : Générer `import-data-ntyuyupbvsilnedjwgmv.sql`

## Objectif
Produire un seul fichier SQL téléchargeable contenant tous les `INSERT ... ON CONFLICT (id) DO UPDATE` pour réimporter les 16 tables non-vides déjà exportées dans `/mnt/documents/export-ntyuyupbvsilnedjwgmv/tables/*.json`.

Aucune modification : base de données, repo, ou nouveau Supabase intacts.

## Approche

1. **Source** : lire les 18 JSON existants dans `/mnt/documents/export-ntyuyupbvsilnedjwgmv/tables/`. Ignorer `messages` et `reminders` (0 lignes).

2. **Script Python local** (`/tmp`, jamais commité) qui :
   - Pour chaque table dans l'ordre, lit le JSON.
   - Génère `INSERT INTO public.<table> (col1, ...) VALUES (...), (...) ON CONFLICT (id) DO UPDATE SET col1 = EXCLUDED.col1, ... ;`
   - Sérialisation par type :
     - `null` → `NULL`
     - `text`/`uuid`/`date`/`timestamptz` → littéral quoté avec `''` échappés
     - `boolean` → `TRUE`/`FALSE`
     - `numeric`/`integer` → littéral numérique
     - `jsonb` → `'<json>'::jsonb`
     - `text[]` → `ARRAY['a','b']::text[]` (ou `'{}'::text[]` si vide)
   - Batch ~500 lignes par `INSERT` pour lisibilité.
   - En-tête par section : `-- ===== TABLE: <name> (<n> rows) =====`.

3. **Ordre des INSERT** (FK logiques) :
   ```
   1.  parameters
   2.  app_settings
   3.  approved_domains
   4.  approved_emails
   5.  blocked_numbers
   6.  email_send_state
   7.  customers
   8.  employees
   9.  user_roles
   10. estimation_requests
   11. estimations            (→ customers)
   12. jobs                   (→ customers, estimations)
   13. invoices               (→ jobs, customers)
   14. employee_jobs          (→ employees, jobs)
   15. expenses
   16. email_send_log
   ```
   Exclus (0 lignes) : `messages`, `reminders`.

4. **En-tête du fichier SQL** (pas de désactivation de triggers) :
   ```sql
   -- Export from ntyuyupbvsilnedjwgmv — 188 rows across 16 tables
   -- Generated <UTC timestamp>
   --
   -- Cible : nouveau projet Supabase, APRÈS application des migrations
   -- existantes (tables, types, fonctions, RLS, buckets).
   --
   -- Idempotent : INSERT ... ON CONFLICT (id) DO UPDATE sur chaque table.
   -- Safe à réexécuter.
   --
   -- ATTENTION : les triggers ne sont PAS désactivés pendant l'import.
   -- Certains triggers (trg_recalc_on_jobs, trg_recalc_on_employee_jobs,
   -- trg_recalc_on_invoices, trg_publish_invoice_on_completion, set_updated_at)
   -- peuvent recalculer ou écraser certaines colonnes :
   --   • employee_jobs.calculated_pay (recalculé via recalc_job_pays)
   --   • invoices.status ('draft' → 'unpaid' si job devient 'completed')
   --   • colonnes updated_at (mises à now())
   -- Vérifier après import :
   --   1. SELECT COUNT(*) par table vs row counts attendus (voir _row_counts.txt).
   --   2. Spot-check sur jobs/invoices/employee_jobs pour cohérence financière.
   --   3. Si écart, relancer recalc_job_pays(job_id) manuellement sur les jobs concernés.

   BEGIN;
   -- INSERTs ici (16 tables, ordre ci-dessus)
   COMMIT;
   ```

5. **Cas `email_send_state`** : PK = `id integer` (toujours `1`). `ON CONFLICT (id) DO UPDATE` OK.

6. **Sortie** : un seul fichier
   ```
   /mnt/documents/import-data-ntyuyupbvsilnedjwgmv.sql
   ```
   livré via `<presentation-artifact path="import-data-ntyuyupbvsilnedjwgmv.sql" mime_type="application/sql">`.

## Limites assumées

- **Schéma non inclus** — appliquer les migrations existantes (`supabase/migrations/`) sur le nouveau projet d'abord.
- **`auth.users` non inclus** — `user_roles.user_id` référence des UUID Auth qui n'existent pas tant que les utilisateurs ne se sont pas (re)connectés.
- **Fichiers Storage** (logo, photos avant/après) non inclus — à copier séparément depuis `company-assets`.

## Livraison

Après approbation, en mode build :
1. Exécution du script Python sur les JSON existants.
2. Vérification taille fichier + nombre de lignes par table.
3. Chemin exact + balise `presentation-artifact` pour téléchargement.
