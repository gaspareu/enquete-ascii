// server/voix.js
// Wrapper mince autour de l'API REST ElevenLabs (text-to-speech). Le `fetch` est
// injecté pour rester testable sans réseau (même esprit que server/claude.js).
// La clé API reste côté serveur : ce module n'est jamais chargé par le navigateur.

const BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const FORMAT = "mp3_44100_128";

// Transforme `texte` en audio MP3 via ElevenLabs. Renvoie un Buffer ; lève si la
// réponse HTTP n'est pas OK (la route appelante traduira en 502).
export async function synthetiserVoix(fetchFn, { texte, voiceId, model, apiKey }) {
  const rep = await fetchFn(`${BASE}/${voiceId}?output_format=${FORMAT}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: texte, model_id: model }),
  });
  if (!rep.ok) {
    throw new Error(`ElevenLabs a répondu ${rep.status}`);
  }
  const buffer = await rep.arrayBuffer();
  return Buffer.from(buffer);
}
