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

        it("does not add extensions that don't exist", () => {
          const file = MIGRATIONS.find((m) => m.name.includes("extensions"))!;
          // Only well-known Supabase extensions should be used
          const allowedExtensions = [
            "pgcrypto", "pg_net", "pg_cron", "supabase_vault", "pgmq",
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
  }
});
