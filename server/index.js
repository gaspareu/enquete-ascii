import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scenario, ciblesConnues } from "../data/scenario.js";
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

// Voix (T-07) : n'est active que si la clé ET la voix sont fournies. Sinon la
// route /api/voix renvoie 503 et le jeu reste jouable au clavier + texte.
let voix = null;
if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
  voix = {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    model: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
  };
} else {
  console.warn("ELEVENLABS_API_KEY/VOICE_ID absents : la voix sera indisponible.");
}

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(publicDir));
app.use(
  "/api",
  creerRouteur({
    scenario,
    ciblesConnues: ciblesConnues(),
    client,
    model: process.env.MODEL || "claude-sonnet-4-6",
    voix,
  }),
);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Enquête ASCII : http://localhost:${port}`);
});

export { app };
