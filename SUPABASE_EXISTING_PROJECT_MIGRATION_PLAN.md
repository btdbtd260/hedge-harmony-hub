# Plan de Migration Supabase — Projet Existant

> **Étape 2/4 — Migrations NON destructives uniquement**
>
> Ce plan décrit l'ordre exact d'application des migrations pour un projet Supabase
> existant. Aucune commande destructive (DROP, DELETE, TRUNCATE) n'est incluse.

---

## Ordre d'application

Les migrations **doivent** être appliquées dans cet ordre, car certaines dépendent
d'objets créés par les précédentes.

| # | Fichier | Dépendances | Description |
|---|---------|-------------|-------------|
| 1 | `20260531000001_safe_extensions.sql` | Aucune | Active les extensions PostgreSQL requises |
| 2 | `20260531000002_safe_app_role_enum.sql` | #1 (pgcrypto) | Crée le type ENUM `app_role` |
| 3 | `20260531000003_safe_utility_functions.sql` | #2 (app_role) | Crée les fonctions utilitaires |
| 4 | `20260531000004_safe_missing_columns.sql` | Aucune | Ajoute les colonnes manquantes |
| 5 | `20260531000005_safe_storage_buckets.sql` | Aucune | Crée les buckets de stockage (estimation-pdfs, message-media, estimation-request-photos, company-assets, job-photos) |
| 6 | `20260531000006_safe_storage_policies.sql` | #5 (buckets) | Crée les politiques RLS pour storage.objects |
| 7 | `20260531000007_safe_rls_enablement.sql` | Aucune | Active RLS sur toutes les tables |
| 8 | `20260531000008_safe_rls_policies.sql` | #7 (RLS), #3 (fonctions) | Crée les politiques RLS sur toutes les tables |

---

## Commandes (ne pas exécuter maintenant)

```bash
# 1. Option A — Appliquer avec Supabase CLI (recommandé)
#    Prévisualiser d'abord :
supabase db diff --linked

#    Puis appliquer :
supabase db push

# 2. Option B — Appliquer via le Tableau de Bord Supabase
#    Aller dans SQL Editor > New Query
#    Copier-coller le contenu de chaque fichier dans l'ordre ci-dessus
#    Exécuter un fichier à la fois

# 3. Option C — Appliquer via Supabase Management API
#    (nécessite un token d'accès personnel)
curl -X POST https://api.supabase.com/v1/projects/{PROJECT_REF}/sql \
  -H "Authorization: Bearer {SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "<contenu du fichier SQL>"}'
```

### AVERTISSEMENTS ⚠️

- **NE PAS** lancer `supabase db push` sans avoir d'abord vérifié le diff
- **NE PAS** exécuter de commandes DROP, DELETE ou TRUNCATE manuellement
- **NE PAS** modifier les fichiers de migration après les avoir appliqués
- **TOUJOURS** tester sur un environnement de développement/local d'abord
- **VALIDER** chaque migration avant de passer à la suivante

---

## Procédure de validation

Pour chaque migration, après l'avoir appliquée :

```sql
-- Vérifier les extensions (migration 1)
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- Vérifier le type enum (migration 2)
SELECT enum_range(NULL::public.app_role);

-- Vérifier les fonctions (migration 3)
SELECT proname, prolang, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('set_updated_at', 'is_email_approved', 'has_role', 'current_user_approved')
ORDER BY proname;

-- Vérifier les colonnes (migration 4)
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Vérifier les buckets de stockage (migration 5)
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('estimation-pdfs', 'message-media',
             'estimation-request-photos', 'company-assets',
             'job-photos')
ORDER BY name;

-- Vérifier les politiques storage (migration 6)
SELECT schemaname, tablename, policyname, permissive
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Vérifier RLS activé (migration 7)
SELECT relname, relrowsecurity
FROM pg_class
WHERE relrowsecurity = true
  AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- Vérifier les politiques RLS (migration 8)
SELECT schemaname, tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## Procédure de rollback

Si une migration cause des problèmes :

```sql
-- Migration 8: retirer les politiques RLS
-- ATTENTION: ne retirer que les politiques qui posent problème.
-- Les politiques de base sont requises pour le fonctionnement.
--
-- DROP POLICY IF EXISTS "Approved users full access" ON public.customers;
-- (adaptez pour chaque table concernée)

-- Migration 7: désactiver RLS (déconseillé — requiert re-création des politiques)
-- ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
-- (à faire pour chaque table si nécessaire)

-- Migration 6: retirer les politiques storage
-- DROP POLICY IF EXISTS "Allow read estimation-pdfs" ON storage.objects;
-- (adaptez pour chaque politique concernée)

-- Migration 5: supprimer les buckets (les données seront perdues)
-- ATTENTION: cela supprime TOUS les objets dans le bucket.
-- SELECT storage.delete_bucket('job-photos'); -- Exemple

-- Migration 4: retirer les colonnes ajoutées
-- ATTENTION: cela peut causer une perte de données si des colonnes
-- contiennent des données. À ne faire que si la migration 4 n'a pas
-- encore été commitée dans une transaction.
--
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS billing_info;
-- (décommentez et exécutez les DROP COLUMN nécessaires)

-- Migration 3: recréer les anciennes versions des fonctions
-- Utilisez CREATE OR REPLACE FUNCTION avec l'implémentation précédente.

-- Migration 2: impossible de DROP un type ENUM s'il est utilisé.
-- La création est idempotente, donc la réappliquer est sans risque.

-- Migration 1: ne pas désactiver les extensions — elles sont
-- requises par d'autres parties du système. Les répliquer est
-- sans risque grâce à IF NOT EXISTS.
```

---

## Prochaines étapes (hors scope de cette étape 2)

Une fois cette étape 2 complétée et validée, les étapes suivantes pourront être envisagées :

- [x] Étape 1: Migrations de base (extensions, enum, fonctions, colonnes)
- [x] Étape 2: Storage buckets + RLS policies (cette étape)
- [ ] Étape 3: Appliquer les triggers et les contraintes
- [ ] Étape 4: Déployer et configurer les Edge Functions
- [ ] Final: Mettre à jour le frontend pour utiliser les nouvelles fonctionnalités

---

## Références

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Supabase Migration Guide](https://supabase.com/docs/guides/local-development/overview#database-migrations)
