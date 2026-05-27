// ============================================================
// Upload address NDJSON files to Supabase Storage
// ============================================================
// This script uploads all 37 NDJSON files to the
// address-autocomplete Supabase Storage bucket.
//
// Usage:
//   SUPABASE_URL="https://...supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//   npx tsx scripts/upload-address-data-to-storage.ts
// ============================================================

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  ALL_STORAGE_FILES,
} from "./address-search-core";

const DATA_DIR = path.resolve(
  __dirname,
  "..",
  "supabase",
  "functions",
  "address-autocomplete",
  "data",
);

export function getExpectedFileNames(): string[] {
  return ALL_STORAGE_FILES.map((name) => `${name}.ndjson`);
}

export function getAllLocalFilePaths(dataDir: string): string[] {
  return getExpectedFileNames().map((name) => path.join(dataDir, name));
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
  console.log(`Expecting ${filePaths.length} NDJSON files...\n`);

  const existingFiles: { name: string; path: string }[] = [];

  for (const fp of filePaths) {
    const fileName = path.basename(fp);
    if (fs.existsSync(fp)) {
      const stats = fs.statSync(fp);
      console.log(`  ✓ ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
      existingFiles.push({ name: fileName, path: fp });
    } else {
      console.warn(`  ⚠ WARNING: ${fileName} not found, skipping.`);
    }
  }

  if (existingFiles.length === 0) {
    console.error("\nERROR: No NDJSON files found. Run preprocess-addresses.ts first.");
    process.exit(1);
  }

  console.log(`\nFound ${existingFiles.length}/${filePaths.length} files.`);

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
        console.error(`  ✗ ${name}: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ ${name} uploaded`);
        uploaded++;
      }
    } catch (err: any) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // ── Summary ──
  console.log("\n=== Upload Summary ===");
  console.log(`  Total:    ${existingFiles.length}`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed:   ${failed}`);

  if (failed > 0) {
    console.warn("\n⚠ Some files failed to upload. Check errors above.");
    process.exit(1);
  }

  console.log("\n✓ All files uploaded successfully!");
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
