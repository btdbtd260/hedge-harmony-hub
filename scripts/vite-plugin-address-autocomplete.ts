import type { Plugin, ViteDevServer } from "vite";
import * as path from "node:path";
import { searchAddresses } from "./address-autocomplete-search";

const DATA_DIR = path.resolve(
  process.cwd(),
  "supabase",
  "functions",
  "address-autocomplete",
  "data",
);

export function addressAutocompletePlugin(): Plugin {
  return {
    name: "address-autocomplete-dev",
    apply: "serve",

    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/address-autocomplete", (req, res) => {
        const url = new URL(req.url ?? "", `http://${req.headers.host}`);
        const query = url.searchParams.get("q")?.trim() ?? "";
        const maxResultsStr = url.searchParams.get("max");

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", "application/json");

        const maxResults = maxResultsStr ? Number(maxResultsStr) : 10;

        try {
          const suggestions = searchAddresses(query, maxResults, DATA_DIR);

          res.statusCode = 200;
          res.end(JSON.stringify({ suggestions }));
        } catch (err) {
          console.error("[address-autocomplete] Error:", err);
          const msg = err instanceof Error ? err.message : "Erreur inconnue";
          res.statusCode = 500;
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
  };
}
