export function normalizeIdentityIntroductionOrder(stored) {
  const events = stored.events || [];
  const entities = stored.entities || [];
  const involves = (event, id) => event.source === id || event.target === id || event.location === id || (event.characters || []).includes(id);

  entities.filter(item => item.kind !== "character").forEach(item => {
    const intro = events.find(event => event.source === item.id && event.type === "note" && (event.identityIntro === true || / is introduced\.$/i.test(event.description || "")));
    if (!intro) return;
    intro.identityIntro = true;
    const sameChapter = events.map((event, index) => ({ event, index, order: Number(event.order) || index + 1 })).filter(entry => entry.event !== intro && entry.event.chapter === intro.chapter);
    const firstUse = sameChapter.filter(entry => involves(entry.event, item.id)).sort((a, b) => a.order - b.order || a.index - b.index)[0];
    if (!firstUse) return;
    const introOrder = Number(intro.order) || events.indexOf(intro) + 1;
    if (introOrder < firstUse.order) return;
    const previous = Math.max(0, ...sameChapter.filter(entry => !involves(entry.event, item.id) && entry.order < firstUse.order).map(entry => entry.order));
    intro.order = previous + (firstUse.order - previous) / 2;
  });
  return stored;
}
