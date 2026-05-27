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

async function main() {
  console.log("Lecture du CSV: " + CSV_PATH);
  const fileStats = fs.statSync(CSV_PATH);
  console.log("Taille: " + (fileStats.size / 1024 / 1024).toFixed(2) + " MB");

  const fileStream = fs.createReadStream(CSV_PATH, { encoding: "utf-8", highWaterMark: 1024 * 1024 });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const writers = new Map<string, fs.WriteStream>();
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

  console.log("Traitement en cours...");

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
    const writer = getWriter(fileName);

    const entry: AddressEntry = {
      s: searchKey,
      a: label,
      v: ville,
      cp: codePostal,
      d: distance,
      lat: latitude,
      lng: longitude,
    };
    writer.write(JSON.stringify(entry) + "\n");
    totalRows++;

    if (totalRows % 100_000 === 0) {
      console.log("  " + (totalRows / 1_000_000).toFixed(2) + "M lignes traitees...");
    }
  }

  for (const [name, w] of writers) {
    w.end();
    console.log("  Fichier: " + name + ".ndjson ecrit");
  }

  console.log("");
  console.log("Traitement termine !");
  console.log("Total: " + totalRows.toLocaleString() + " adresses");
  console.log("Ignorees: " + skippedRows.toLocaleString());
  console.log("Fichiers crees: " + writers.size);
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
