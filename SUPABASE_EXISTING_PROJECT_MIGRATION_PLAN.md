# Plan de Migration Supabase — Projet Existant

> **Étape 1/4 — Migrations NON destructives uniquement**
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
```

---

## Procédure de rollback

Si une migration cause des problèmes :

```sql
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

## Prochaines étapes (hors scope de cette étape 1)

Une fois cette étape 1 complétée et validée, les étapes suivantes pourront être envisagées :

- [ ] Étape 2: Appliquer les politiques RLS sécurisées
- [ ] Étape 3: Appliquer les triggers et les contraintes
- [ ] Étape 4: Configurer les buckets de stockage et leurs politiques
- [ ] Étape 5: Déployer et configurer les Edge Functions
- [ ] Final: Mettre à jour le frontend pour utiliser les nouvelles fonctionnalités

---

## Références

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Supabase Migration Guide](https://supabase.com/docs/guides/local-development/overview#database-migrations)
