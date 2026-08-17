import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeIdentityIntroductionOrder } from "../src/order.js";

const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const dataApi = await readFile(new URL("../api/data.js", import.meta.url), "utf8");

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const remainder=source.slice(start+10),boundary=remainder.search(/\n(?:async )?function /),next=boundary<0?-1:start+10+boundary;
  return source.slice(start, next < 0 ? source.length : next);
}

test("identity Edit is routed only to the identity form", () => {
  const body = functionBody("loadEntityEditor");
  assert.match(body, /id\?entity\(id\):resolveEntity/);
  assert.match(body, /const form=\$\("#entity-form"\)/);
  assert.match(body, /selectedCreationEvent\?form\.elements\.creationEventDescription:form\.elements\.name/);
  assert.doesNotMatch(body, /#event-form/);
  assert.match(source, /\.edit-identity"\)\.forEach\(button=>button\.onclick=\(\)=>loadEntityEditor\(button\.dataset\.id\)\)/);
  assert.match(source, />Edit identity<\/button>/);
  assert.match(source, /\$\("#load-entity"\)\.onclick=\(\)=>loadEntityEditor\(\)/);
});

test("ordinary event Edit loads only the exact chapter-event form", () => {
  const body = functionBody("loadEventEditor");
  assert.match(body, /if\(isCreationManagedEvent\(record\)\)\{resetEventEditor\(\);loadEntityEditor\(record\.source,\{creationEventId:record\.id\}\);return;\}/);
  assert.match(body, /const form=\$\("#event-form"\)/);
  assert.match(body, /form\.elements\.type\.focus/);
  assert.match(body, /event-edit-mode-note/);
  assert.match(body, /Replace this event/);
  assert.match(source, /\.edit-event"\)\.forEach\(button=>button\.onclick=\(\)=>loadEventEditor\(button\.dataset\.id\)\)/);
  assert.match(source, /creationManaged\?"Edit creation":"Edit event"/);
});

test("creation-generated rows reopen their owning identity form", () => {
  const classification = functionBody("isCreationManagedEvent");
  const loader = functionBody("loadEntityEditor");
  assert.match(classification, /record\.creationManaged===true\|\|record\.identityIntro===true\|\|record\.initial===true/);
  assert.match(loader, /editingCreationEventId/);
  assert.match(loader, /creationEventDescription/);
  assert.match(loader, /Update linked creation record/);
  assert.match(source, /creationManaged:true,description:creationDescription/);
  assert.match(source, /creationManaged:true,initial:true/);
});

test("saving an edited event replaces its original row instead of adding another", () => {
  assert.match(source, /if\(editingId\)\{const index=data\.events\.findIndex\(item=>item\.id===editingId\);if\(index>=0\)data\.events\[index\]=record;\}else data\.events\.push\(record\)/);
  assert.match(functionBody("buildEventRecord"), /previous\?\.chapter===chapter&&previous\?\.order\?previous\.order:nextEventOrder/);
});

test("cultivation editing treats a copied canonical name as no alias", () => {
  const body = functionBody("loadEventEditor");
  assert.match(body, /CULTIVATION_LEVELS\.some/);
  assert.match(body, /isCanonicalCultivationName\?"":record\.value/);
  assert.match(functionBody("buildEventRecord"), /previous\?\.initial===true&&type==="cultivation"/);
});

test("initial cultivation is linked only by its explicit initial flag", () => {
  const loader = functionBody("loadEntityEditor");
  assert.match(loader, /event\.initial===true/);
  assert.doesNotMatch(loader, /event\.chapter===introChapter/);
  assert.match(source, /An equivalent path title cannot be another canonical tier/);
});

test("first cultivation reveal is not presented as a breakthrough from Unrevealed", () => {
  assert.match(functionBody("renderGraph"), /currentEvent\.initial===true&&!priorCultivationLevel\?`Cultivation revealed: \$\{after\}`/);
});

test("cultivation playback highlights gains and losses outside the normal ring", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /isChanged=cultivationReveal&&isOn!==wasOn/);
  assert.match(body, /r\+\(isChanged\?21:15\)/);
  assert.match(body, /cultivation-gain/);
  assert.match(body, /cultivation-loss/);
  assert.match(body, /cultivation-change-label/);
  assert.match(body, /chapterChangedIds/);
});

test("selected volume is restored and cached", () => {
  assert.match(functionBody("restoreActiveVolume"), /localStorage\.getItem\(VIEW_STATE_KEY\)/);
  assert.match(functionBody("cacheActiveVolume"), /localStorage\.setItem\(VIEW_STATE_KEY/);
  assert.match(functionBody("bootstrap"), /restoreActiveVolume\(\)/);
  assert.match(source, /volumeSelect\.addEventListener\("change",\(\)=>\{[^\n]*cacheActiveVolume\(\)/);
});

test("an organization introduction is placed before its first connection", () => {
  const story = {
    entities: [
      { id: "maker", kind: "character", name: "Treasure Manufacturer" },
      { id: "elysian", kind: "organization", name: "Elysian network" }
    ],
    events: [
      { id: "appearance", chapter: 1, order: 1, type: "appearance", source: "maker" },
      { id: "cultivation", chapter: 1, order: 1.01, type: "cultivation", source: "maker" },
      { id: "membership", chapter: 1, order: 2, type: "membership", source: "maker", target: "elysian" },
      { id: "intro", chapter: 1, order: 3, type: "note", source: "elysian", identityIntro: true, description: "Elysian network is introduced." }
    ]
  };
  normalizeIdentityIntroductionOrder(story);
  const intro = story.events.find(event => event.id === "intro");
  const membership = story.events.find(event => event.id === "membership");
  const cultivation = story.events.find(event => event.id === "cultivation");
  assert.ok(intro.order > cultivation.order, "the character's earlier facts must remain earlier");
  assert.ok(intro.order < membership.order, "the organization must appear immediately before its first connection");
});

test("admin chapter table uses playback order", () => {
  assert.match(source, /sort\(\(a,b\)=>a\.chapter-b\.chapter\|\|\(a\.order\|\|0\)-\(b\.order\|\|0\)/);
});

test("an empty hosted store publishes the authenticated browser copy", () => {
  assert.match(functionBody("loadData"), /response\.status===404\?"empty":"unavailable"/);
  assert.match(functionBody("bootstrap"), /isUploadRoute&&adminAuthenticated&&hostedDataStatus==="empty"\)publishData\(\)/);
});

test("private Blob storage is used for both reads and writes", () => {
  assert.match(dataApi, /get\(PATHNAME, \{ access: "private" \}\)/);
  assert.match(dataApi, /put\(PATHNAME, serialized, \{ access: "private"/);
  assert.doesNotMatch(dataApi, /access: "public"/);
});

test("editing creates a local draft and publishing performs the only write", () => {
  const saveBody = functionBody("saveData");
  const publishBody = functionBody("publishData");
  assert.match(saveBody, /localStorage\.setItem\(PUBLISH_DIRTY_KEY,"1"\)/);
  assert.doesNotMatch(saveBody, /fetch\(/);
  assert.match(publishBody, /fetch\("\/api\/data",\{method:"PUT"/);
  assert.match(source, /\$\("#publish-data"\)\.onclick=publishData/);
});

test("public story data is CDN cached to reduce Blob reads", () => {
  assert.match(dataApi, /public, s-maxage=60, stale-while-revalidate=300/);
});
