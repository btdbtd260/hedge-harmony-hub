// ============================================================
// Upload address NDJSON files to Supabase Storage
// ============================================================
// This script uploads all NDJSON files from the data directory
// to the address-autocomplete Supabase Storage bucket.
//
// Usage:
//   SUPABASE_URL="https://...supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//   npx tsx scripts/upload-address-data-to-storage.ts
// ============================================================

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(
  __dirname,
  "..",
  "supabase",
  "functions",
  "address-autocomplete",
  "data",
);

const NDJSON_REGEX = /\.ndjson$/;

/**
 * Dynamically discover all NDJSON files in the data directory.
 * Includes: a.ndjson through z.ndjson, digit chunks (1-0.ndjson etc.),
 * and other.ndjson if it exists.
 */
export function getAllLocalFilePaths(dataDir: string): string[] {
  let files: string[];
  try {
    files = fs.readdirSync(dataDir);
  } catch {
    return [];
  }

  return files
    .filter((f) => NDJSON_REGEX.test(f) && f !== "_chunks.json")
    .map((f) => path.join(dataDir, f))
    .sort();
}

export function validateEnv(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    console.error("ERROR: SUPABASE_URL environment variable is required.");
    return false;
  }
  if (!key) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required.");
    return false;
  }
  return true;
}

async function main() {
  console.log("=== Upload Address Data to Supabase Storage ===\n");

  // ── Validate environment ──
  if (!validateEnv()) {
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucketName = process.env.SUPABASE_BUCKET_NAME || "address-autocomplete";

  // ── Check local files ──
  const filePaths = getAllLocalFilePaths(DATA_DIR);
  console.log(`Found ${filePaths.length} NDJSON files in data directory.\n`);

  if (filePaths.length === 0) {
    console.error("\nERROR: No NDJSON files found. Run preprocess-addresses.ts first.");
    process.exit(1);
  }

  const existingFiles: { name: string; path: string }[] = [];

  for (const fp of filePaths) {
    const fileName = path.basename(fp);
    const stats = fs.statSync(fp);
    console.log(`  ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
    existingFiles.push({ name: fileName, path: fp });
  }

  // ── Create Supabase client ──
  console.log("\nCreating Supabase client...");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Ensure bucket exists ──
  console.log(`Ensuring bucket "${bucketName}" exists...`);
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === bucketName);

  if (!bucketExists) {
    console.error(`\nERROR: Bucket "${bucketName}" does not exist.`);
    console.error("Create it first via Supabase Dashboard or SQL:");
    console.error(`  select storage.create_bucket('${bucketName}');`);
    process.exit(1);
  }

  console.log(`  Bucket "${bucketName}" exists.`);

  // ── Upload files ──
  console.log("\nUploading files...");
  let uploaded = 0;
  let failed = 0;

  for (const { name, path: filePath } of existingFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const blob = new Blob([content], { type: "application/json" });

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(name, blob, {
          contentType: "application/json",
          upsert: true,
        });

      if (error) {
        console.error(`  \u2717 ${name}: ${error.message}`);
        failed++;
      } else {
        console.log(`  \u2713 ${name} uploaded`);
        uploaded++;
      }
    } catch (err: any) {
      console.error(`  \u2717 ${name}: ${err.message}`);
      failed++;
    }
  }

  // ── Upload chunks index if it exists ──
  const indexPath = path.join(DATA_DIR, "_chunks.json");
  if (fs.existsSync(indexPath)) {
    try {
      const content = fs.readFileSync(indexPath, "utf-8");
      const blob = new Blob([content], { type: "application/json" });
      const { error } = await supabase.storage
        .from(bucketName)
        .upload("_chunks.json", blob, {
          contentType: "application/json",
          upsert: true,
        });
      if (error) {
        console.error(`  \u2717 _chunks.json: ${error.message}`);
      } else {
        console.log(`  \u2713 _chunks.json uploaded`);
        uploaded++;
      }
    } catch (err: any) {
      console.error(`  \u2717 _chunks.json: ${err.message}`);
    }
  } else {
    console.log(`  - _chunks.json not found, skipping`);
  }

  // ── Summary ──
  console.log("\n=== Upload Summary ===");
  console.log(`  Total files: ${existingFiles.length}`);
  console.log(`  Uploaded:    ${uploaded}`);
  console.log(`  Failed:      ${failed}`);

  if (failed > 0) {
    console.warn("\n\u26a0 Some files failed to upload. Check errors above.");
    process.exit(1);
  }

  console.log("\n\u2713 All files uploaded successfully!");
}

// Execute if run directly
const isMainModule = process.argv[1] && (
  process.argv[1] === __filename ||
  process.argv[1].endsWith("/upload-address-data-to-storage.ts") ||
  process.argv[1].endsWith("\\upload-address-data-to-storage.ts")
);

if (isMainModule) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
