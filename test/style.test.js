import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const style = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../public/tokens.css", import.meta.url), "utf8");
const designSystem = readFileSync(
  new URL("../public/DESIGN-SYSTEM.md", import.meta.url),
  "utf8",
);

describe("mise en page mobile", () => {
  test("empile la scène, le dialogue et les panneaux latéraux sans réduire la scène", () => {
    expect(style).toMatch(/@media \(max-width: 48rem\)[\s\S]*?#jeu\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?grid-template-rows:\s*auto\s*minmax\(var\(--hauteur-dialogue-mobile-min\), var\(--hauteur-dialogue-mobile\)\)\s*auto;[\s\S]*?grid-template-areas:\s*"scene"\s*"dialogue"\s*"cote";[\s\S]*?align-content:\s*start;/);
    expect(style).toMatch(/@media \(max-width: 48rem\)[\s\S]*?#scene\s*\{[\s\S]*?aspect-ratio:\s*var\(--ratio-scene-mobile\);/);
    expect(style).toMatch(/@media \(max-width: 48rem\)[\s\S]*?#cote\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  });

  test("documente les dimensions mobiles par des tokens", () => {
    expect(tokens).toContain("--ratio-scene-mobile");
    expect(tokens).toContain("--hauteur-dialogue-mobile-min");
    expect(tokens).toContain("--hauteur-dialogue-mobile");
    expect(designSystem).toContain("Mode mobile");
  });
});

describe("plan de la pièce", () => {
  test("met en évidence la seule case correspondant au contexte ouvert", () => {
    expect(style).toMatch(/\.case\.active\s*\{[\s\S]*?color:\s*var\(--c-fond\);[\s\S]*?background:\s*var\(--c-vert\);[\s\S]*?border-color:\s*var\(--c-vert\);/);
    expect(designSystem).toContain('aria-current="location"');
  });
});
