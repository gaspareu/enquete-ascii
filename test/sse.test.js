import { describe, test, expect } from "vitest";
import { decoupeTrames } from "../public/sse.js";

describe("decoupeTrames", () => {
  test("trame complète : renvoie {event, data} et un reste vide", () => {
    const { trames, reste } = decoupeTrames('event: delta\ndata: {"texte":"a"}\n\n');
    expect(trames).toEqual([{ event: "delta", data: '{"texte":"a"}' }]);
    expect(reste).toBe("");
  });

  test("plusieurs trames dans un même chunk", () => {
    const chunk = 'event: delta\ndata: 1\n\nevent: fin\ndata: {}\n\n';
    const { trames, reste } = decoupeTrames(chunk);
    expect(trames).toEqual([
      { event: "delta", data: "1" },
      { event: "fin", data: "{}" },
    ]);
    expect(reste).toBe("");
  });

  test("trame partielle : reportée dans le reste, pas dans les trames", () => {
    const { trames, reste } = decoupeTrames('event: delta\ndata: 1\n\nevent: fi');
    expect(trames).toEqual([{ event: "delta", data: "1" }]);
    expect(reste).toBe("event: fi");
  });

  test("event par défaut à 'message' si absent", () => {
    const { trames } = decoupeTrames("data: salut\n\n");
    expect(trames).toEqual([{ event: "message", data: "salut" }]);
  });

  test("plusieurs lignes data jointes par un saut de ligne (spec SSE)", () => {
    const { trames } = decoupeTrames("data: ligne1\ndata: ligne2\n\n");
    expect(trames).toEqual([{ event: "message", data: "ligne1\nligne2" }]);
  });

  test("ligne de commentaire / heartbeat sans data : ignorée", () => {
    const { trames, reste } = decoupeTrames(":keepalive\n\n");
    expect(trames).toEqual([]);
    expect(reste).toBe("");
  });
});
