import { describe, test, expect } from "vitest";
import { evaluerAccusation } from "../server/accusation.js";

const scenario = {
  solution: { coupable: true, preuvesRequises: ["code_lu"] },
};

describe("evaluerAccusation", () => {
  test("gagne : bon verdict ET preuves réunies", () => {
    const r = evaluerAccusation(scenario, { verdict: true, flags: ["code_lu"] });
    expect(r.gagne).toBe(true);
  });

  test("perd : bon verdict mais preuves manquantes", () => {
    const r = evaluerAccusation(scenario, { verdict: true, flags: [] });
    expect(r.gagne).toBe(false);
  });

  test("perd : preuves réunies mais mauvais verdict", () => {
    const r = evaluerAccusation(scenario, { verdict: false, flags: ["code_lu"] });
    expect(r.gagne).toBe(false);
  });

  test("renvoie un message explicatif", () => {
    const r = evaluerAccusation(scenario, { verdict: true, flags: ["code_lu"] });
    expect(typeof r.message).toBe("string");
    expect(r.message.length).toBeGreaterThan(0);
  });
});
