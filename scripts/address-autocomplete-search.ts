import * as fs from "node:fs";
import * as path from "node:path";
import {
  type Address,
  type Suggestion,
  normalizeQuery,
  getFileName,
  isLetterChar,
  isDigitChar,
  toSuggestion,
  DIGIT_FILES,
  searchAddressesCore,
} from "./address-search-core";

// Re-export types for backward compatibility
export type { Address, Suggestion };

export { normalizeQuery, getFileName, isLetterChar, toSuggestion };

const cache = new Map<string, Address[]>();

export function clearCache(): void {
  cache.clear();
}

function loadFile(name: string, dataDir: string): Address[] {
  if (cache.has(name)) return cache.get(name)!;

  const filePath = path.join(dataDir, `${name}.ndjson`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const addresses: Address[] = [];
    for (const line of lines) {
      try {
        addresses.push(JSON.parse(line));
      } catch {
        /* skip malformed lines */
      }
    }
    cache.set(name, addresses);
    console.log(`[address-autocomplete] Cache charge: ${name}.ndjson (${addresses.length} entrees)`);
    return addresses;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.warn(`[address-autocomplete] Fichier introuvable: ${filePath}`);
    } else {
      console.error(`[address-autocomplete] Erreur chargement ${name}.ndjson:`, err);
    }
    return [];
  }
}

/**
 * Discover available chunk files for a given digit by scanning the data directory.
 * Returns file names without .ndjson extension.
 * E.g., for digit "1": returns ["1-0", "1-1", ..., "1-9"] if chunked,
 * or ["1"] if a single 1.ndjson exists.
 */
function getDigitChunks(digit: string, dataDir: string): string[] {
  let files: string[];
  try {
    files = fs.readdirSync(dataDir);
  } catch {
    return [digit];
  }

  // Look for files matching this digit prefix
  const digitFiles = files.filter(f => {
    const nameWithoutExt = f.replace(/\.ndjson$/, "");
    return nameWithoutExt === digit || nameWithoutExt.startsWith(`${digit}-`);
  });

  if (digitFiles.length === 0) return [digit]; // Fallback to single file

  return digitFiles.map(f => f.replace(/\.ndjson$/, "")).sort();
}

/**
 * Search addresses using local filesystem NDJSON files.
 * Delegates to the core search algorithm with chunk discovery.
 */
export function searchAddresses(
  query: string,
  maxResults: number,
  dataDir: string,
): Suggestion[] {
  const loader = (fileName: string) => loadFile(fileName, dataDir);
  const chunkDiscoverer = (digit: string) => getDigitChunks(digit, dataDir);
  return searchAddressesCore(query, maxResults, loader, chunkDiscoverer);
}
