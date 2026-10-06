// Les erreurs SSE ne coupent pas la lecture : une mémoire et des reçus confirmés
// peuvent suivre avant fin. Une rupture réseau reste une erreur distincte.
import { decoupeTrames } from "./sse.js";
export async function lireEvenementsFlux(rep, recevoir) {
  const lecteur = rep.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "", termine = false;
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const decoupe = decoupeTrames(tampon); tampon = decoupe.reste;
      for (const { event, data } of decoupe.trames) {
        recevoir({ event, contenu: JSON.parse(data) });
        if (event === "fin") { termine = true; return; }
      }
    }
  } catch {
    recevoir({ event: "erreur", contenu: { erreur: "Le personnage est injoignable (réseau).", reseau: true } });
  } finally {
    if (!termine) recevoir({ event: "fin", contenu: {} });
    lecteur.releaseLock();
  }
}
