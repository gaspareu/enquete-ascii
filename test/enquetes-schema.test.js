import { describe, expect, test } from "vitest";
import { scenario } from "../data/scenario.js";
import helene from "../data/enquetes/helene/scenario.json" with { type: "json" };
import { validerEnquete } from "../server/enquetes-schema.js";

const copie = () => structuredClone(helene);

describe("format versionné des enquêtes", () => {
  test("sérialise Hélène sans perte et valide son graphe historique", () => {
    const { id, schemaVersion, statut, ...contenu } = helene;
    expect({ id, schemaVersion, statut }).toEqual({ id: "helene", schemaVersion: 1, statut: "prete" });
    expect(contenu).toEqual(scenario);
    expect(validerEnquete(helene).erreurs).toEqual([]);
  });

  test("autorise une enquête jouable avec un visage ASCII et sans images", () => {
    const enquete = copie();
    enquete.id = "enquete_ascii";
    enquete.personnage.id = "laurent";
    enquete.personnage.portraits = { neutre: "", mefiant: "", irrite: "", inquiet: "" };
    for (const zone of Object.values(enquete.zones)) zone.illustration = "";
    expect(validerEnquete(enquete).erreurs).toEqual([]);
  });

  test("signale les références manquantes avec leur chemin", () => {
    const enquete = copie();
    enquete.zones.N.objetsCaches.push("fantome");
    enquete.preconditions["examiner:agenda"] = ["flag_inconnu"];
    enquete.connaissances[0].requiert = ["autre_flag_inconnu"];
    enquete.solution.preuvesRequises.push("preuve_absente");
    const chemins = validerEnquete(enquete).erreurs.map(({ path }) => path);
    expect(chemins).toContain("zones.N.objetsCaches.4");
    expect(chemins).toContain("preconditions.examiner:agenda.0");
    expect(chemins).toContain("connaissances.0.requiert.0");
    expect(chemins).toContain("solution.preuvesRequises.3");
  });

  test("détecte un cycle de flags sans amorce et un don impossible", () => {
    const enquete = copie();
    enquete.preconditions["examiner:theiere"] = ["reussite_vue"];
    enquete.preconditions["examiner:distinction"] = ["double_tasse"];
    enquete.objets.grand_cru.ramassable = false;
    const messages = validerEnquete(enquete).erreurs.map(({ message }) => message).join(" ");
    expect(messages).toMatch(/inatteignable|cycle/i);
    expect(messages).toMatch(/ramassable/i);
  });

  test("contrôle la structure de la pièce et du débrief", () => {
    const enquete = copie();
    delete enquete.zones.NO;
    enquete.debrief.questions[0].bareme = [{ note: 1, critere: "x" }];
    enquete.debrief.rangs[0].seuil = 999;
    const chemins = validerEnquete(enquete).erreurs.map(({ path }) => path);
    expect(chemins).toContain("zones.NO");
    expect(chemins).toContain("debrief.questions.0.bareme");
    expect(chemins).toContain("debrief.rangs.0.seuil");
  });

  test("permet une validation de brouillon sans imposer les champs narratifs", () => {
    const resultat = validerEnquete({ id: "nouvelle", schemaVersion: 1, statut: "brouillon" }, { complete: false });
    expect(resultat.erreurs).toEqual([]);
    expect(validerEnquete({ id: "../fuite", schemaVersion: 1 }, { complete: false }).erreurs).not.toEqual([]);
  });

  test("accepte un verrou fondé sur un événement de dialogue déclaré", () => {
    const enquete = copie();
    enquete.connaissances[0].evenementQuandExprime = "aveu_du_personnage";
    enquete.conditionsActions["examiner:agenda"] = { requiertTous: ["fouiller:NE", "aveu_du_personnage"] };
    expect(validerEnquete(enquete).erreurs).toEqual([]);
    enquete.conditionsActions["examiner:agenda"].requiertTous.push("evenement_invente");
    expect(validerEnquete(enquete).erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "conditionsActions.examiner:agenda.requiertTous.2" }),
    ]));
  });

  test("diagnostique les préconditions mal typées sans interrompre la validation", () => {
    const enquete = copie();
    enquete.preconditions["examiner:theiere"] = "double_tasse";
    expect(validerEnquete(enquete).erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "preconditions.examiner:theiere" }),
    ]));
  });

  test("refuse les verrous qui dépendent d'eux-mêmes ou d'une action non signée", () => {
    const enquete = copie();
    enquete.conditionsActions["examiner:agenda"] = { requiertTous: ["examiner:agenda"] };
    enquete.conditionsActions["examiner:theiere"] = { requiertTous: ["dialoguer:laurent"] };
    const chemins = validerEnquete(enquete).erreurs.map(({ path }) => path);
    expect(chemins).toContain("conditionsActions.examiner:agenda.requiertTous.0");
    expect(chemins).toContain("conditionsActions.examiner:theiere.requiertTous.0");
  });

  test("signale un cycle de verrous sans action initiale", () => {
    const enquete = copie();
    enquete.conditionsActions["examiner:agenda"] = { requiertTous: ["examiner:telephone"] };
    enquete.conditionsActions["examiner:telephone"] = { requiertTous: ["examiner:agenda"] };
    expect(validerEnquete(enquete).erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "conditionsActions.examiner:agenda" }),
      expect.objectContaining({ path: "conditionsActions.examiner:telephone" }),
    ]));
  });

  test("refuse un verrou qui attend un dialogue débloqué par cette même action", () => {
    const enquete = copie();
    enquete.connaissances[0].requiert = ["double_tasse"];
    enquete.connaissances[0].evenementQuandExprime = "aveu_theiere";
    enquete.conditionsActions["examiner:theiere"] = { requiertTous: ["aveu_theiere"] };
    expect(validerEnquete(enquete).erreurs.map(({ path }) => path)).toContain("conditionsActions.examiner:theiere");
  });

  test("rejette les portraits inconnus qui pourraient sortir dans la vue publique", () => {
    const enquete = copie();
    enquete.personnage.portraits.notePrivee = "Le secret";
    expect(validerEnquete(enquete).erreurs.map(({ path }) => path)).toContain("personnage.portraits.notePrivee");
  });
});
