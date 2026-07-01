import { describe, test, expect } from "vitest";
import { construitPromptJuge, agregeScore } from "../server/scoring.js";

const scenario = {
  debrief: {
    questions: [
      { id: "qui", question: "Qui ?", bareme: [{ note: 5, critere: "Laurent empoisonneur." }] },
      { id: "mobile", question: "Pourquoi ?", bareme: [{ note: 5, critere: "Jalousie et dettes." }] },
    ],
    rangs: [
      { seuil: 8, titre: "Fin limier" },
      { seuil: 4, titre: "Compétent" },
      { seuil: 0, titre: "Dépassé" },
    ],
  },
};

describe("construitPromptJuge", () => {
  const { system, message } = construitPromptJuge(scenario, [
    { id: "qui", reponse: "Laurent l'a empoisonnée." },
    { id: "mobile", reponse: "" },
  ]);

  test("le système cadre la notation 0-5", () => {
    expect(system).toMatch(/0 à 5/);
  });

  test("le message contient barème, libellé et réponse du joueur", () => {
    expect(message).toContain("Laurent empoisonneur.");
    expect(message).toContain("Laurent l'a empoisonnée.");
    expect(message).toContain("qui");
  });

  test("réponse vide signalée explicitement", () => {
    expect(message).toContain("(aucune réponse)");
  });
});

describe("agregeScore", () => {
  test("somme, max et détails pour chaque question", () => {
    const r = agregeScore(scenario, [
      { id: "qui", note: 5, justification: "ok" },
      { id: "mobile", note: 3, justification: "partiel" },
    ]);
    expect(r.total).toBe(8);
    expect(r.max).toBe(10);
    expect(r.details).toHaveLength(2);
    expect(r.rang).toBe("Fin limier");
  });

  test("clamp les notes hors bornes et coerce en entier", () => {
    const r = agregeScore(scenario, [
      { id: "qui", note: 9, justification: "" },
      { id: "mobile", note: -2, justification: "" },
    ]);
    expect(r.details.find((d) => d.id === "qui").note).toBe(5);
    expect(r.details.find((d) => d.id === "mobile").note).toBe(0);
  });

  test("note par défaut 0 si une question manque dans la sortie du juge", () => {
    const r = agregeScore(scenario, [{ id: "qui", note: 4, justification: "" }]);
    expect(r.total).toBe(4);
    expect(r.details.find((d) => d.id === "mobile").note).toBe(0);
  });

  test("rang plancher si total sous tous les seuils sauf 0", () => {
    const r = agregeScore(scenario, [{ id: "qui", note: 1, justification: "" }]);
    expect(r.rang).toBe("Dépassé");
  });
});
