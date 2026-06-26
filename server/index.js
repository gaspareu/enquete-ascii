import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scenario, flagsConnus } from "../data/scenario.js";
import { creerRouteur } from "./chat.js";
import { creerClient } from "./claude.js";

// Charge .env si présent (Node 22+). Sans .env, on s'appuie sur les variables
// d'environnement déjà exportées — on ne fait pas échouer le démarrage.
try {
  process.loadEnvFile();
} catch {
  // Pas de fichier .env : ce n'est pas une erreur en soi.
}

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

// Le client Claude n'est créé que si la clé est présente. Sans clé, le serveur
// démarre quand même (front + /api/scenario) et /api/chat renvoie un 503 clair.
let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    client = creerClient();
  } catch (err) {
    console.warn("Client Claude non initialisé:", err?.message ?? err);
  }
} else {
  console.warn("ANTHROPIC_API_KEY absent : le dialogue sera indisponible.");
}

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(publicDir));
app.use(
  "/api",
  creerRouteur({
    scenario,
    flagsConnus: flagsConnus(),
    client,
    model: process.env.MODEL || "claude-sonnet-4-6",
  }),
);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Enquête ASCII : http://localhost:${port}`);
});

export { app };
