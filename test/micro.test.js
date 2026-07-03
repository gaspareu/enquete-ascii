// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from "vitest";
import { microDisponible, creerMicro } from "../public/micro.js";

// Faux SpeechRecognition : mémorise la config, expose start/stop et permet de
// déclencher un "result" et un "end" à la main.
function poserFauxReco() {
  const instances = [];
  class FauxReco {
    constructor() {
      this.lang = "";
      this.ecouteurs = {};
      this.start = vi.fn();
      this.stop = vi.fn();
      instances.push(this);
    }
    addEventListener(type, cb) {
      this.ecouteurs[type] = cb;
    }
  }
  window.SpeechRecognition = FauxReco;
  return instances;
}

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe("microDisponible", () => {
  test("vrai quand SpeechRecognition est présent", () => {
    poserFauxReco();
    expect(microDisponible()).toBe(true);
  });
  test("faux quand aucune API n'est disponible", () => {
    expect(microDisponible()).toBe(false);
  });
});

describe("creerMicro", () => {
  test("configure la langue et relaie la transcription puis la fin", () => {
    const instances = poserFauxReco();
    const onTexte = vi.fn();
    const onFin = vi.fn();
    const micro = creerMicro({ langue: "fr-FR", onTexte, onFin });

    micro.demarrer();
    const reco = instances[0];
    expect(reco.lang).toBe("fr-FR");
    expect(reco.start).toHaveBeenCalled();

    reco.ecouteurs.result({ results: [[{ transcript: "bonjour victor" }]] });
    expect(onTexte).toHaveBeenCalledWith("bonjour victor");

    reco.ecouteurs.end();
    expect(onFin).toHaveBeenCalled();

    micro.arreter();
    expect(reco.stop).toHaveBeenCalled();
  });

  test("renvoie null si l'API n'est pas disponible", () => {
    expect(creerMicro({})).toBe(null);
  });
});
