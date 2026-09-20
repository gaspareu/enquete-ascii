export function construireGraphe(enquete) {
  const parFlag = new Map();
  for (const [geste, id] of Object.entries(enquete.declencheurs ?? {})) {
    if (!parFlag.has(id)) parFlag.set(id, { id, branches: [], requiert: new Set() });
    const noeud = parFlag.get(id);
    const requiert = Array.isArray(enquete.preconditions?.[geste]) ? enquete.preconditions[geste] : [];
    noeud.branches.push({ geste, requiert: [...requiert] });
    for (const flag of requiert) noeud.requiert.add(flag);
  }
  const noeuds = [...parFlag.values()].map(({ id, branches, requiert }) => ({
    id, gestes: branches.map(({ geste }) => geste), branches, requiert: [...requiert],
    effets: {
      connaissances: (enquete.connaissances ?? []).filter((item) => item.requiert?.includes(id)).map((item) => item.id),
      pistes: (enquete.pistesInterrogatoire ?? []).filter((item) => item.requiert?.includes(id)).map((item) => item.question),
    },
  }));
  const liens = noeuds.flatMap((noeud) => noeud.branches.flatMap(({ geste, requiert }) =>
    requiert.map((de) => ({ de, vers: noeud.id, via: geste }))));
  return { noeuds, liens };
}
