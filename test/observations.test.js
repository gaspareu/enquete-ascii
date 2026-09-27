import { describe, test, expect } from "vitest";
import { composerObservation } from "../server/observations.js";

const observations = {
  feuilles: "Les feuilles se recourbent sur les bords.",
  terre: "La terre est sèche sous la surface.",
};
const limites = { date: "Rien ne permet de dire depuis quand elle est ainsi." };

describe("composerObservation", () => {
  test("répond avec un détail approuvé et l'incertitude déclarée pour l'objet", () => {
    const resultat = composerObservation({
      texteVisible: "Une plante aux feuilles flétries.", observations, limites,
      angle: "date", examenNumero: 1,
    });

    expect(resultat).toContain("Une plante aux feuilles flétries.");
    expect(resultat).toContain(observations.feuilles);
    expect(resultat).toContain(limites.date);
  });

  test("une question répétée choisit un autre détail sans changer le fait établi", () => {
    const resultat = composerObservation({
      texteVisible: "Une plante aux feuilles flétries.", observations, limites,
      angle: "date", examenNumero: 2,
    });

    expect(resultat).toContain(observations.terre);
    expect(resultat).not.toContain(observations.feuilles);
    expect(resultat).toContain(limites.date);
  });

  test("un angle falsifié ne peut faire apparaître qu'un détail autorisé", () => {
    const resultat = composerObservation({
      texteVisible: "Une plante aux feuilles flétries.", observations, limites,
      angle: "secret", examenNumero: 1,
    });

    expect(resultat).toBe("Une plante aux feuilles flétries.\nLes feuilles se recourbent sur les bords.");
  });
});
