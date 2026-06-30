// Parseur de trames Server-Sent Events, pur (sans DOM). Le flux arrive par chunks
// arbitraires : on accumule un tampon, on en extrait les trames complètes (séparées
// par une ligne vide « \n\n ») et on renvoie le reste non terminé à reporter.

function parseTrame(bloc) {
  let event = "message";
  const datas = [];
  for (const ligne of bloc.split("\n")) {
    if (ligne.startsWith("event:")) event = ligne.slice(6).trim();
    else if (ligne.startsWith("data:")) datas.push(ligne.slice(5).replace(/^ /, ""));
  }
  if (datas.length === 0) return null; // commentaire / heartbeat : rien à livrer
  return { event, data: datas.join("\n") };
}

export function decoupeTrames(tampon) {
  const morceaux = tampon.split("\n\n");
  const reste = morceaux.pop(); // dernier segment : trame incomplète (ou "" si fin nette)
  const trames = morceaux.map(parseTrame).filter((t) => t !== null);
  return { trames, reste };
}
