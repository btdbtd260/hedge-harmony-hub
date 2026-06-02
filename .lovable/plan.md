## Plan: generate `import-data-ntyuyupbvsilnedjwgmv-fixed.sql`

Regenerate the SQL import file from existing JSON exports in `/mnt/documents/export-ntyuyupbvsilnedjwgmv/tables/`, with corrected ON CONFLICT targets to handle the `approved_emails` collision.

### Approach

1. Reuse the existing Python generator logic (`/tmp/gen_sql.py`), with one change: per-table conflict target map.
2. Conflict target map:
   - `approved_domains` → `ON CONFLICT (domain) DO UPDATE`
   - `approved_emails` → `ON CONFLICT (email) DO UPDATE`
   - `user_roles` → `ON CONFLICT (user_id, role) DO UPDATE`
   - all others → `ON CONFLICT (id) DO UPDATE`
   - `DO UPDATE SET col = EXCLUDED.col` for every non-conflict column.
3. Same import order (16 tables, `messages` and `reminders` excluded — 0 rows):
   parameters → app_settings → approved_domains → approved_emails → blocked_numbers → email_send_state → customers → employees → user_roles → estimation_requests → estimations → jobs → invoices → employee_jobs → expenses → email_send_log
4. Header note: triggers NOT disabled; verify recalculated columns after import (`employee_jobs.calculated_pay`, `invoices.status`, `updated_at`).
5. Wrap in `BEGIN; ... COMMIT;`. No `SET session_replication_role`.
6. Same type serialization (jsonb, text[], timestamptz, booleans, numerics, nulls).

### Output

- File: `/mnt/documents/import-data-ntyuyupbvsilnedjwgmv-fixed.sql`
- Delivered via `<presentation-artifact path="import-data-ntyuyupbvsilnedjwgmv-fixed.sql" mime_type="application/sql">`
- Response includes: exact path, row counts per table (16 lines), download artifact tag.

### Not touched

- Database (source and target).
- Repo files.
- Previous file `import-data-ntyuyupbvsilnedjwgmv.sql` stays as-is.
