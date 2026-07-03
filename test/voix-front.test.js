import { describe, test, expect, vi } from "vitest";
import { creerModeVocal } from "../public/voix.js";

const repAudio = (ok = true) => ({ ok, blob: async () => new Blob(["audio"]) });

describe("creerModeVocal", () => {
  test("inactif par défaut : dire() ne fetch pas et ne joue pas", async () => {
    const fetchFn = vi.fn(async () => repAudio());
    const jouer = vi.fn();
    const mv = creerModeVocal({ fetchFn, jouer });
    expect(mv.estActif()).toBe(false);
    await mv.dire("Bonjour");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(jouer).not.toHaveBeenCalled();
  });

  test("basculer active/désactive et renvoie le nouvel état", () => {
    const mv = creerModeVocal({ fetchFn: vi.fn(), jouer: vi.fn() });
    expect(mv.basculer()).toBe(true);
    expect(mv.estActif()).toBe(true);
    expect(mv.basculer()).toBe(false);
  });

  test("actif : dire() poste le texte à /api/voix puis joue le blob", async () => {
    const fetchFn = vi.fn(async () => repAudio());
    const jouer = vi.fn();
    const mv = creerModeVocal({ fetchFn, jouer });
    mv.basculer();
    await mv.dire("Bonjour à vous.");
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/voix");
    expect(JSON.parse(opts.body)).toEqual({ texte: "Bonjour à vous." });
    expect(jouer).toHaveBeenCalledOnce();
  });

  test("actif mais texte vide : no-op", async () => {
    const fetchFn = vi.fn(async () => repAudio());
    const mv = creerModeVocal({ fetchFn, jouer: vi.fn() });
    mv.basculer();
    await mv.dire("");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("réponse non-OK : dégradation silencieuse (pas de lecture, pas de throw)", async () => {
    const fetchFn = vi.fn(async () => repAudio(false));
    const jouer = vi.fn();
    const mv = creerModeVocal({ fetchFn, jouer });
    mv.basculer();
    await expect(mv.dire("Bonjour")).resolves.toBeUndefined();
    expect(jouer).not.toHaveBeenCalled();
  });

  test("panne réseau : avalée (le texte reste affiché, pas de throw)", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("réseau");
    });
    const mv = creerModeVocal({ fetchFn, jouer: vi.fn() });
    mv.basculer();
    await expect(mv.dire("Bonjour")).resolves.toBeUndefined();
  });
});
