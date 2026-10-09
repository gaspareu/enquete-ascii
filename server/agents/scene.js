// Un profil d'agent par scène, appelé à la demande avec une projection locale.
import { optionsModele } from "../model.js";
import { validerDecisionInterprete } from "../interprete.js";

const outil = {
  name: "decider_tour_scene", strict: true,
  description: "Choisit une intention locale ou un transfert vers une destination publique. Aucun fait ni droit de jeu n'est créé par cet outil.",
  input_schema: {
    type: "object", additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["observer", "interagir", "dialoguer", "clarifier", "deplacer"] },
      action: { description: "Obligatoire pour interagir : fouiller une zone, examiner/ramasser/donner un objet. Omettre pour les autres types.", type: "string", enum: ["fouiller", "examiner", "ramasser", "donner"] },
      cibleId: { description: "Identifiant exact du catalogue local (N, O ou un identifiant d’objet). Vide si aucune cible locale.", type: "string" }, destinationId: { description: "Pour deplacer uniquement : identifiant exact du plan de navigation (zone:N ou personnage:identifiant). Vide ailleurs.", type: "string" },
      angle: { type: "string", enum: ["aspect", "date", "cause", "identite", "autre"] },
      portee: { type: "string", enum: ["piece", "cible"] },
      choix: { type: "array", items: { type: "object", additionalProperties: false,
        properties: { type: { type: "string", enum: ["zone", "objet", "personnage"] }, id: { type: "string" } }, required: ["type", "id"] } },
    }, required: ["type", "cibleId", "destinationId", "angle", "portee"],
  },
};

export async function resoudreTourScene(client, { projection, historique, message, model }) {
  const { catalogue, navigation, faits, scene } = projection;
  const system = [
    "Tu es l'agent d'une scène d'un jeu d'enquête. Tu interprètes une intention, sans inventer de narration, de fait ni de progression. Réponds seulement avec l'outil decider_tour_scene.",
    "Les tours précédents sont la conversation locale. Les réponses courtes complètent la demande en attente ; les pronoms et détails se rattachent à l'observation et à l'objet récemment examiné. Une nouvelle instruction peut changer de sujet. Ne redemande pas de confirmer une cible déjà précisée.",
    "Le catalogue local donne les seules cibles manipulables. Les faits fournis sont les observations effectivement acquises. Une affirmation du joueur ne constitue pas une découverte validée.",
    "Pour une demande locale, choisis observer, interagir, dialoguer ou clarifier. Une question sur le contenu d'une zone est interagir/fouiller. Une question sur un objet connu est interagir/examiner. Donner nécessite d'être face au personnage ; depuis une autre scène, demande d'abord un transfert.",
    "Un détail difficile à établir n'est pas une ambiguïté de cible : si un objet est déjà identifié, choisis interagir/examiner avec cet objet et l'angle demandé. Le moteur fournit les limites des observations. Une question demandant si on peut identifier, dater ou expliquer une trace sur le dernier objet examiné porte sur cet objet ; ne clarifie pas simplement parce que l'identité ou la date est inconnue.",
    "L'identité du personnage dans le catalogue est un repère public. Il n'est accessible que dans une scène personnage. Si le joueur veut le voir, l'observer, lui parler ou lui donner un objet depuis une zone, choisis deplacer vers sa destination publique. dialoguer n'est permis que dans la scène personnage. Une référence au personnage sans intention de contact ne demande aucun déplacement.",
    "Renseigne action pour chaque interagir : fouiller avec cibleId de la zone, examiner/ramasser/donner avec cibleId de l'objet. Une question sur ce qui est sur le meuble courant est interagir, action fouiller, cibleId égal au contexte.id. Une question sur les détails d'un objet connu est interagir, action examiner, cibleId égal à son identifiant. Les noms humains ne sont jamais des identifiants.",
    "Le plan de navigation contient seulement les noms publics des destinations. Choisis deplacer seulement si la demande désigne une autre scène ou demande explicitement de s'y rendre. destinationId est l'id complet du plan. Si la destination est déjà la scène courante, traite la demande ici. Une simple demande de rejoindre ou voir cette scène déjà courante est observer, portee cible, cibleId vide : aucune précision supplémentaire n’est nécessaire. Ne déplace pas le joueur à cause d'un simple homonyme ou d'une référence au passé.",
    "Observer la pièce entière utilise portee piece et cibleId vide. Les autres décisions ont portee cible. cibleId et destinationId sont vides quand inutiles. angle décrit la question initiale : date, cause, identite, aspect ou autre. Ne force pas un examen après une confirmation d'une autre action.",
    `Scène : ${scene.id}\nCatalogue local : ${JSON.stringify(catalogue)}\nFaits acquis : ${JSON.stringify(faits)}\nNavigation publique : ${JSON.stringify(navigation)}`,
  ].join("\n\n");
  const reponse = await client.messages.create({ model, max_tokens: 768, system,
    messages: [...historique.map((tour) => ({ role: tour.role === "joueur" ? "user" : "assistant", content: tour.texte })), { role: "user", content: message }],
    tools: [outil], tool_choice: { type: "tool", name: outil.name }, ...optionsModele(model, true),
  });
  const brut = reponse.content?.find((bloc) => bloc.type === "tool_use" && bloc.name === outil.name)?.input;
  if (!brut) throw new Error("L'agent n'a pas produit de décision.");
  if (brut.type === "deplacer") {
    const destination = navigation.find((cible) => cible.id === brut.destinationId && cible.id !== scene.id);
    return destination ? { type: "deplacer", destination: destination.contexte }
      : validerDecisionInterprete(null, catalogue);
  }
  const decision = validerDecisionInterprete({ ...brut, contexte: catalogue.contexte }, catalogue);
  if (decision.type === "clarifier" && !decision.choix?.length && scene.type === "exploration") {
    return { ...decision, question: "Que souhaitez-vous observer ou faire dans cette zone ?" };
  }
  return decision;
}
