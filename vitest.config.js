import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Périmètre : la logique métier. On exclut ce qui n'est pas testable en
      // unitaire (bootstrap serveur, code DOM navigateur) et les données pures.
      include: ["server/**/*.js", "public/state.js", "public/render.js"],
      exclude: ["server/index.js"],
      thresholds: {
        // Calibré sur la couverture réelle ; objectif 80 % suivi via BACKLOG.md.
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
