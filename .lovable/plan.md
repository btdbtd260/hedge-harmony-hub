# Gains employés : compter uniquement les jobs complétées

## Problème

Actuellement, dès qu'un employé est assigné à une job (peu importe son statut) et que des heures sont saisies, le `calculated_pay` est généré par le trigger DB et **immédiatement additionné** dans :

- `src/pages/Employees.tsx` — carte "Paie totale" par employé
- `src/components/employees/EmployeeProfileDialog.tsx` — totaux "Été en cours", "Total à vie", et liste détaillée

Résultat : un employé voit son total gonflé par des jobs `pending`/`scheduled` qui ne sont pas encore terminées (et qui pourraient être annulées ou modifiées).

Note : `src/pages/Finance.tsx` filtre déjà correctement avec `job.status !== "completed"` (ligne 69). Aucun changement à faire côté Finance.

## Approche

Créer un petit helper réutilisable qui ne garde que les `employee_jobs` dont la job liée est `completed`, puis l'utiliser dans Employees + EmployeeProfileDialog. Ajouter l'invalidation manquante de la cache `employee_jobs` quand on change le statut d'une job.

### 1. Nouveau hook utilitaire — `src/hooks/useCompletedEmployeeJobs.ts`

Petit hook qui combine `useEmployeeJobs()` + `useJobs()` et retourne uniquement les `ej` dont `job.status === "completed"`. Mémorisé. Réutilisé dans Employees et EmployeeProfileDialog. Garde la logique au même endroit, pas de duplication.

### 2. `src/pages/Employees.tsx`

- Remplacer `useEmployeeJobs()` par `useCompletedEmployeeJobs()` pour le calcul de `totalHours` et `totalPay` affichés sur la carte employé.
- Les heures affichées sur la carte deviennent donc "heures confirmées" (jobs complétées seulement). Conforme au spec : pas de paie comptée avant complétion.

### 3. `src/components/employees/EmployeeProfileDialog.tsx`

- **Onglet Historique** : garder `useEmployeeJobs()` tel quel — toutes les jobs (assignées, planifiées, complétées) restent visibles. Ajouter un badge discret "En attente" sur les lignes dont `job.status !== "completed"`, et **ne pas afficher le `$ calculated_pay`** sur ces lignes (afficher seulement les heures + un libellé "Paie à confirmer"). Les jobs complétées continuent d'afficher le montant.
- **Onglet Finance** : `totalSummer`, `totalAllTime`, `totalHours` et la liste "Détail été en cours" → calculés à partir de `useCompletedEmployeeJobs()` uniquement. Les montants affichés deviennent strictement des **gains confirmés**.

### 4. Invalidation React Query — `src/hooks/useSupabaseData.ts`

`useUpdateJob` (ligne 367) n'invalide que `["jobs"]`. Quand on passe une job à `completed` (ou qu'on revient en arrière), les vues Employees/Profile lisent une liste `employee_jobs` non rafraîchie côté hook combiné. Ce n'est pas critique (le `useJobs` se met à jour et le helper recalcule), mais pour être propre et instantané, ajouter aussi :

```
qc.invalidateQueries({ queryKey: ["employee_jobs"] });
qc.invalidateQueries({ queryKey: ["invoices"] });
```

dans le `onSuccess` de `useUpdateJob`. Cela garantit que le passage à completed met immédiatement à jour les totaux employés (et le retour à un statut non-complété les retire).

## Critères d'acceptation couverts

| Critère | Couvert par |
|---|---|
| Job non complétée → pas dans le total gagné | Hook `useCompletedEmployeeJobs` filtre par `status === 'completed'` |
| Passage à completed → montant ajouté | Invalidation `employee_jobs` dans `useUpdateJob` + filtre dynamique |
| Retour en arrière → montant retiré | Même mécanisme, filtre dynamique |
| Heures/assignations restent visibles | Onglet Historique du profil garde toutes les lignes |
| Mise à jour automatique après changement de statut | Invalidation React Query ajoutée |
| Aucune logique d'assignation modifiée | `JobEmployeesSection` non touché |
| Logique Invoices non mélangée | Aucun changement Invoices |

## Fichiers modifiés

- **Nouveau** : `src/hooks/useCompletedEmployeeJobs.ts`
- `src/hooks/useSupabaseData.ts` (ajout invalidation dans `useUpdateJob`)
- `src/pages/Employees.tsx`
- `src/components/employees/EmployeeProfileDialog.tsx`

Aucun changement DB, aucune modification des triggers `recalc_job_pays`, aucun changement aux RLS.
