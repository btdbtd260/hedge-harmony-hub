import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import * as readline from "node:readline";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const CSV_PATH = path.resolve(__dirname, "..", "Data", "adresses-repentigny-50km.csv");
const OUT_DIR = path.resolve(
  __dirname, "..",
  "supabase", "functions", "address-autocomplete", "data",
);

const MAX_FILE_SIZE_BYTES = 45 * 1024 * 1024; // 45 MB safe limit

fs.mkdirSync(OUT_DIR, { recursive: true });

const COL_ID = 0;
const COL_ADDRESS = 20;
const COL_POSTAL_CODE = 9;
const COL_MUNICIPALITY = 35;
const COL_LONGITUDE = 43;
const COL_LATITUDE = 44;
const COL_DISTANCE = 45;

interface AddressEntry {
  s: string;
  a: string;
  v: string;
  cp: string;
  d: number;
  lat: number;
  lng: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function normalizeSearchKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "");
}

function getFileName(label: string): string {
  const first = normalizeSearchKey(label).charAt(0);
  if (!first) return "other";
  const code = first.charCodeAt(0);
  if (code >= 97 && code <= 122) return first;
  if (code >= 48 && code <= 57) return first;
  return "other";
}

function getChunkSuffix(searchKey: string): string {
  if (searchKey.length < 2) return "x";
  const ch = searchKey[1];
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return ch;
  if (code >= 97 && code <= 122) return ch;
  return "x";
}

async function main() {
  console.log("Lecture du CSV: " + CSV_PATH);
  const fileStats = fs.statSync(CSV_PATH);
  console.log("Taille: " + (fileStats.size / 1024 / 1024).toFixed(2) + " MB");

  const fileStream = fs.createReadStream(CSV_PATH, { encoding: "utf-8", highWaterMark: 1024 * 1024 });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const writers = new Map<string, fs.WriteStream>();
  const digitChunkCounts = new Map<string, Map<string, number>>();
  // Track which digits have been opened as single files
  const digitSingleFiles = new Set<string>();

  let headerParsed = false;
  let totalRows = 0;
  let skippedRows = 0;

  function getWriter(name: string): fs.WriteStream {
    let w = writers.get(name);
    if (!w) {
      const filePath = path.join(OUT_DIR, name + ".ndjson");
      w = fs.createWriteStream(filePath, { flags: "w" });
      writers.set(name, w);
    }
    return w;
  }

  console.log("Phase 1: Parcours du CSV et ecriture des fichiers...");

  for await (const rawLine of rl) {
    if (!headerParsed) {
      headerParsed = true;
      continue;
    }
    if (!rawLine.trim()) continue;

    const fields = parseCsvLine(rawLine);
    if (fields.length <= Math.max(COL_ADDRESS, COL_LATITUDE, COL_DISTANCE)) {
      skippedRows++;
      continue;
    }

    const label = fields[COL_ADDRESS]?.trim();
    const ville = fields[COL_MUNICIPALITY]?.trim();
    const codePostal = fields[COL_POSTAL_CODE]?.trim();
    const lonStr = fields[COL_LONGITUDE]?.trim();
    const latStr = fields[COL_LATITUDE]?.trim();
    const distStr = fields[COL_DISTANCE]?.trim();

    if (!label || !ville || !codePostal || !lonStr || !latStr) {
      skippedRows++;
      continue;
    }

    const latitude = Number.parseFloat(latStr);
    const longitude = Number.parseFloat(lonStr);
    const distance = Number.parseFloat(distStr) || 0;

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      skippedRows++;
      continue;
    }

    const searchKey = normalizeSearchKey(label);
    const fileName = getFileName(label);
    const firstCode = searchKey.charCodeAt(0);

    if (firstCode >= 48 && firstCode <= 57) {
      // Digit entry: write to chunk file
      const suffix = getChunkSuffix(searchKey);
      const chunkFileName = `${fileName}-${suffix}`;

      if (!digitChunkCounts.has(fileName)) {
        digitChunkCounts.set(fileName, new Map());
      }
      const suffixCounts = digitChunkCounts.get(fileName)!;
      suffixCounts.set(suffix, (suffixCounts.get(suffix) || 0) + 1);

      let chunkWriter = writers.get(chunkFileName);
      if (!chunkWriter) {
        const chunkPath = path.join(OUT_DIR, chunkFileName + ".ndjson");
        chunkWriter = fs.createWriteStream(chunkPath, { flags: "w" });
        writers.set(chunkFileName, chunkWriter);
      }
      chunkWriter.write(JSON.stringify({
        s: searchKey,
        a: label,
        v: ville,
        cp: codePostal,
        d: distance,
        lat: latitude,
        lng: longitude,
      }) + "\n");
    } else {
      // Letter/other: write directly
      digitSingleFiles.add(fileName); // Not a digit, so this is fine
      const writer = getWriter(fileName);
      writer.write(JSON.stringify({
        s: searchKey,
        a: label,
        v: ville,
        cp: codePostal,
        d: distance,
        lat: latitude,
        lng: longitude,
      }) + "\n");
    }

    totalRows++;
    if (totalRows % 100_000 === 0) {
      console.log("  " + (totalRows / 1_000_000).toFixed(2) + "M lignes traitees...");
    }
  }

  // Close all writers
  for (const [, w] of writers) {
    w.end();
  }

  // Phase 2: Merge or keep chunks
  console.log("\nPhase 2: Verification des fichiers...");
  const mergedIndex: Record<string, string[]> = {};

  for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    const suffixCounts = digitChunkCounts.get(digit);
    if (!suffixCounts) {
      mergedIndex[digit] = [digit];
      continue;
    }

    let totalEntries = 0;
    const chunkFiles: string[] = [];
    for (const [suffix] of suffixCounts) {
      const chunkName = `${digit}-${suffix}`;
      chunkFiles.push(chunkName);
      totalEntries += suffixCounts.get(suffix) || 0;
    }

    const estimatedSizeBytes = totalEntries * 190;

    if (estimatedSizeBytes <= MAX_FILE_SIZE_BYTES) {
      // Merge chunks into single file
      console.log(`  Fusion des chunks ${digit}-* vers ${digit}.ndjson...`);
      const chunks: string[] = [];
      for (const chunkName of chunkFiles) {
        const chunkPath = path.join(OUT_DIR, `${chunkName}.ndjson`);
        if (fs.existsSync(chunkPath)) {
          chunks.push(chunkPath);
        }
      }
      // Read and merge
      const mergedWriter = fs.createWriteStream(path.join(OUT_DIR, `${digit}.ndjson`), { flags: "w" });
      for (const chunkPath of chunks) {
        const content = fs.readFileSync(chunkPath, "utf-8");
        mergedWriter.write(content);
        fs.unlinkSync(chunkPath);
      }
      mergedWriter.end();
      mergedIndex[digit] = [digit];
      const mergedSize = fs.statSync(path.join(OUT_DIR, `${digit}.ndjson`)).size;
      console.log(`  ${digit}.ndjson garde comme fichier unique (${(mergedSize / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      // Keep chunked
      const actualChunks: string[] = [];
      for (const chunkName of chunkFiles) {
        const chunkPath = path.join(OUT_DIR, `${chunkName}.ndjson`);
        if (fs.existsSync(chunkPath)) {
          actualChunks.push(chunkName);
        }
      }
      mergedIndex[digit] = actualChunks;
      console.log(`  ${digit}.ndjson fractionne en ${actualChunks.length} chunks`);
    }
  }

  // Phase 3: Clean up any empty files created by getWriter calls
  console.log("\nPhase 3: Nettoyage...");
  const allFiles = fs.readdirSync(OUT_DIR);
  for (const f of allFiles) {
    if (!f.endsWith(".ndjson")) continue;
    const fullPath = path.join(OUT_DIR, f);
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      fs.unlinkSync(fullPath);
      console.log(`  Suppression: ${f} (fichier vide)`);
    }
  }

  // Phase 4: Write index file
  const indexPath = path.join(OUT_DIR, "_chunks.json");
  fs.writeFileSync(indexPath, JSON.stringify(mergedIndex, null, 2));
  console.log(`\nIndex ecrit: _chunks.json`);

  // Final listing
  console.log("\nFichiers finaux:");
  const finalFiles = fs.readdirSync(OUT_DIR)
    .filter(f => f.endsWith(".ndjson") || f === "_chunks.json")
    .sort();
  for (const f of finalFiles) {
    const fullPath = path.join(OUT_DIR, f);
    const size = fs.statSync(fullPath).size;
    if (size > 0 || f === "_chunks.json") {
      console.log(`  ${f} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
  console.log(`\nTotal: ${finalFiles.filter(f => f.endsWith('.ndjson')).length} fichiers NDJSON`);

  console.log("");
  console.log("Traitement termine !");
  console.log("Total: " + totalRows.toLocaleString() + " adresses");
  console.log("Ignorees: " + skippedRows.toLocaleString());
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
