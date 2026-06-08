import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { addressAutocompletePlugin } from "./scripts/vite-plugin-address-autocomplete";

function validateEnvPlugin() {
  return {
    name: "validate-env",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), "VITE_");
      const missing: string[] = [];
      if (!env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
      if (!env.VITE_SUPABASE_PUBLISHABLE_KEY)
        missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
      if (missing.length) {
        console.warn(
          `\n⚠️  Variables d'environnement manquantes : ${missing.join(", ")}\n` +
            "   L'application démarrera mais affichera une erreur de configuration.\n" +
            "   Copiez .env.example vers .env et remplissez les valeurs.\n"
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    validateEnvPlugin(),
    react(),
    addressAutocompletePlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
}));
