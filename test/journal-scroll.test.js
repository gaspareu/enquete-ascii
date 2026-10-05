// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { creerSuiviJournal } from "../public/journal-scroll.js";

function preparer() {
  const journal = document.createElement("div");
  const bouton = document.createElement("button");
  let hauteur = 1000;
  Object.defineProperties(journal, { scrollHeight: { get: () => hauteur }, clientHeight: { get: () => 200 } });
  const suivi = creerSuiviJournal({ journal, bouton });
  return { journal, bouton, suivi, agrandir: () => { hauteur += 100; }, relire: () => { journal.scrollTop = 100; journal.dispatchEvent(new Event("scroll")); } };
}

describe("relecture du journal", () => {
  test("suit une réponse quand le joueur est au bas du journal", () => {
    const { journal, bouton, suivi, agrandir } = preparer();
    suivi.modifier(agrandir, { nouveau: true });
    expect(journal.scrollTop).toBe(1100);
    expect(bouton.hidden).toBe(true);
  });
  test("préserve la relecture pendant les fragments et signale une nouvelle réponse", () => {
    const { journal, bouton, suivi, agrandir, relire } = preparer();
    relire();
    suivi.modifier(agrandir, { nouveau: true });
    suivi.modifier(agrandir, { nouveau: true });
    expect(journal.scrollTop).toBe(100);
    expect(bouton.hidden).toBe(false);
    bouton.click();
    expect(journal.scrollTop).toBe(1200);
    expect(bouton.hidden).toBe(true);
    suivi.modifier(agrandir, { nouveau: true });
    expect(journal.scrollTop).toBe(1300);
  });
  test("l’attente seule ne déclenche pas Nouvelle réponse", () => {
    const { journal, bouton, suivi, agrandir, relire } = preparer();
    relire();
    suivi.modifier(agrandir);
    expect(journal.scrollTop).toBe(100);
    expect(bouton.hidden).toBe(true);
  });
  test("remonter jusqu’au bas réactive le suivi et masque le bouton", () => {
    const { journal, bouton, suivi, agrandir, relire } = preparer();
    relire();
    suivi.modifier(agrandir, { nouveau: true });
    journal.scrollTop = 900;
    journal.dispatchEvent(new Event("scroll"));
    expect(bouton.hidden).toBe(true);
    suivi.modifier(agrandir, { nouveau: true });
    expect(journal.scrollTop).toBe(1200);
  });
});
