import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // `all` instrumente tout le périmètre `include`, même les fichiers qu'aucun
      // test n'importe : un fichier source sans test apparaît à 0 % et fait
      // échouer le seuil. Sous vitest 4 le défaut a changé, donc on le force.
      // NB : vitest 4 masque du rapport (et du total) les fichiers couverts à
      // 100 % sur toutes les métriques — gênant à lire, mais le gate reste sain
      // car un fichier sous-testé n'est jamais à 100 %, donc toujours compté.
      all: true,
      reporter: ["text", "text-summary"],
      // Périmètre : la logique métier, y compris le modèle pur de l'atelier.
      // On exclut le bootstrap serveur, le code DOM navigateur et les données pures.
      include: [
        "server/**/*.js",
        "editeur/state.js",
        "editeur/graph.js",
        "public/state.js",
        "public/render.js",
        "public/game.js",
        "public/voix.js",
        "public/micro.js",
      ],
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
