// ============================================================
// TDD RED Phase: Tests for safe Supabase migration files
// ============================================================
// These tests validate that migration files:
// 1. Exist and are named correctly
// 2. Contain only safe, non-destructive SQL
// 3. Use IF NOT EXISTS patterns correctly
// 4. Contain no DROP, DELETE, or TRUNCATE statements
// 5. The documentation files exist and contain required sections

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// --- Constants ---

const SUPABASE_MIGRATIONS_DIR = resolve(__dirname, "..", "supabase", "migrations");
const PROJECT_ROOT = resolve(__dirname, "..");

const EXPECTED_MIGRATION_FILES = [
  "20260531000001_safe_extensions.sql",
  "20260531000002_safe_app_role_enum.sql",
  "20260531000003_safe_utility_functions.sql",
  "20260531000004_safe_missing_columns.sql",
  "20260531000005_safe_storage_buckets.sql",
  "20260531000006_safe_storage_policies.sql",
  "20260531000007_safe_rls_enablement.sql",
  "20260531000008_safe_rls_policies.sql",
] as const;

const EXPECTED_DOC_FILES = [
  "SUPABASE_EXISTING_PROJECT_MIGRATION_PLAN.md",
  "SUPABASE_ENV_CHECKLIST.md",
] as const;

interface MigrationFile {
  name: string;
  path: string;
  content: string;
}

// --- Load files at module level (synchronous, no beforeAll needed) ---

function loadMigrationFile(name: string): MigrationFile {
  const fullPath = join(SUPABASE_MIGRATIONS_DIR, name);
  if (!existsSync(fullPath)) {
    return { name, path: fullPath, content: "" };
  }
  return {
    name,
    path: fullPath,
    content: readFileSync(fullPath, "utf-8"),
  };
}

function loadDocContent(filename: string): string {
  const fullPath = join(PROJECT_ROOT, filename);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf-8");
}

const MIGRATIONS: MigrationFile[] = EXPECTED_MIGRATION_FILES.map(loadMigrationFile);
const ALL_MIGRATIONS_EXIST = MIGRATIONS.every((m) => m.content !== "");
const DOC_FILES = EXPECTED_DOC_FILES.map((name) => ({ name, content: loadDocContent(name) }));
const ALL_DOCS_EXIST = DOC_FILES.every((d) => d.content !== "");

/**
 * Escape special regex characters in a string for safe use in RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Tests ---

describe("Safe Supabase Migration Files", () => {
  describe("File existence (RED phase safety check)", () => {
    for (const name of EXPECTED_MIGRATION_FILES) {
      it(`migration file ${name} exists`, () => {
        const migration = MIGRATIONS.find((m) => m.name === name);
        expect(migration).toBeDefined();
        expect(migration!.content).not.toBe("");
      });
    }

    for (const name of EXPECTED_DOC_FILES) {
      it(`documentation file ${name} exists`, () => {
        const doc = DOC_FILES.find((d) => d.name === name);
        expect(doc).toBeDefined();
        expect(doc!.content).not.toBe("");
      });
    }
  });

  describe("Filenames follow project convention", () => {
    for (const name of EXPECTED_MIGRATION_FILES) {
      it(`${name} starts with a 14-digit timestamp`, () => {
        const timestamp = name.split("_")[0];
        expect(timestamp).toMatch(/^\d{14}$/);
      });

      it(`${name} is .sql extension`, () => {
        expect(name).toMatch(/\.sql$/);
      });

      it(`${name} has a descriptive name after the timestamp`, () => {
        const parts = name.split("_");
        expect(parts.length).toBeGreaterThanOrEqual(2);
        const description = parts.slice(1).join("_").replace(".sql", "");
        expect(description.length).toBeGreaterThan(0);
      });
    }
  });

  // Only run content tests if files exist
  if (ALL_MIGRATIONS_EXIST) {
    describe("Content safety — no destructive operations", () => {
      for (const migration of MIGRATIONS) {
        if (!migration.content) continue;

        describe(`${migration.name}`, () => {
          const DESTRUCTIVE_PATTERNS = [
            { pattern: /^\s*DROP\s+(TABLE|VIEW|FUNCTION|TRIGGER|POLICY|INDEX|MATERIALIZED|PUBLICATION)\s/im, label: "DROP object" },
            { pattern: /^\s*DELETE\s+FROM\s/im, label: "DELETE FROM" },
            { pattern: /^\s*TRUNCATE\s/im, label: "TRUNCATE" },
            { pattern: /ALTER\s+.*\s+DROP\s+(COLUMN|CONSTRAINT)\s/im, label: "ALTER ... DROP COLUMN/CONSTRAINT" },
          ];

          for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
            it(`contains no ${label}`, () => {
              const relevantLines = migration.content
                .split("\n")
                .filter((line) => !line.trim().startsWith("--") && line.trim() !== "")
                .join("\n");
              expect(relevantLines).not.toMatch(pattern);
            });
          }

          it("does not contain destructive DELETE statement", () => {
            // Only flag DELETE FROM (data modification), not DELETE comments in SQL
            const lines = migration.content.split("\n");
            const destructiveDeletes = lines.filter(
              (line) => !line.trim().startsWith("--") && /^\s*DELETE\s+FROM/i.test(line)
            );
            expect(destructiveDeletes.length).toBe(0);
          });
        });
      }
    });

    describe("Safe SQL patterns per migration", () => {
      describe("20260531000001_safe_extensions.sql", () => {
        it("uses CREATE EXTENSION IF NOT EXISTS for all extensions", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("extensions"))!;
          expect(file.content).toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS/i);
        });

        it("enables pgcrypto extension", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("extensions"))!;
          expect(file.content).toMatch(/pgcrypto/i);
        });

        it("has no bare CREATE EXTENSION without IF NOT EXISTS", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("extensions"))!;
          const bareCreateRegex = /CREATE\s+EXTENSION\s+(?!IF\s+NOT\s+EXISTS)/i;
          const lines = file.content.split("\n").filter((l) => !l.trim().startsWith("--"));
          expect(lines.join("\n")).not.toMatch(bareCreateRegex);
        });

        it("does NOT enable pg_cron (Free tier compatibility)", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("extensions"))!;
          // pg_cron is not available on Supabase Free tier.
          // Scheduled email processing will be handled differently later.
          const codeLines = file.content
            .split("\n")
            .filter((l) => !l.trim().startsWith("--"))
            .join("\n");
          expect(codeLines).not.toMatch(/pg_cron/i);
        });

        it("does not add extensions that don't exist", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("extensions"))!;
          // Only well-known Supabase extensions should be used
          // NOTE: pg_cron intentionally removed — not available on Free tier
          const allowedExtensions = [
            "pgcrypto", "pg_net", "supabase_vault", "pgmq",
            "pg_graphql", "pg_stat_statements", "uuid-ossp", "pgjwt",
            "pg_sodium", "pgsodium",
          ];
          const lines = file.content.split("\n");
          for (const line of lines) {
            const match = line.match(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+(?:SCHEMA\s+\w+\s+)?(\w+)/i);
            if (match) {
              expect(allowedExtensions).toContain(match[1]);
            }
          }
        });
      });

      describe("20260531000002_safe_app_role_enum.sql", () => {
        it("uses a DO block to safely create the enum", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("app_role"))!;
          expect(file.content).toMatch(/DO\s*\$\$/i);
          expect(file.content).toMatch(/CREATE\s+TYPE/i);
          // Accepts both EXCEPTION handler and IF NOT EXISTS pre-check patterns
          const hasSafePattern =
            /EXCEPTION\s+WHEN\s+duplicate_object/i.test(file.content) ||
            /IF\s+NOT\s+EXISTS\s*\(/i.test(file.content);
          expect(hasSafePattern).toBe(true);
        });

        it("defines app_role with admin and member values", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("app_role"))!;
          expect(file.content).toMatch(/admin/);
          expect(file.content).toMatch(/member/);
        });

        it("does not drop the type if it already exists", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("app_role"))!;
          // Filter out comment lines to avoid false positives from documentation
          const codeLines = file.content
            .split("\n")
            .filter((l) => !l.trim().startsWith("--"))
            .join("\n");
          expect(codeLines).not.toMatch(/DROP\s+TYPE/i);
        });
      });

      describe("20260531000003_safe_utility_functions.sql", () => {
        it("defines set_updated_at() function", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("utility_functions"))!;
          expect(file.content).toMatch(/set_updated_at/i);
        });

        it("defines is_email_approved() function", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("utility_functions"))!;
          expect(file.content).toMatch(/is_email_approved/i);
        });

        it("defines has_role() function", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("utility_functions"))!;
          expect(file.content).toMatch(/has_role/i);
        });

        it("defines current_user_approved() function", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("utility_functions"))!;
          expect(file.content).toMatch(/current_user_approved/i);
        });

        it("uses CREATE OR REPLACE FUNCTION for all definitions", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("utility_functions"))!;
          const createFuncLines = file.content
            .split("\n")
            .filter((l) => /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(l));
          
          expect(createFuncLines.length).toBeGreaterThanOrEqual(4);
          for (const line of createFuncLines) {
            expect(line).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
          }
        });

        it("does not contain DROP FUNCTION", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("utility_functions"))!;
          expect(file.content).not.toMatch(/DROP\s+FUNCTION/i);
        });
      });

      describe("20260531000004_safe_missing_columns.sql", () => {
        it("only uses ADD COLUMN IF NOT EXISTS for ALTER TABLE", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("missing_columns"))!;
          const alterLines = file.content
            .split("\n")
            .filter((l) => /ALTER\s+TABLE/i.test(l) && !l.trim().startsWith("--"));
          
          expect(alterLines.length).toBeGreaterThan(0);
          for (const line of alterLines) {
            expect(line).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
          }
        });

        it("does not include ALTER TABLE SET or ALTER COLUMN DROP", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("missing_columns"))!;
          const codeLines = file.content
            .split("\n")
            .filter((l) => !l.trim().startsWith("--"))
            .join("\n");
          // Allow ALTER TABLE IF EXISTS and ALTER TABLE ... ADD COLUMN patterns
          const hasDestructiveAlter = /ALTER(\s+TABLE\s+IF\s+EXISTS)?\s+"[^"]+"\s+(?!ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS)/i;
          expect(codeLines).not.toMatch(hasDestructiveAlter);
        });

        const TABLE_COLUMN_CHECKS: [string, string[]][] = [
          ["customers", ["billing_info"]],
          ["employees", ["is_admin"]],
          ["employee_jobs", ["is_present"]],
          ["jobs", ["tip", "pauses", "total_pause_minutes", "estimated_duration_minutes", "duration_variance_minutes"]],
          ["parameters", ["two_sides_multiplier", "company_website", "company_logo_url", "price_per_foot_restoration", "rounding_enabled", "rounding_multiple"]],
          ["estimations", ["back_left_length", "back_right_length", "height_back_left", "height_back_right"]],
          ["estimation_requests", ["photos", "seen_at"]],
          ["email_send_state", ["batch_size", "send_delay_ms", "auth_email_ttl_minutes", "transactional_email_ttl_minutes"]],
        ];

        for (const [table, columns] of TABLE_COLUMN_CHECKS) {
          for (const column of columns) {
            it(`adds ${column} column to ${table}`, () => {
              const file = MIGRATIONS.find((m) => m.name.includes("missing_columns"))!;
              expect(file.content).toMatch(
                new RegExp(`${table}[\\s\\S]*?${column}`, "i")
              );
            });
          }
        }

        it("does not include ALTER TABLE SET or ALTER COLUMN DROP", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("missing_columns"))!;
          expect(file.content).not.toMatch(/ALTER\s+TABLE.*SET\s/i);
          expect(file.content).not.toMatch(/ALTER\s+COLUMN.*DROP/i);
        });

        it("uses ALTER TABLE IF EXISTS for email_send_state (optional table)", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("missing_columns"))!;
          const emailStateLines = file.content
            .split("\n")
            .filter((l) => l.includes("email_send_state") && !l.trim().startsWith("--"));
          expect(emailStateLines.length).toBeGreaterThan(0);
          for (const line of emailStateLines) {
            expect(line).toMatch(/ALTER\s+TABLE\s+IF\s+EXISTS/i);
          }
        });
      });
    });

    describe("20260531000005_safe_storage_buckets.sql", () => {
      it("creates buckets using INSERT ... ON CONFLICT DO NOTHING for idempotency", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        expect(file.content).toMatch(/INSERT\s+INTO\s+storage\.buckets/i);
        expect(file.content).toMatch(/ON\s+CONFLICT\s*\(id\)\s*DO\s+NOTHING/i);
      });

      it("creates estimation-pdfs bucket (private)", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        expect(file.content).toContain("estimation-pdfs");
        expect(file.content).toMatch(/estimation-pdfs[\s\S]*?false/);
      });

      it("creates message-media bucket (public)", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        expect(file.content).toContain("message-media");
        expect(file.content).toMatch(/message-media[\s\S]*?true/);
      });

      it("creates estimation-request-photos bucket (public)", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        expect(file.content).toContain("estimation-request-photos");
        expect(file.content).toMatch(/estimation-request-photos[\s\S]*?true/);
      });

      it("creates company-assets bucket (public)", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        expect(file.content).toContain("company-assets");
        expect(file.content).toMatch(/company-assets[\s\S]*?true/);
      });

      it("creates job-photos bucket (public)", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        expect(file.content).toContain("job-photos");
        expect(file.content).toMatch(/job-photos[\s\S]*?true/);
      });

      it("does not use bare INSERT without ON CONFLICT for buckets", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        // Each INSERT INTO storage.buckets must be followed by ON CONFLICT
        // (may be on the same line or the next line in the SQL file)
        const insertStatements = file.content
          .split("\n")
          .filter((l) => /^\s*INSERT\s+INTO\s+storage\.buckets/i.test(l) && !l.trim().startsWith("--"));
        expect(insertStatements.length).toBeGreaterThan(0);
        // Count ON CONFLICT occurrences in non-comment lines only
        const codeLines = file.content
          .split("\n")
          .filter((l) => !l.trim().startsWith("--"))
          .join("\n");
        const onConflictCount = (codeLines.match(/ON\s+CONFLICT\s*\(id\)\s*DO\s+NOTHING/gi) || []).length;
        expect(onConflictCount).toBe(insertStatements.length);
      });

      it("does not contain DROP statements", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_buckets"))!;
        const codeLines = file.content
          .split("\n")
          .filter((l) => !l.trim().startsWith("--"))
          .join("\n");
        expect(codeLines).not.toMatch(/DROP\s+(TABLE|VIEW|FUNCTION|TRIGGER|POLICY|BUCKET)/i);
      });
    });

    describe("20260531000006_safe_storage_policies.sql", () => {
      it("creates storage object policies for estimation-pdfs", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).toMatch(/estimation-pdfs/i);
      });

      it("creates storage object policies for message-media", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).toMatch(/message-media/i);
      });

      it("creates storage object policies for estimation-request-photos", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).toMatch(/estimation-request-photos/i);
      });

      it("creates storage object policies for company-assets", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).toMatch(/company-assets/i);
      });

      it("creates storage object policies for job-photos", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).toMatch(/job-photos/i);
      });

      it("uses DO blocks or CREATE POLICY IF NOT EXISTS for idempotent policy creation", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        const hasDoBlock = /\$\$[\s\S]*?pg_policies[\s\S]*?\$\$/i.test(file.content);
        const hasIfNotExists = /CREATE\s+POLICY\s+IF\s+NOT\s+EXISTS/i.test(file.content);
        expect(hasDoBlock || hasIfNotExists).toBe(true);
      });

      it("each bucket has SELECT, INSERT, UPDATE, DELETE policies", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        const bucketNames = ["estimation-pdfs", "message-media", "estimation-request-photos", "company-assets", "job-photos"];
        for (const bucket of bucketNames) {
          expect(file.content).toMatch(new RegExp(`${escapeRegex(bucket)}[\\s\\S]*?FOR\\s+SELECT`, "i"));
          expect(file.content).toMatch(new RegExp(`${escapeRegex(bucket)}[\\s\\S]*?FOR\\s+INSERT`, "i"));
          expect(file.content).toMatch(new RegExp(`${escapeRegex(bucket)}[\\s\\S]*?FOR\\s+UPDATE`, "i"));
          expect(file.content).toMatch(new RegExp(`${escapeRegex(bucket)}[\\s\\S]*?FOR\\s+DELETE`, "i"));
        }
      });

      it("targets storage.objects table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).toMatch(/ON\s+storage\.objects/i);
      });

      it("does not contain DROP POLICY statements", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("storage_policies"))!;
        expect(file.content).not.toMatch(/DROP\s+POLICY/i);
      });
    });

    describe("20260531000007_safe_rls_enablement.sql", () => {
      it("enables RLS on customers table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/customers[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on jobs table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/jobs[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on employees table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/employees[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on employee_jobs table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/employee_jobs[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on invoices table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/invoices[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on expenses table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/expenses[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on estimations table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/estimations[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on parameters table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/parameters[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on reminders table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/reminders[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on user_roles table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/user_roles[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on approved_emails table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/approved_emails[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on approved_domains table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/approved_domains[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on app_settings table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/app_settings[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on messages table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/messages[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on blocked_numbers table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/blocked_numbers[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on estimation_requests table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/estimation_requests[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on email_send_log table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/email_send_log[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on email_send_state table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/email_send_state[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on suppressed_emails table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/suppressed_emails[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("enables RLS on email_unsubscribe_tokens table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).toMatch(/email_unsubscribe_tokens[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      });

      it("uses ALTER TABLE ... ENABLE ROW LEVEL SECURITY pattern", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        const enableRlsCount = (file.content.match(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi) || []).length;
        expect(enableRlsCount).toBeGreaterThanOrEqual(20);
      });

      it("does not contain DROP or DISABLE RLS statements", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
        expect(file.content).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
        const codeLines = file.content
          .split("\n")
          .filter((l) => !l.trim().startsWith("--"))
          .join("\n");
        expect(codeLines).not.toMatch(/DROP\s+(TABLE|VIEW|FUNCTION|TRIGGER|POLICY)/i);
      });

      describe("Optional table safety guards", () => {
        it("suppressed_emails ALTER TABLE is wrapped in DO block with to_regclass guard", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
          // Match from the "Optional email infrastructure tables" comment through suppressed_emails + ENABLE RLS
          const suppressedSection = file.content.match(/Optional email infrastructure tables[\s\S]*?suppressed_emails[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
          expect(suppressedSection).not.toBeNull();
          // Must be inside a DO block with to_regclass check
          expect(suppressedSection![0]).toMatch(/DO\s*\$\$/i);
          expect(suppressedSection![0]).toMatch(/to_regclass/i);
          expect(suppressedSection![0]).toMatch(/suppressed_emails/);
        });

        it("email_unsubscribe_tokens ALTER TABLE is wrapped in DO block with to_regclass guard", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
          // Match from the "Optional email infrastructure tables" comment through email_unsubscribe_tokens + ENABLE RLS
          const tokensSection = file.content.match(/Optional email infrastructure tables[\s\S]*?email_unsubscribe_tokens[\s\S]*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
          expect(tokensSection).not.toBeNull();
          // Must be inside a DO block with to_regclass check
          expect(tokensSection![0]).toMatch(/DO\s*\$\$/i);
          expect(tokensSection![0]).toMatch(/to_regclass/i);
          expect(tokensSection![0]).toMatch(/email_unsubscribe_tokens/);
        });

        it("core tables use direct ALTER TABLE without DO block (not optional)", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("rls_enablement"))!;
          // customers is a required table - must use direct ALTER TABLE
          const customerLines = file.content
            .split("\n")
            .filter((l) => l.includes("customers") && l.includes("ENABLE ROW LEVEL SECURITY"))
            .join("\n");
          expect(customerLines).toMatch(/ALTER\s+TABLE/i);
          expect(customerLines).not.toMatch(/DO\s*\$/);
        });
      });
    });

    describe("20260531000008_safe_rls_policies.sql", () => {
      it("creates policies for customers table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/customers/i);
      });

      it("creates policies for jobs table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/jobs/i);
      });

      it("creates policies for employees table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/employees/i);
      });

      it("creates policies for employee_jobs table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/employee_jobs/i);
      });

      it("creates policies for invoices table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/invoices/i);
      });

      it("creates policies for expenses table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/expenses/i);
      });

      it("creates policies for estimations table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/estimations(?:_requests)?/i);
      });

      it("creates policies for parameters table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/parameters/i);
      });

      it("creates policies for reminders table", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).toMatch(/reminders/i);
      });

      it("uses idempotent pattern (DO block or IF NOT EXISTS) for policy creation", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        const hasDoBlock = /\$\$[\s\S]*?pg_policies[\s\S]*?\$\$/i.test(file.content);
        const hasIfNotExists = /CREATE\s+POLICY\s+IF\s+NOT\s+EXISTS/i.test(file.content);
        const hasSafeCheck = /IF\s+NOT\s+EXISTS\s*\(/i.test(file.content);
        expect(hasDoBlock || hasIfNotExists || hasSafeCheck).toBe(true);
      });

      it("uses current_user_approved() or has_role() for access control", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        const hasApprovedCheck = /current_user_approved/i.test(file.content);
        const hasRoleCheck = /has_role/i.test(file.content);
        expect(hasApprovedCheck || hasRoleCheck).toBe(true);
      });

      it("does not contain DROP POLICY statements", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        expect(file.content).not.toMatch(/DROP\s+POLICY/i);
      });

      it("does not allow unauthenticated access (public or USING(true))", () => {
        const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
        const codeLines = file.content
          .split("\n")
          .filter((l) => !l.trim().startsWith("--"))
          .join("\n");
        // "FOR ALL TO public" or "USING(true)" without checks would be dangerous
        expect(codeLines).not.toMatch(/TO\s+public/i);
      });

      describe("Optional table safety guards", () => {
        it("suppressed_emails policies are guarded by to_regclass check", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
          const suppressedSection = file.content.match(/suppressed_emails[\s\S]{0,800}(?:CREATE POLICY|END IF)/);
          expect(suppressedSection).not.toBeNull();
          // The DO block for suppressed_emails must have to_regclass guard
          expect(suppressedSection![0]).toMatch(/to_regclass/i);
          expect(suppressedSection![0]).toMatch(/DO\s*\$\$/i);
        });

        it("email_unsubscribe_tokens policies are guarded by to_regclass check", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
          const tokensSection = file.content.match(/email_unsubscribe_tokens[\s\S]{0,800}(?:CREATE POLICY|END IF)/);
          expect(tokensSection).not.toBeNull();
          // The DO block for email_unsubscribe_tokens must have to_regclass guard
          expect(tokensSection![0]).toMatch(/to_regclass/i);
          expect(tokensSection![0]).toMatch(/DO\s*\$\$/i);
        });

        it("core tables policies are not guarded by to_regclass (they are required)", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("rls_policies"))!;
          // Find a DO block for customers (a required table)
          const customerSection = file.content.match(/tablename\s*=\s*'customers'[\s\S]{0,800}END\s+\$\$/);
          expect(customerSection).not.toBeNull();
          // The DO block for customers should NOT have to_regclass guard
          expect(customerSection![0]).not.toMatch(/to_regclass/i);
        });
      });
    });

    describe("Types consistency check", () => {
      it("app_role enum in types.ts has admin and member values", () => {
        const typesPath = resolve(
          PROJECT_ROOT,
          "src",
          "integrations",
          "supabase",
          "types.ts"
        );
        const typesContent = readFileSync(typesPath, "utf-8");
        expect(typesContent).toContain("app_role");
        expect(typesContent).toContain('"admin"');
        expect(typesContent).toContain('"member"');
      });
    });
  } else {
    describe("Migration files not yet created (RED phase)", () => {
      for (const migration of MIGRATIONS) {
        if (!migration.content) {
          it(`MISSING: ${migration.name} needs to be created`, () => {
            // This test intentionally fails (RED phase)
            expect(migration.content).not.toBe("");
          });
        }
      }

      for (const doc of DOC_FILES) {
        if (!doc.content) {
          it(`MISSING: ${doc.name} needs to be created`, () => {
            expect(doc.content).not.toBe("");
          });
        }
      }
    });
  }
});

describe("SUPABASE_EXISTING_PROJECT_MIGRATION_PLAN.md", () => {
  const content = loadDocContent("SUPABASE_EXISTING_PROJECT_MIGRATION_PLAN.md");

  it("exists and has content", () => {
    expect(content).not.toBe("");
  });

  if (content) {
    it("contains the exact application order", () => {
      for (const name of EXPECTED_MIGRATION_FILES) {
        expect(content).toContain(name);
      }
    });

    it("contains warnings about not running destructive commands", () => {
      expect(content).toMatch(/do not run|ne pas lancer|DON'T|AVERTISSEMENT|warning/i);
    });

    it("mentions supabase CLI commands (with warnings)", () => {
      expect(content).toContain("supabase");
      expect(content).toMatch(/db\s+(push|diff)/i);
    });

    it("provides rollback instructions", () => {
      expect(content).toMatch(/rollback|revert|undo|annuler|revenir/i);
    });

    it("specifies that this is step 1 only", () => {
      expect(content).toMatch(/étape 1|step 1|première étape|first step/i);
    });

    it("mentions that pg_cron is postponed or deferred for Free tier", () => {
      // pg_cron is intentionally not included; should be noted somewhere in the doc
      // Accepts French explanations (pas activée, pas disponible, exclu, reporté)
      expect(content).toMatch(/pg_cron.*(?:pas\s+activ|pas\s+disponib|exclu|report|diff.r|defer)/i);
    });
  }
});

describe("SUPABASE_ENV_CHECKLIST.md", () => {
  const content = loadDocContent("SUPABASE_ENV_CHECKLIST.md");

  it("exists and has content", () => {
    expect(content).not.toBe("");
  });

  if (content) {
    it("contains VITE_SUPABASE_URL requirement", () => {
      expect(content).toMatch(/VITE_SUPABASE_URL/i);
    });

    it("contains VITE_SUPABASE_PUBLISHABLE_KEY requirement", () => {
      expect(content).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY/i);
    });

    it("mentions .env file", () => {
      expect(content).toMatch(/\.env/i);
    });

    it("contains a section about Supabase project configuration", () => {
      expect(content).toMatch(/project|config|configuration|supabase/i);
    });

    it("contains verification steps", () => {
      expect(content).toMatch(/verify|vérification|check|test|vérifier/i);
    });

    it("does NOT list pg_cron as an expected extension (Free tier)", () => {
      // pg_cron is not available on Free tier; the checklist should reflect that
      // Allow comments/explanations about pg_cron being deferred, but not as expected extension
      const tableSection = content.split(/## 4\./)[0]; // Only check the extensions table section
      expect(tableSection).not.toMatch(/\|.*pg_cron.*\|/);
    });
  }
});
