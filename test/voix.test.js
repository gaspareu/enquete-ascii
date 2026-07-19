import { describe, test, expect, vi } from "vitest";
import { synthetiserVoix } from "../server/voix.js";

// Faux fetch : renvoie la réponse fournie et journalise l'appel.
function fauxFetch(reponse) {
  return vi.fn(async () => reponse);
}

describe("synthetiserVoix", () => {
  test("appelle l'endpoint ElevenLabs (voix, modèle, clé) et renvoie l'audio en Buffer", async () => {
    const fetchFn = fauxFetch({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const audio = await synthetiserVoix(fetchFn, {
      texte: "Bonjour",
      voiceId: "voix-x",
      model: "eleven_multilingual_v2",
      apiKey: "cle-x",
    });
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect([...audio]).toEqual([1, 2, 3]);

    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toContain("/v1/text-to-speech/voix-x");
    expect(opts.method).toBe("POST");
    expect(opts.headers["xi-api-key"]).toBe("cle-x");
    expect(JSON.parse(opts.body)).toEqual({
      text: "Bonjour",
      model_id: "eleven_multilingual_v2",
    });
  });

  test("statut non-OK : lève une erreur portant le code", async () => {
    const fetchFn = fauxFetch({ ok: false, status: 401 });
    await expect(
      synthetiserVoix(fetchFn, { texte: "x", voiceId: "v", model: "m", apiKey: "k" }),
    ).rejects.toThrow("401");
  });
});
