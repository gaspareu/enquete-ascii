import { randomBytes } from "node:crypto";
import { creerApplication } from "./app.js";
import { creerClient } from "./claude.js";

try {
  process.loadEnvFile();
} catch {
  // Les variables d'environnement exportées restent utilisables sans .env.
}

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    client = creerClient();
  } catch (erreur) {
    console.warn("Client Claude non initialisé:", erreur?.message ?? erreur);
  }
} else {
  console.warn("ANTHROPIC_API_KEY absent : l'interprète et le dialogue seront indisponibles.");
}

const voix = process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID
  ? {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
      model: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    }
  : null;

const mode = process.argv.includes("--editor") ? "editeur" : "jeu";
const app = creerApplication({
  mode,
  secret: randomBytes(32),
  client,
  model: process.env.MODEL || "claude-sonnet-4-6",
  modelInterprete: process.env.INTERPRETER_MODEL || process.env.MODEL || "claude-sonnet-4-6",
  voix,
});

const port = Number(process.env.PORT) || 3000;
const hote = mode === "editeur" ? "127.0.0.1" : undefined;
app.listen(port, hote, () => {
  const adresse = mode === "editeur" ? `http://127.0.0.1:${port}/editeur/` : `http://localhost:${port}`;
  console.log(`Enquête ASCII : ${adresse}`);
});

export { app };
