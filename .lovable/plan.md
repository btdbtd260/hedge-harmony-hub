# Plan : Export read-only de l'ancien Lovable Cloud (`ntyuyupbvsilnedjwgmv`)

## Objectif
Extraire les 18 tables `public.*` listées via `supabase--read_query` (SELECT uniquement) et produire des fichiers téléchargeables. Aucune écriture, aucun fichier de code modifié, le nouveau projet `atipsraxpxbjbecjobuv` n'est pas touché.

## Approche

1. **Compte de lignes préalable** — une seule requête `UNION ALL` qui retourne `table_name, row_count` pour les 18 tables. Permet d'afficher tout de suite le résumé et de détecter les tables vides ou inaccessibles.

2. **Export table par table** — pour chaque table, `SELECT * FROM public.<table> ORDER BY created_at NULLS LAST, id` (ou `ORDER BY id` si `created_at` absent — `employee_jobs`, `employees`, `user_roles` n'ont pas de `created_at` significatif, `email_send_state` a une seule ligne). Pagination par 1000 lignes via `LIMIT/OFFSET` si nécessaire (la limite par défaut de l'outil est 1000). Les types JSONB, `text[]` et `timestamptz` sont préservés tels quels dans le JSON.

3. **Écriture des fichiers** — deux formats par table, écrits dans `/mnt/documents/export-ntyuyupbvsilnedjwgmv/` :
   - `tables/<table>.json` — tableau JSON complet avec toutes les colonnes (format idéal pour réimport via Supabase JS ou script Node).
   - `tables/<table>.csv` — même contenu, colonnes sérialisées (JSONB/array stringifiés). Utile pour inspection / `COPY FROM` Postgres si besoin.
   - `_manifest.json` — résumé : table, row_count, fichiers générés, ordre d'import recommandé, erreurs éventuelles.
   - `_row_counts.txt` — résumé lisible.

4. **Ordre d'import recommandé** (ajouté au manifest, basé sur les FK logiques même s'il n'y a pas de contraintes FK déclarées) :
   ```
   1. parameters, app_settings, approved_domains, approved_emails, blocked_numbers,
      email_send_state, suppressed_emails (indépendants)
   2. customers, employees, user_roles, estimation_requests
   3. estimations           (→ customers)
   4. jobs                  (→ customers, estimations)
   5. invoices              (→ jobs, customers)
   6. employee_jobs         (→ employees, jobs)
   7. reminders             (→ customers via reference_id)
   8. messages              (→ customers)
   9. email_send_log, email_unsubscribe_tokens (journaux)
   ```

5. **Présentation finale** — chat affiche :
   - Tableau `table | lignes | statut` pour les 18 tables.
   - Liste des fichiers générés avec balises `<presentation-artifact>` pour téléchargement direct (manifest, row counts, plus chaque `.json` et `.csv`).
   - Note pour les tables où la RLS bloque l'`anon` (voir Limites).

## Limites à connaître (à confirmer avant de lancer)

L'outil `supabase--read_query` exécute les requêtes via l'API Data sous le rôle qui m'est attribué. Plusieurs tables sont protégées par RLS et seulement accessibles avec un rôle particulier :

- **Accessibles aux utilisateurs `authenticated` approuvés** (via `current_user_approved()` ou `has_role('admin')`) : `app_settings`, `approved_domains`, `approved_emails`, `blocked_numbers`, `customers`, `employee_jobs`, `employees`, `estimation_requests`, `estimations`, `expenses`, `invoices`, `jobs`, `messages`, `parameters`, `reminders`, `user_roles`.
- **Réservées au `service_role`** : `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`.

Si `supabase--read_query` tourne en `service_role` (ce qui est généralement le cas pour cet outil de debug), **toutes** les tables seront lisibles. Si jamais une table renvoie 0 ligne alors qu'elle ne devrait pas, ce sera noté comme « inaccessible (RLS) » dans le manifest plutôt que silencieusement vide.

## Ce qui n'est PAS inclus dans l'export

Pour rester strictement dans le périmètre demandé (read_query only) :

- **Schéma / DDL** (CREATE TABLE, RLS, triggers, fonctions) — non extrait. Pour réimporter, réutiliser les migrations existantes dans `supabase/migrations/`.
- **Auth users** (`auth.users`) — pas dans `public`, non listé dans la demande, et non accessible via l'API Data.
- **Storage** (buckets `company-assets`, `estimation-request-photos`, `message-media`, `estimation-pdfs`, `address-autocomplete`) — non accessible via SQL ; à exporter séparément depuis le backend dashboard si besoin.
- **Tables `email_unsubscribe_tokens` et `suppressed_emails`** — pas dans la liste demandée, donc ignorées.

## Détails techniques

```text
/mnt/documents/export-ntyuyupbvsilnedjwgmv/
├── _manifest.json
├── _row_counts.txt
└── tables/
    ├── app_settings.json + .csv
    ├── approved_domains.json + .csv
    ├── ...
    └── user_roles.json + .csv
```

Script Python local (dans `/tmp`, jamais commité) :
- Lit le JSON renvoyé par `supabase--read_query`.
- Sérialise CSV avec `csv.DictWriter` ; JSONB et `text[]` → `json.dumps(value)` pour rester reversible.
- Pagine si `count > 1000` (peu probable vu la taille du projet, mais robuste).

Après ton approbation, je passe en mode build et j'exécute. Aucune écriture sur la DB, aucune modification de fichier du repo.
