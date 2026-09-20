import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerDepotEnquetes } from "../server/enquetes-store.js";

const temporaires = [];
async function depotTemporaire() {
  const base = await mkdtemp(join(tmpdir(), "enquetes-store-"));
  temporaires.push(base);
  return { base, depot: creerDepotEnquetes({ racine: join(base, "enquetes"), imagesDir: join(base, "images") }) };
}

afterEach(async () => {
  await Promise.all(temporaires.splice(0).map((base) => rm(base, { recursive: true, force: true })));
});

describe("dépôt local d'enquêtes", () => {
  test("crée, sauvegarde atomiquement, retrouve et active une enquête", async () => {
    const { base, depot } = await depotTemporaire();
    const cree = await depot.creer({ id: "mon-enquete" });
    expect(cree.enquete).toMatchObject({ id: "mon-enquete", schemaVersion: 1, statut: "brouillon" });
    const modifie = { ...cree.enquete, titre: "Mon enquête" };
    const sauve = await depot.enregistrer("mon-enquete", modifie);
    expect(sauve.revision).not.toBe(cree.revision);
    expect((await depot.lire("mon-enquete", { inclureBrouillons: true })).enquete.titre).toBe("Mon enquête");
    await expect(depot.lire("mon-enquete")).rejects.toMatchObject({ status: 404 });
    await expect(depot.activer("mon-enquete")).rejects.toMatchObject({ status: 422 });
    expect((await readdir(join(base, "enquetes", "mon-enquete"))).filter((nom) => nom.endsWith(".tmp"))).toEqual([]);
  });

  test("duplique Hélène et copie ses images dans le dossier de la nouvelle enquête", async () => {
    const { depot } = await depotTemporaire();
    const { enquete } = await depot.creer({ id: "ma-copie", sourceId: "helene" });
    expect(enquete.statut).toBe("brouillon");
    expect(enquete.personnage.id).toBe("laurent");
    expect(enquete.zones.N.illustration).toBe("/images/enquetes/ma-copie/nord.jpeg");
    expect(enquete.personnage.portraits.neutre).toBe("/images/enquetes/ma-copie/laurent-neutre.png");
    expect(await depot.lister()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "helene", statut: "prete" })]));
    const introduction = (await depot.lire("helene")).enquete.intro;
    expect((await depot.lister()).find((item) => item.id === "helene").intro).toBe(introduction);
    expect((await depot.activer("ma-copie")).enquete.statut).toBe("prete");
    await expect(depot.enregistrer("helene", enquete)).rejects.toMatchObject({ status: 403 });
  });

  test("duplique un brouillon encore dépourvu de personnage", async () => {
    const { depot } = await depotTemporaire();
    const source = (await depot.creer({ id: "source" })).enquete;
    const { personnage, ...incomplet } = source;
    await depot.enregistrer("source", incomplet);
    const { enquete } = await depot.creer({ id: "copie", sourceId: "source" });
    expect(enquete.personnage.id).toBe("laurent");
    expect(enquete.id).toBe("copie");
    expect(enquete.statut).toBe("brouillon");
  });

  test("active une enquête textuelle sans portraits ni illustrations", async () => {
    const { depot } = await depotTemporaire();
    const { enquete } = await depot.creer({ id: "sans_art", sourceId: "helene" });
    enquete.personnage.portraits = { neutre: "", mefiant: "", irrite: "", inquiet: "" };
    for (const zone of Object.values(enquete.zones)) zone.illustration = "";
    await depot.enregistrer("sans_art", enquete);
    expect((await depot.activer("sans_art")).enquete.statut).toBe("prete");
    expect((await depot.lire("sans_art")).enquete.zones.N.illustration).toBe("");
  });

  test("refuse identifiants dangereux, fichiers liens symboliques et images invalides", async () => {
    const { base, depot } = await depotTemporaire();
    await expect(depot.creer({ id: "../ailleurs" })).rejects.toMatchObject({ status: 400 });
    await depot.creer({ id: "valide" });
    await expect(depot.ajouterImage("valide", { nom: "fuite.svg", mime: "image/svg+xml", donnees: Buffer.from("<svg/>") }))
      .rejects.toMatchObject({ status: 400 });
    await expect(depot.ajouterImage("valide", { nom: "faux.png", mime: "image/png", donnees: Buffer.from("texte") }))
      .rejects.toMatchObject({ status: 400 });
    await symlink(join(base, "enquetes", "valide"), join(base, "enquetes", "raccourci"));
    await expect(depot.lire("raccourci", { inclureBrouillons: true })).rejects.toMatchObject({ status: 400 });
  });

  test("force le statut brouillon et refuse un JSON exécutable ou trop grand", async () => {
    const { base, depot } = await depotTemporaire();
    const { enquete } = await depot.creer({ id: "brouillon" });
    const pret = await depot.enregistrer("brouillon", { ...enquete, statut: "prete" });
    expect(pret.enquete.statut).toBe("brouillon");
    await expect(depot.enregistrer("brouillon", { ...enquete, titre: () => "invalide" }))
      .rejects.toMatchObject({ status: 400 });
    await expect(depot.enregistrer("brouillon", { ...enquete, intro: "x".repeat(2_000_000) }))
      .rejects.toMatchObject({ status: 413 });
    expect(JSON.parse(await readFile(join(base, "enquetes", "brouillon", "scenario.json"), "utf8")).statut).toBe("brouillon");
  });

  test("accepte une vraie image PNG et bloque les clés JSON polluantes", async () => {
    const { base, depot } = await depotTemporaire();
    const { enquete } = await depot.creer({ id: "images" });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    expect(await depot.ajouterImage("images", { nom: "portrait.png", mime: "image/png", donnees: png }))
      .toBe("/images/enquetes/images/portrait.png");
    expect(await readFile(join(base, "images", "images", "portrait.png"))).toEqual(png);
    const contenu = JSON.parse('{"id":"images","schemaVersion":1,"statut":"brouillon","__proto__":{"admin":true}}');
    await expect(depot.enregistrer("images", contenu)).rejects.toMatchObject({ status: 400 });
    expect((await depot.lire("images", { inclureBrouillons: true })).enquete).toEqual(enquete);
  });

  test("inclut les images absentes dans le diagnostic avant l'activation", async () => {
    const { depot } = await depotTemporaire();
    const { enquete } = await depot.creer({ id: "sans-image", sourceId: "helene" });
    enquete.zones.N.illustration = "/images/enquetes/sans-image/absente.png";
    await depot.enregistrer("sans-image", enquete);
    const diagnostic = await depot.verifier("sans-image");
    expect(diagnostic.erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "images" }),
    ]));
    await expect(depot.activer("sans-image")).rejects.toMatchObject({ status: 422 });
  });
});
