import { describe, expect, test } from "vitest";
import { pistesPourFlags } from "../server/pistes.js";

const scenario = {
  pistesInterrogatoire: [
    { question: "Question A", requiert: ["a"] },
    { question: "Question B", requiert: ["a", "b"] },
    { question: "Question C", requiert: ["c"], retireSi: ["resolu"] },
    { question: "Question D", requiert: ["d"] },
    { question: "Question E", requiert: ["e"] },
  ],
};

describe("pistesPourFlags", () => {
  test("ne retourne que les pistes dont tous les prérequis sont acquis", () => {
    expect(pistesPourFlags(scenario, ["a", "c"])).toEqual(["Question A", "Question C"]);
  });

  test("retire une piste résolue, borne le résultat et ne renvoie pas de métadonnée", () => {
    expect(pistesPourFlags(scenario, ["a", "b", "c", "d", "e", "resolu"])).toEqual([
      "Question A",
      "Question B",
      "Question D",
    ]);
  });

  test("tolère un scénario sans pistes", () => {
    expect(pistesPourFlags({}, ["a"])).toEqual([]);
  });
});
