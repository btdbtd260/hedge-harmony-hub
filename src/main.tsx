import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;

try {
  createRoot(rootEl).render(<App />);
} catch (err) {
  const message = err instanceof Error ? err.message : "Erreur inconnue";
  rootEl.innerHTML = `
    <div style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font-family:system-ui,sans-serif;padding:1rem">
      <div style="max-width:28rem;text-align:center">
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem">Erreur de démarrage</h1>
        <p style="color:#94a3b8;margin-bottom:1rem">L'application n'a pas pu démarrer. Veuillez vérifier la configuration.</p>
        <pre style="background:#1e293b;padding:1rem;border-radius:0.5rem;text-align:left;font-size:0.875rem;color:#cbd5e1;overflow:auto;max-height:200px">${message}</pre>
        <button onclick="location.reload()" style="margin-top:1rem;background:#3b82f6;color:#fff;border:none;border-radius:0.375rem;padding:0.5rem 1rem;cursor:pointer;font-size:0.875rem">Rafraîchir</button>
      </div>
    </div>`;
}
