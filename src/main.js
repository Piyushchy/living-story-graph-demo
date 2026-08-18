import "./style.css";
import { normalizeIdentityIntroductionOrder } from "./order.js";

const COLORS = { friendly: "#45c98b", hostile: "#ef5d67", neutral: "#9aa9c0" };
const MARKED_EVENT_TYPES = new Set(["cultivation","relationship","status","alias","display_name","identity_parent","membership","movement","residency","location_parent","organization_location"]);
const EVENT_TYPE_COLORS = { cultivation:"#e8ad3c",relationship:"#45c98b",status:"#ef5d67",alias:"#9f7aea",display_name:"#7dd3fc",identity_parent:"#c084fc",membership:"#4f8df7",movement:"#22c7b8",residency:"#55d6a7",location_parent:"#f2c95e",organization_location:"#c084fc",meeting:"#27b8b8",awareness:"#36a8d4",mention:"#7f8da3",appearance:"#ef71b8",corpse_appearance:"#ef5d67",note:"#edf2ff" };
const STORAGE_KEY = "living-story-graph-demo-v1";
const VIEW_STATE_KEY = "living-story-graph-view-state-v1";
const PUBLISH_DIRTY_KEY = "living-story-graph-publish-dirty-v1";
const CHAPTER_REF_TOGGLE_KEY = "living-story-graph-chapter-refs-v1";
const CHAPTER_REF_HINT_SEEN_KEY = "living-story-graph-chapter-ref-hint-seen-v1";
const SVG_NS = "http://www.w3.org/2000/svg";
const CULTIVATION_LEVELS = ["Mortal","Body Tempering","Qi Training","Foundation Establishment","Golden Core","Nascent Soul","Earth Immortal","Heaven Immortal","Celestial Immortal","Demi Dao Lord","Dao Lord","Above Dao Lord"];

const sampleData = {
  schemaVersion: 5,
  novel: "The Innkeeper — graph demonstration",
  volumes: [
    { id: "v1", name: "Volume 1", from: 1, to: 40 },
    { id: "v2", name: "Volume 2", from: 41, to: 80 },
    { id: "v3", name: "Volume 3", from: 81, to: 120 }
  ],
  cultivationLevels: CULTIVATION_LEVELS,
  entities: [
    { id: "inn", kind: "organization", name: "Midnight Inn", intro: 1, description: "A growing inter-realm sanctuary and organization." },
    { id: "jotun", kind: "organization", name: "Jotun Empire", intro: 30, description: "A major empire active across the story." },
    { id: "garden", kind: "organization", name: "Primordial Garden", intro: 45, description: "A primordial domain connected to Eclipse." },
    { id: "inn-estate", kind: "location", locationType: "Site", name: "Midnight Inn Estate", intro: 1, description: "The complete grounds and buildings controlled by the Midnight Inn." },
    { id: "inn-lobby", kind: "location", locationType: "Room", name: "Midnight Inn Lobby", intro: 1, description: "The Inn's central arrival hall and meeting place." },
    { id: "garden-realm", kind: "location", locationType: "Realm", name: "Primordial Garden Realm", intro: 45, description: "An ancient garden realm where primordial beings gather." },
    { id: "lex", kind: "character", name: "Lex", gender: "male", mentioned: 1, appeared: 1, description: "Founder and central figure of the Midnight Inn." },
    { id: "mary", kind: "character", name: "Mary", gender: "female", mentioned: 8, appeared: 8, description: "An administrator and adviser within the Inn." },
    { id: "gerald", kind: "character", name: "Gerald", gender: "male", mentioned: 18, appeared: 22, description: "A charming host known for welcoming guests." },
    { id: "luthor", kind: "character", name: "Luthor", gender: "male", mentioned: 18, appeared: 18, description: "A reliable but dangerous member of the Inn." },
    { id: "eclipse", kind: "character", name: "Eclipse", gender: "female", mentioned: 45, appeared: 58, description: "An ancient primordial queen whose identity resists perception." }
  ],
  events: [
    { id: "e1", chapter: 1, type: "cultivation", source: "lex", level: 1, value: "Mortal", description: "Lex is recorded at Mortal cultivation." },
    { id: "e2", chapter: 1, type: "status", source: "lex", value: "alive", description: "Lex is alive." },
    { id: "e3", chapter: 1, type: "alias", source: "lex", value: "Innkeeper", description: "The identity Innkeeper becomes known." },
    { id: "e4", chapter: 1, type: "membership", source: "lex", target: "inn", value: "Founder", action: "join", description: "Lex establishes the Midnight Inn." },
    { id: "e5", chapter: 8, type: "cultivation", source: "mary", level: 4, value: "Foundation Establishment", description: "Mary is recorded at Foundation Establishment cultivation." },
    { id: "e6", chapter: 8, type: "status", source: "mary", value: "alive", description: "Mary is alive." },
    { id: "e7", chapter: 8, type: "membership", source: "mary", target: "inn", value: "Administrator", action: "join", description: "Mary joins the Inn as administrator." },
    { id: "e8", chapter: 8, type: "meeting", source: "lex", target: "mary", description: "Lex and Mary meet." },
    { id: "e9", chapter: 8, type: "relationship", source: "lex", target: "mary", value: "friendly", description: "Lex and Mary establish a friendly relationship." },
    { id: "e10", chapter: 18, type: "cultivation", source: "luthor", level: 6, value: "Nascent Soul", description: "Luthor is recorded at Nascent Soul cultivation." },
    { id: "e11", chapter: 18, type: "status", source: "luthor", value: "alive", description: "Luthor is alive." },
    { id: "e12", chapter: 18, type: "membership", source: "luthor", target: "inn", value: "Staff", action: "join", description: "Luthor joins the Inn staff." },
    { id: "e13", chapter: 18, type: "meeting", source: "lex", target: "luthor", description: "Lex and Luthor meet." },
    { id: "e14", chapter: 18, type: "relationship", source: "lex", target: "luthor", value: "friendly", description: "Lex and Luthor begin as friendly allies." },
    { id: "e15", chapter: 18, type: "mention", source: "gerald", description: "Gerald is mentioned for the first time." },
    { id: "e16", chapter: 22, type: "cultivation", source: "gerald", level: 1, value: "Mortal", description: "Gerald is recorded at Mortal cultivation." },
    { id: "e17", chapter: 22, type: "status", source: "gerald", value: "alive", description: "Gerald is alive." },
    { id: "e18", chapter: 22, type: "membership", source: "gerald", target: "inn", value: "Host", action: "join", description: "Gerald joins the Midnight Inn as a host." },
    { id: "e19", chapter: 22, type: "meeting", source: "mary", target: "gerald", description: "Mary and Gerald meet." },
    { id: "e20", chapter: 22, type: "relationship", source: "mary", target: "gerald", value: "neutral", description: "Mary and Gerald begin with a neutral relationship." },
    { id: "e21", chapter: 22, type: "meeting", source: "gerald", target: "luthor", description: "Gerald and Luthor meet." },
    { id: "e22", chapter: 22, type: "relationship", source: "gerald", target: "luthor", value: "neutral", description: "Gerald and Luthor have a neutral relationship." },
    { id: "e23", chapter: 30, type: "membership", source: "luthor", target: "jotun", value: "Envoy", action: "join", description: "Luthor becomes an envoy of the Jotun Empire." },
    { id: "e24", chapter: 35, type: "alias", source: "gerald", value: "Golf Cart Gerald", description: "The identity Golf Cart Gerald becomes known." },
    { id: "e25", chapter: 45, type: "mention", source: "eclipse", description: "Eclipse is mentioned but has not appeared." },
    { id: "e26", chapter: 45, type: "awareness", source: "eclipse", target: "gerald", description: "Eclipse mentions Gerald and knows he exists." },
    { id: "e27", chapter: 45, type: "relationship", source: "gerald", target: "eclipse", value: "neutral", description: "The known relation between Gerald and Eclipse is neutral." },
    { id: "e28", chapter: 45, type: "cultivation", source: "lex", level: 6, value: "Nascent Soul", description: "Lex reaches Nascent Soul cultivation." },
    { id: "e29", chapter: 48, type: "alias", source: "luthor", value: "Prince of Hell", description: "The identity Prince of Hell becomes known." },
    { id: "e30", chapter: 50, type: "awareness", source: "gerald", target: "eclipse", description: "Gerald becomes aware of Eclipse; awareness is mutual." },
    { id: "e31", chapter: 50, type: "relationship", source: "lex", target: "luthor", value: "hostile", description: "Lex and Luthor's relationship turns hostile." },
    { id: "e32", chapter: 55, type: "awareness", source: "eclipse", target: "lex", description: "Eclipse becomes aware of Lex, but Lex is unaware of Eclipse." },
    { id: "e33", chapter: 58, order: 3, type: "appearance", source: "eclipse", location: "garden-realm", description: "Eclipse appears for the first time." },
    { id: "e34", chapter: 58, order: 4, type: "cultivation", source: "eclipse", location: "garden-realm", level: 9, value: "Primordial", description: "Eclipse is revealed at Primordial cultivation, equivalent to Celestial Immortal." },
    { id: "e35", chapter: 58, order: 5, type: "status", source: "eclipse", location: "garden-realm", value: "alive", description: "Eclipse is alive." },
    { id: "e36", chapter: 58, order: 6, type: "alias", source: "eclipse", location: "garden-realm", value: "Primordial Queen", description: "The identity Primordial Queen becomes known." },
    { id: "e37", chapter: 58, order: 7, type: "membership", source: "eclipse", target: "garden", location: "garden-realm", value: "Queen", action: "join", description: "Eclipse is revealed as Queen of the Primordial Garden." },
    { id: "e38", chapter: 58, order: 8, type: "meeting", source: "gerald", target: "eclipse", location: "garden-realm", description: "Gerald and Eclipse meet; awareness arrows become a normal relation line." },
    { id: "e39", chapter: 58, order: 9, type: "meeting", source: "lex", target: "eclipse", location: "garden-realm", description: "Lex meets Eclipse without prior mutual awareness." },
    { id: "e40", chapter: 58, order: 10, type: "relationship", source: "lex", target: "eclipse", location: "garden-realm", value: "hostile", description: "Lex and Eclipse begin with a hostile relationship." },
    { id: "loc-1", chapter: 1, order: 1, type: "movement", source: "lex", location: "inn-lobby", description: "Lex enters the Midnight Inn Lobby." },
    { id: "loc-2", chapter: 8, order: 1, type: "movement", source: "mary", location: "inn-lobby", description: "Mary begins working from the Midnight Inn Lobby." },
    { id: "loc-3", chapter: 18, order: 1, type: "movement", source: "luthor", location: "inn-lobby", description: "Luthor arrives in the Midnight Inn Lobby." },
    { id: "loc-4", chapter: 22, order: 1, type: "movement", source: "gerald", location: "inn-lobby", description: "Gerald takes up his post in the Midnight Inn Lobby." },
    { id: "loc-5", chapter: 45, order: 1, type: "movement", source: "eclipse", location: "garden-realm", description: "Eclipse is present somewhere within the Primordial Garden Realm." },
    { id: "loc-6", chapter: 58, order: 1, type: "movement", source: "gerald", location: "garden-realm", description: "Gerald enters the Primordial Garden Realm." },
    { id: "loc-7", chapter: 58, order: 2, type: "movement", source: "lex", location: "garden-realm", description: "Lex enters the Primordial Garden Realm." },
    { id: "loc-8", chapter: 58, order: 99, type: "movement", source: "lex", location: "inn-lobby", description: "Lex returns to the Midnight Inn Lobby later in the chapter." },
    { id: "orgloc-1", chapter: 1, order: 2, type: "organization_location", source: "inn", location: "inn-lobby", value: "Headquarters", action: "open", description: "The Midnight Inn Lobby serves as the Midnight Inn's headquarters." },
    { id: "orgloc-2", chapter: 45, order: 2, type: "organization_location", source: "garden", location: "garden-realm", value: "Headquarters", action: "open", description: "The Primordial Garden Realm is the Primordial Garden's headquarters." },
    { id: "hier-1", chapter: 1, order: 3, type: "location_parent", source: "inn-lobby", location: "inn-estate", action: "add", description: "The Midnight Inn Lobby is inside the Midnight Inn Estate." },
    { id: "home-1", chapter: 1, order: 4, type: "residency", source: "lex", location: "inn-estate", value: "Home", action: "begin", description: "Lex makes the Midnight Inn Estate his home." },
    { id: "home-2", chapter: 8, order: 4, type: "residency", source: "mary", location: "inn-estate", value: "Resident staff", action: "begin", description: "Mary begins residing at the Midnight Inn Estate as resident staff." },
    { id: "home-3", chapter: 22, order: 4, type: "residency", source: "gerald", location: "inn-estate", value: "Resident staff", action: "begin", description: "Gerald begins residing at the Midnight Inn Estate as resident staff." },
    { id: "home-4", chapter: 58, order: 11, type: "residency", source: "eclipse", location: "garden-realm", value: "Domain", action: "begin", description: "The Primordial Garden Realm is Eclipse's permanent domain." },
    { id: "e41", chapter: 62, type: "relationship", source: "mary", target: "gerald", value: "friendly", description: "Mary and Gerald's relationship becomes friendly." },
    { id: "e42", chapter: 64, type: "alias", source: "lex", value: "Keeper of the Midnight Inn", description: "Keeper of the Midnight Inn becomes a known identity." },
    { id: "e43", chapter: 65, type: "cultivation", source: "luthor", level: 8, value: "Heaven Immortal", description: "Luthor reaches Heaven Immortal cultivation." },
    { id: "e44", chapter: 71, type: "alias", source: "luthor", value: "The Reliable One", description: "The Reliable One becomes a known identity." },
    { id: "e45", chapter: 74, type: "alias", source: "eclipse", value: "Queen of Eclipsecrawlers", description: "Queen of Eclipsecrawlers becomes a known identity." },
    { id: "e46", chapter: 75, type: "cultivation", source: "mary", level: 7, value: "Ascendant", description: "Mary reaches Ascendant cultivation, equivalent to Earth Immortal." },
    { id: "e47", chapter: 90, type: "cultivation", source: "gerald", level: 6, value: "Nascent Soul", description: "Gerald reaches Nascent Soul cultivation." },
    { id: "e48", chapter: 92, type: "alias", source: "lex", value: "Leo", description: "Leo becomes a known identity of Lex." },
    { id: "e49", chapter: 95, type: "cultivation", source: "lex", level: 8, value: "Heaven Immortal", description: "Lex reaches Heaven Immortal cultivation." },
    { id: "e50", chapter: 97, type: "relationship", source: "lex", target: "eclipse", value: "friendly", description: "Lex and Eclipse's relationship becomes friendly." },
    { id: "e51", chapter: 99, type: "alias", source: "luthor", value: "Warden of Abaddon", description: "Warden of Abaddon becomes a known identity." },
    { id: "e52", chapter: 103, type: "alias", source: "eclipse", value: "She Who Cannot Be Remembered", description: "A new identity of Eclipse becomes known." },
    { id: "e53", chapter: 105, type: "membership", source: "luthor", target: "inn", value: "Staff", action: "leave", description: "Luthor's active Inn staff membership ends." },
    { id: "e54", chapter: 108, type: "status", source: "luthor", value: "dead", description: "Luthor's status changes to dead." }
  ]
};

const deepClone = value => JSON.parse(JSON.stringify(value));
const isUploadRoute = location.pathname.replace(/\/+$/, "") === "/upload";
let adminAuthenticated = false;
let data = deepClone(sampleData);
let selectedId = null;
let openProfileId = null;
let locationPovId = null;
let currentChapter = 1;
let currentActionIndex = 0;
let chapterAutoplayTimer=null,expandedChapter=null;
let activeVolume = "";
let activeView = "graph";
let wheelDelta = 0;
let eventDrafts = [];
let hostedDataStatus = "checking";
const profileLoaders = import.meta.glob("./profiles/*.js");
const profilePromises = new Map();

const app = document.querySelector("#app");
app.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="brand"><span class="brand-mark"></span><div><strong><span class="brand-long">Living </span>Story Graph</strong><small id="novel-name"></small></div></div>
      <div class="chapter-ref-toggle-wrap">
        <button type="button" id="toggle-chapter-refs" class="chapter-ref-toggle" data-chapter-ref-toggle aria-pressed="false" title="Hover marked text to reveal its chapter"><span aria-hidden="true">🔖</span> Chapter refs</button>
        <div id="chapter-ref-hint" class="chapter-ref-hint" hidden role="status">
          <p><strong>Chapter references</strong> — some text here links out to another page, and some cites the chapter it's from. Turn this on, then hover marked text to see which. Press <kbd>Alt</kbd> to toggle it quickly.</p>
          <button type="button" id="dismiss-chapter-ref-hint" aria-label="Dismiss">×</button>
        </div>
      </div>
      ${isUploadRoute?"":'<nav class="tabs" aria-label="Main navigation"><button class="tab active" data-view="graph">Public graph</button></nav>'}
    </header>
    <main>
      <section id="graph-view" class="view active">
        <div class="graph-page">
          <div class="controls">
            <label class="field"><span>Find character, organization, location, or alias</span><input id="search" list="entity-options" placeholder="Start typing…"><datalist id="entity-options"></datalist></label>
            <label class="field"><span>Volume</span><select id="volume"></select></label>
            <div class="field timeline-field"><span class="chapter-label"><span>Chapter <strong id="chapter-value">80</strong></span><span id="event-position"></span><button type="button" id="collapse-chapter-events" class="collapse-chapter-events" hidden>Collapse events ×</button></span><div class="range-row"><button class="step" id="previous" aria-label="Previous stop">−</button><div class="main-range-wrap"><input id="timeline" type="range"><div id="timeline-marks" class="main-timeline-marks"></div></div><button class="step" id="next" aria-label="Next stop">+</button></div></div>
          </div>
          <div class="graph-layout" id="graph-layout">
            <div class="graph-card"><svg id="graph" viewBox="0 0 720 520" role="img" aria-label="Chapter-aware novel relationship graph"></svg><div id="slider-onboarding" class="slider-onboarding" hidden><span class="slider-pointer" aria-hidden="true">↑</span><strong>Use the slider</strong></div><div class="graph-zoom-controls"><button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="zoom-reset" aria-label="Reset view">⟲</button><button type="button" id="zoom-out" aria-label="Zoom out">−</button></div></div>
            <aside class="side">
              <div class="mobile-panel-tabs" role="tablist" aria-label="Graph information">
                <button class="mobile-panel-tab active" data-panel="info" role="tab">Info</button>
                <button class="mobile-panel-tab" data-panel="events" role="tab">Events</button>
                <button class="mobile-panel-tab" data-panel="legend" role="tab">Legend</button>
              </div>
              <section id="summary" class="side-card summary mobile-active" data-panel-content="info"><div class="empty">Select a character, organization, or location. Double-click a node for full details.</div></section>
              <section class="side-card events-card" data-panel-content="events"><div class="events-head"><strong id="events-title">Chapter events</strong><span id="events-count"></span></div><ul id="events-list" class="events-list"></ul></section>
              <section class="side-card mobile-legend" data-panel-content="legend" aria-label="Mobile graph legend">
                <span><i class="dot female"></i>Female</span><span><i class="dot male"></i>Male</span><span><i class="hex"></i>Organization</span><span><i class="pin"></i>Location region</span>
                <span><i class="line-key friendly"></i>Friendly</span><span><i class="line-key hostile"></i>Hostile</span><span><i class="line-key neutral"></i>Neutral / awareness</span><span><i class="line-key clone"></i>Clone / avatar</span><span><i class="line-key member"></i>Membership</span><span><i class="line-key location"></i>Travel / activity</span><span><i class="line-key residence"></i>Residence</span><span><i class="line-key hierarchy"></i>Inside location</span><span><i class="line-key organization-location"></i>Organization place</span>
                <span><i class="ring mentioned"></i>Mentioned only</span><span><i class="ring unknown"></i>Unknown status</span><span><i class="ring"></i>Alive</span><span><i class="ring dead"></i>Dead</span><span><i class="diamond"></i>Alias count</span><span><i class="corona-key"></i>Cultivation level</span>
              </section>
            </aside>
          </div>
          <div class="legend desktop-legend" aria-label="Graph legend">
            <span><i class="dot female"></i>Female</span><span><i class="dot male"></i>Male</span><span><i class="hex"></i>Organization</span><span><i class="pin"></i>Location region</span>
            <span><i class="line-key friendly"></i>Friendly</span><span><i class="line-key hostile"></i>Hostile</span><span><i class="line-key neutral"></i>Neutral / awareness arrow</span><span><i class="line-key clone"></i>Clone / avatar</span><span><i class="line-key member"></i>Membership</span><span><i class="line-key location"></i>Travel / activity</span><span><i class="line-key residence"></i>Residence</span><span><i class="line-key hierarchy"></i>Inside location</span><span><i class="line-key organization-location"></i>Organization place</span>
            <span><i class="ring mentioned"></i>Mentioned only</span><span><i class="ring unknown"></i>Unknown status</span><span><i class="ring"></i>Alive</span><span><i class="ring dead"></i>Dead</span><span><i class="diamond"></i>Alias count</span><span><i class="corona-key"></i>Cultivation level</span>
          </div>
        </div>
      </section>
      <section id="admin-view" class="view">
        <div class="admin-page">
          <div class="admin-intro"><div><h1>Story data publisher</h1><p id="publishing-description">Checking whether changes can be published for everyone…</p></div><div class="admin-actions"><span class="hosted-save-state" id="hosted-save-state">Checking storage…</span><button class="button primary" id="publish-data" type="button">Publish changes</button><button class="button ghost" id="export-data">Export JSON</button><label class="button ghost" for="import-data">Import JSON</label><input id="import-data" type="file" accept="application/json" hidden><button class="button danger" id="reset-data">Reset sample</button><button class="button danger destructive" id="clear-all-data">Delete all story data</button></div></div>
          <div class="storage-warning" id="storage-warning" hidden><strong>Not publishing to the public graph</strong><span>Changes are currently saved only in this browser. Incognito and other visitors will not see them until Vercel Blob is connected to this project.</span><a href="https://vercel.com/piyush-chaudharys-projects/living-story-graph/stores" target="_blank" rel="noopener noreferrer">Open Vercel Storage ↗</a></div>
          <div class="entry-guide"><article><span>1</span><div><strong>Create the identity</strong><p>Use the first name or descriptor readers actually know.</p></div></article><article><span>2</span><div><strong>Write the wiki profile</strong><p>Biography, portrait, powers, achievements and permanent facts.</p></div></article><article><span>3</span><div><strong>Add chapter events</strong><p>Names, status, clones, locations and every later change belong on the timeline.</p></div></article></div>
          <form id="volume-form" class="admin-card volume-editor">
            <div class="volume-editor-heading"><div><span class="editor-kicker">Story structure</span><h2>Manage volumes and chapter ranges</h2><p>Add every volume in reading order. The first and last chapter decide which events appear inside it.</p></div><button class="button primary" type="submit">Save all volumes</button></div>
            <div class="volume-columns" aria-hidden="true"><span>Order</span><span>Volume name</span><span>First chapter</span><span>Last chapter</span><span>Actions</span></div>
            <div id="volume-rows" class="volume-rows"></div>
            <p id="volume-error" class="volume-error" role="alert"></p>
            <div class="form-actions volume-actions"><button class="button ghost" id="add-volume" type="button">＋ Add another volume</button><button class="button primary" type="submit">Save all volumes</button></div>
          </form>
          <form id="chapter-links-form" class="admin-card">
            <div class="volume-editor-heading"><div><span class="editor-kicker">Chapter references</span><h2>Chapter links</h2><p>Every “Chapter N” mention across the whole site — profiles, events, achievements, and inline <code>[[12]]</code> markers in prose — resolves through this, so you only ever paste a chapter's URL once.</p></div><button class="button primary" type="submit">Save chapter links</button></div>
            <p id="missing-chapter-links" class="storage-warning" hidden><strong>Missing links</strong><span></span></p>
            <label class="field"><span>Explicit chapter links <small>(one per line: chapter number, then its URL — takes priority below)</small></span><textarea id="chapter-sources-text" name="sources" rows="4" placeholder="1 | https://www.webnovel.com/book/.../chapter-title_123456
2 | https://www.webnovel.com/book/.../chapter-title_789012"></textarea></label>
            <label class="field"><span>Fallback URL template <small>(only for sites where chapter URLs are just a number — optional)</small></span><input id="chapter-url-template" name="template" type="text" placeholder="https://your-site.com/chapter-{n}"></label>
            <p id="chapter-links-error" class="volume-error" role="alert"></p>
          </form>
          <form id="chapter-quick-add-form" class="admin-card">
            <div class="volume-editor-heading"><div><span class="editor-kicker">Quick add</span><h2>Add or update one chapter link</h2><p>Faster than scrolling the list above for a single chapter. Typing an existing chapter number fills in its current link so you can review or replace it.</p></div><button class="button primary" type="submit">Save</button></div>
            <div class="form-grid">
              <label class="field"><span>Chapter number</span><input id="quick-add-chapter" type="number" min="1" step="1" required></label>
              <label class="field"><span>URL</span><input id="quick-add-url" type="url" required placeholder="https://..."></label>
            </div>
            <p id="quick-add-error" class="volume-error" role="alert"></p>
          </form>
          <div class="admin-grid">
            <form id="entity-form" class="admin-card"><div class="admin-card-heading"><h2 id="entity-form-title">Create character, organization, or location</h2><div class="manage-row"><input id="manage-entity" list="admin-entity-options" placeholder="Load an existing identity"><button class="button ghost" id="load-entity" type="button">Load</button></div></div><p id="creation-edit-note" class="event-edit-mode-note" hidden><strong>Editing a creation-generated row.</strong> These facts were made by this identity form, so saving here updates the original linked row instead of creating a chapter event.</p><input name="editingId" type="hidden"><input name="editingCreationEventId" type="hidden"><div class="form-grid">
              <label class="field"><span>Type</span><select name="kind"><option value="character">Character</option><option value="organization">Organization</option><option value="location">Location</option></select></label>
              <label class="field"><span>Initial public name or descriptor</span><input name="name" required placeholder="E.g. Unknown Manufacturer"><small class="field-note">You may also paste <code>[[Visible name|https://fandom-page]]</code>; it will be separated automatically.</small></label>
              <label class="field" id="entity-gender-field"><span>Gender</span><select name="gender"><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label>
              <label class="field" id="entity-location-type-field" hidden><span>Place level / type</span><select name="locationType"><option value="Universe">Universe</option><option value="Realm">Realm</option><option value="World">World / planet</option><option value="Continent">Continent</option><option value="Country">Country / empire</option><option value="State">State / province</option><option value="City">City / settlement</option><option value="District">District</option><option value="Site" selected>Site / estate</option><option value="Building">Building</option><option value="Room">Room / area</option><option value="Other">Other</option></select></label>
              <label class="field" id="entity-mentioned-field"><span>First mentioned chapter (optional)</span><input name="mentioned" type="number" min="1" placeholder="Leave blank if they appear directly"></label>
              <label class="field" id="entity-appeared-field"><span id="entity-appeared-label">First appearance chapter (optional)</span><input name="appeared" type="number" min="1" placeholder="Leave blank if they have not appeared yet"></label>
              <label class="field" id="entity-initial-cultivation-field"><span>Known cultivation when introduced (optional)</span><select name="initialLevel"><option value="">Unknown / not revealed</option>${CULTIVATION_LEVELS.map((name,index)=>`<option value="${index+1}">${name}</option>`).join("")}</select><small class="field-note">Unknown adds no cultivation ring. Choose Mortal only when the novel confirms it.</small></label>
              <label class="field" id="entity-initial-cultivation-alias-field"><span>Equivalent path title (optional)</span><input name="initialCultivationAlias" placeholder="E.g. Earthen Deity"><small class="field-note">Synchronized to the canonical tier selected above.</small></label>
              <label class="field span-2" id="entity-creation-source-field"><span>Introduction chapter source URL / citation (optional)</span><input name="creationSourceUrl" type="url" placeholder="https://www.webnovel.com/book/…"><small class="field-note">Applied to the appearance and initial-cultivation facts generated by this creation record.</small></label>
              <label class="field span-2" id="entity-creation-description-field" hidden><span>Selected creation-row wording</span><textarea name="creationEventDescription" rows="3"></textarea><small class="field-note">This changes only the creation row you clicked. Name, chapter, presence and initial cultivation remain controlled by the fields above.</small></label>
              <label class="field span-2"><span>Description</span><textarea name="description" rows="3" placeholder="Short spoiler-aware profile"></textarea></label>
            </div><p class="form-help" id="entity-help">Presence: enter First mentioned only when the character is named before appearing. Enter First appearance when they physically enter the story. Either field can be used by itself.</p><div class="form-actions"><button class="button danger" id="delete-entity" type="button" hidden>Delete identity</button><button class="button ghost" id="cancel-entity-edit" type="button" hidden>Cancel edit</button><button class="button primary" id="save-entity" type="submit">Create and add to graph</button></div></form>
            <form id="event-form" class="admin-card"><h2 id="event-form-title">Add chapter changes</h2><p id="event-edit-mode-note" class="event-edit-mode-note" hidden><strong>Editing this exact saved event.</strong> Saving replaces only the row you clicked; it does not create a new event or edit the identity form.</p><input name="editingId" type="hidden"><div class="form-grid">
              <label class="field"><span>Event type</span><select name="type"><option value="mention">Mentioned in this chapter</option><option value="appearance">Appears alive in this chapter</option><option value="corpse_appearance">Dead body / corpse appears</option><option value="display_name">Public/display name changes</option><option value="alias">Alias revealed</option><option value="identity_parent">Clone / avatar / identity hierarchy</option><option value="movement">Character travels / changes location</option><option value="residency">Character residence / long-term base</option><option value="location_parent">Location placed inside another location</option><option value="cultivation">Cultivation change</option><option value="status">Status becomes known or changes</option><option value="gender">Gender becomes known or changes</option><option value="age">Age stated or changes</option><option value="awareness">Awareness / mentioned by</option><option value="meeting">Meeting</option><option value="relationship">Relationship change</option><option value="membership">Organization membership</option><option value="organization_location">Organization headquarters / branch</option><option value="note">Story event</option></select></label>
              <label class="field"><span>Chapter</span><input name="chapter" type="number" min="1" value="80" required></label>
              <label class="field" id="event-source-field"><span id="event-source-label">Character</span><input name="source" list="admin-entity-options" required placeholder="Type a name or alias"><datalist id="admin-entity-options"></datalist></label>
              <label class="field" id="event-location-field"><span id="event-location-label">Where this happened (optional)</span><input name="location" list="location-options" placeholder="Type a location"><datalist id="location-options"></datalist></label>
              <label class="field" id="event-target-field"><span id="event-target-label">Second character</span><input name="target" list="admin-entity-options"></label>
              <label class="field" id="event-value-field"><span id="event-value-label">Value</span><input name="value"><datalist id="location-role-options"><option value="Headquarters"></option><option value="Branch"></option><option value="Base"></option><option value="Territory"></option><option value="Outpost"></option></datalist><datalist id="residence-role-options"><option value="Home"></option><option value="Permanent resident"></option><option value="Resident staff"></option><option value="Long-term guest"></option><option value="Camp"></option><option value="Domain"></option></datalist></label>
              <label class="field" id="event-level-field"><span>Canonical cultivation tier</span><select name="level"><option value="">Choose a tier…</option>${CULTIVATION_LEVELS.map((name,index)=>`<option value="${index+1}">${index+1}. ${name}</option>`).join("")}</select><small class="field-note">The tier controls graph size and progression automatically.</small></label>
              <label class="field" id="event-action-field"><span id="event-action-label">Organization membership change</span><select name="action"><option value="reveal">Existing membership is revealed</option><option value="join">Joins in this chapter</option><option value="leave">Leaves / membership ends</option></select></label>
              <label class="field span-2"><span>Additional chapter details (optional)</span><textarea name="description" rows="3" placeholder="Example: Lex obtained [[Protos Energy|https://wiki.example.com/protos-energy]]"></textarea></label>
              <label class="field span-2"><span>Chapter source URL / citation (optional)</span><input name="sourceUrl" type="url" placeholder="https://the-innkeeper.fandom.com/wiki/Chapter_1"><small class="field-note">Shown publicly as a clickable “Chapter 1 ↗” citation beside this event.</small></label>
            </div><p class="form-help" id="event-help">Mention records that the character exists without making them physically appear.</p><div class="form-actions"><button class="button ghost" id="cancel-event-edit" type="button" hidden>Cancel edit</button><button class="button ghost" id="queue-event" type="button">Add to chapter batch</button><button class="button primary" id="save-event" type="submit">Save this change</button></div>
            <section id="event-batch" class="event-batch" hidden><div class="event-batch-heading"><div><span class="editor-kicker">Unsaved</span><strong>Changes for chapter <span id="event-batch-chapter"></span></strong></div><span id="event-batch-count"></span></div><ul id="event-batch-list"></ul><div class="form-actions"><button class="button ghost" id="clear-event-batch" type="button">Clear batch</button><button class="button primary" id="save-event-batch" type="button">Save all changes</button></div></section></form>
          </div>
          <form id="profile-form" class="admin-card profile-editor">
            <div class="editor-heading"><div><span class="editor-kicker">Fandom-style content</span><h2>Wiki profile editor</h2><p>Select an existing identity. Add a chapter citation to any written line with <code>text | chapter</code>, or make it clickable with <code>text | chapter | https://chapter-link</code>. Wiki links still use <code>[[visible text|https://wiki-link]]</code>.</p></div><div class="editor-actions"><button class="button danger" id="clear-profile" type="button">Clear profile</button><button class="button primary" type="submit">Save wiki profile</button></div></div>
            <div class="form-grid profile-form-grid">
              <label class="field"><span>Character, organization, or location</span><input name="entity" list="admin-entity-options" required placeholder="Type a canonical name or alias"></label>
              <label class="field"><span>Fandom / wiki page URL</span><input name="wikiUrl" type="url" placeholder="https://the-innkeeper.fandom.com/wiki/Character_Name"><small class="field-note">The identity’s name in details will link to this page.</small></label>
              <label class="field"><span>Page subtitle / primary title</span><input name="subtitle" placeholder="Founder of the Midnight Inn"></label>
              <label class="field"><span>Portrait image URL</span><input name="image" type="url" placeholder="https://…"></label>
              <label class="field"><span>Signature quote</span><input name="quote" placeholder="A memorable quote"></label>
              <label class="field character-profile-field"><span>Species</span><input name="species" placeholder="Human"></label>
              <label class="field character-profile-field"><span>Roles and titles (comma separated)</span><input name="roles" placeholder="Innkeeper, Founder, Cultivator"></label>
              <label class="field span-2"><span>Biography / history</span><textarea name="history" rows="5" placeholder="Write the complete spoiler-aware history visible on the page."></textarea></label>
              <label class="field character-profile-field"><span>Appearance</span><textarea name="appearance" rows="4" placeholder="A slightly chubby man | 1 | https://chapter-link"></textarea><small class="field-note">Finish a line with <strong>| chapter</strong>; add <strong>| URL</strong> after it to make the Chapter badge clickable.</small></label>
              <label class="field character-profile-field"><span>Personality</span><textarea name="personality" rows="4" placeholder="Temperament, behavior, motivations and habits."></textarea></label>
              <label class="field character-profile-field"><span>Known abilities — one per line</span><textarea name="abilities" rows="5" placeholder="Inn administration&#10;Cultivation&#10;Negotiation"></textarea></label>
              <label class="field character-profile-field"><span>Achievements — achievement | chapter | source URL</span><textarea name="achievements" rows="5" placeholder="Founded the Midnight Inn | 1 | https://example.com/chapter-1&#10;Reached Nascent Soul | 120"></textarea><small class="field-note">Chapter and URL are optional. Existing plain achievement lines still work.</small></label>
              <label class="field organization-profile-field"><span id="profile-purpose-label">Organization purpose</span><textarea name="purpose" rows="4" placeholder="Purpose, goals and place in the story."></textarea></label>
              <label class="field organization-profile-field"><span id="profile-traits-label">Defining traits — one per line</span><textarea name="traits" rows="4" placeholder="Neutral sanctuary&#10;Inter-realm hospitality"></textarea></label>
              <label class="field"><span>Trivia — one item per line</span><textarea name="trivia" rows="5" placeholder="Interesting detail&#10;Recurring joke&#10;Behind-the-scenes note"></textarea></label>
              <label class="field"><span>Extra infobox facts — Label: Value</span><textarea name="facts" rows="5" placeholder="Hobby: Game development&#10;Weapon: Midnight blade&#10;Home realm: Earth"></textarea></label>
            </div>
          </form>
          <section class="admin-card data-card"><div class="summary-title"><div><h2>All identities</h2><small>Characters, organizations, and locations exist independently from their events.</small></div><span class="chip" id="entity-count"></span></div><div class="table-wrap entity-data-table"><table><thead><tr><th>Name</th><th>Type</th><th>Introduced</th><th>Events</th><th></th></tr></thead><tbody id="entity-table"></tbody></table></div></section>
          <section class="admin-card data-card"><div class="summary-title"><h2>All chapter events</h2><span class="chip" id="data-count"></span></div><div class="table-wrap event-data-table"><table><thead><tr><th>Chapter</th><th>Type</th><th>Entities</th><th>Description</th><th></th></tr></thead><tbody id="event-table"></tbody></table></div></section>
        </div>
      </section>
    </main>
    <dialog id="profile-modal" class="modal"><div class="modal-head"><h2 id="profile-title"></h2><button class="button" id="close-profile">Close</button></div><div id="profile-body" class="modal-body"></div></dialog>
    ${isUploadRoute?`<section id="admin-login" class="admin-login" hidden><form id="admin-login-form"><span class="brand-mark"></span><p class="editor-kicker">Protected publisher</p><h1>Open the story editor</h1><p>Enter the administrator password to upload or change public story data.</p><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required autofocus></label><p id="admin-login-error" class="login-error" role="alert"></p><button class="button primary" type="submit">Unlock editor</button><a href="/">Return to public graph</a></form></section>`:""}
    <div id="toast" class="toast"></div>
  </div>`;

const $ = selector => document.querySelector(selector);
const graph = $("#graph");
const timeline = $("#timeline");
const volumeSelect = $("#volume");
const searchInput = $("#search");

function parseIdentityName(value){const raw=String(value||"").trim(),match=raw.match(/^\[\[([^\]|]+?)\|([^\]]+?)\]\]$/);if(!match)return {name:raw,wikiUrl:""};const wikiUrl=safeExternalUrl(match[2].trim());return wikiUrl?{name:match[1].trim(),wikiUrl}:{name:match[1].trim(),wikiUrl:""};}
function normalizeIdentityWikiNames(stored){(stored.entities||[]).forEach(item=>{const parsed=parseIdentityName(item.name);if(parsed.name&&parsed.name!==item.name){item.name=parsed.name;if(parsed.wikiUrl)item.profile={...(item.profile||{}),wikiUrl:item.profile?.wikiUrl||parsed.wikiUrl};}});return stored;}
function normalizeInitialCultivationOrder(stored){const entities=new Map((stored.entities||[]).map(item=>[item.id,item]));(stored.events||[]).filter(event=>event.type==="cultivation"&&event.initial===true).forEach(event=>{const presence=(stored.events||[]).filter(candidate=>candidate.source===event.source&&candidate.chapter===event.chapter&&["mention","appearance","corpse_appearance"].includes(candidate.type)).sort((a,b)=>(a.order||0)-(b.order||0)).at(-1);if(presence)event.order=(Number(presence.order)||1)+.01;if(/\bis introduced at\b/i.test(event.description||"")){const name=entities.get(event.source)?.name||"The character",shown=String(event.value||cultivationCanonical(event));event.description=`${name}'s cultivation is revealed as ${shown}${shown.toLowerCase()===cultivationCanonical(event).toLowerCase()?"":`, equivalent to ${cultivationCanonical(event)}`}.`;}});return stored;}
function migrateCultivationData(stored){
  normalizeIdentityWikiNames(stored);
  normalizeInitialCultivationOrder(stored);
  normalizeIdentityIntroductionOrder(stored);
  if((stored.schemaVersion||1)>=5){stored.cultivationLevels=deepClone(CULTIVATION_LEVELS);return stored;}
  const legacyByName={mortal:{level:1,value:"Mortal"},foundation:{level:4,value:"Foundation Establishment"},nascent:{level:6,value:"Nascent Soul"},ascendant:{level:7,value:"Ascendant"},immortal:{level:8,value:"Heaven Immortal"},sovereign:{level:9,value:"Sovereign"},primordial:{level:9,value:"Primordial"},transcendent:{level:10,value:"Transcendent"}},legacyByLevel={1:1,2:1,3:4,4:6,5:7,6:8,7:9,8:9,9:10};
  (stored.events||[]).filter(event=>event.type==="cultivation").forEach(event=>{const mapped=legacyByName[String(event.value||"").trim().toLowerCase()];event.level=mapped?.level||legacyByLevel[Number(event.level)]||Math.max(1,Math.min(CULTIVATION_LEVELS.length,Number(event.level)||1));if(mapped)event.value=mapped.value;});
  stored.cultivationLevels=deepClone(CULTIVATION_LEVELS);stored.schemaVersion=5;return stored;
}
function cultivationCanonical(event){return CULTIVATION_LEVELS[Math.max(0,(Number(event?.level)||1)-1)]||"Unknown tier";}
function cultivationDisplay(event){return String(event?.value||"").trim()||cultivationCanonical(event);}
function cultivationLabel(event){const shown=cultivationDisplay(event),canonical=cultivationCanonical(event);return shown.toLowerCase()===canonical.toLowerCase()?shown:`${shown} · equivalent to ${canonical}`;}

function loadLocalData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return deepClone(sampleData);
    stored.entities = (stored.entities || []).map(item => {
      const sample = sampleData.entities.find(candidate => candidate.id === item.id);
      return sample ? {...sample,...item} : item;
    });
    stored.cultivationLevels ||= deepClone(sampleData.cultivationLevels);
    if((stored.schemaVersion||1)<2){
      const isBundledDemo=stored.novel===sampleData.novel&&stored.entities.some(item=>item.id==="lex")&&stored.entities.some(item=>item.id==="eclipse");
      if(isBundledDemo){const entityIds=new Set(stored.entities.map(item=>item.id));sampleData.entities.filter(item=>item.kind==="location"&&!entityIds.has(item.id)).forEach(item=>stored.entities.push(deepClone(item)));const sampleEvents=new Map(sampleData.events.map(event=>[event.id,event]));stored.events=(stored.events||[]).map(event=>{const sample=sampleEvents.get(event.id);return sample?.location&&!event.location?{...event,location:sample.location,order:sample.order}:event;});const eventIds=new Set(stored.events.map(event=>event.id));sampleData.events.filter(event=>event.type==="movement"&&!eventIds.has(event.id)).forEach(event=>stored.events.push(deepClone(event)));}
      stored.schemaVersion=2;localStorage.setItem(STORAGE_KEY,JSON.stringify(stored));
    }
    if((stored.schemaVersion||1)<3){
      const isBundledDemo=stored.novel===sampleData.novel&&stored.entities.some(item=>item.id==="lex")&&stored.entities.some(item=>item.id==="eclipse");
      if(isBundledDemo){const eventIds=new Set((stored.events||[]).map(event=>event.id));sampleData.events.filter(event=>event.type==="organization_location"&&!eventIds.has(event.id)).forEach(event=>stored.events.push(deepClone(event)));}
      stored.schemaVersion=3;localStorage.setItem(STORAGE_KEY,JSON.stringify(stored));
    }
    if((stored.schemaVersion||1)<4){
      const isBundledDemo=stored.novel===sampleData.novel&&stored.entities.some(item=>item.id==="lex")&&stored.entities.some(item=>item.id==="eclipse");
      stored.entities.forEach(item=>{if(item.kind==="location"&&!item.locationType)item.locationType=sampleData.entities.find(sample=>sample.id===item.id)?.locationType||"Other";});
      if(isBundledDemo){const entityIds=new Set(stored.entities.map(item=>item.id));sampleData.entities.filter(item=>item.id==="inn-estate"&&!entityIds.has(item.id)).forEach(item=>stored.entities.push(deepClone(item)));const eventIds=new Set((stored.events||[]).map(event=>event.id));sampleData.events.filter(event=>["residency","location_parent"].includes(event.type)&&!eventIds.has(event.id)).forEach(event=>stored.events.push(deepClone(event)));}
      stored.schemaVersion=4;localStorage.setItem(STORAGE_KEY,JSON.stringify(stored));
    }
    const migrated=migrateCultivationData(stored);localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;
  }
  catch { return deepClone(sampleData); }
}
async function loadData() {
  if(localStorage.getItem(PUBLISH_DIRTY_KEY)==="1"){hostedDataStatus="dirty";return loadLocalData();}
  try { const response=await fetch("/api/data");if(response.ok){const hosted=await response.json();if(Array.isArray(hosted.entities)&&Array.isArray(hosted.events)){hostedDataStatus="connected";const migrated=migrateCultivationData(hosted);if(isUploadRoute)localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}}hostedDataStatus=response.status===404?"empty":"unavailable"; }
  catch {hostedDataStatus="unavailable";}
  return loadLocalData();
}
function updatePublishingStatus(errorMessage=""){const state=$("#hosted-save-state"),warning=$("#storage-warning"),description=$("#publishing-description"),button=$("#publish-data");if(!state||!warning||!description||!button)return;const connected=hostedDataStatus==="connected",dirty=["dirty","empty"].includes(hostedDataStatus),failed=["unavailable","error"].includes(hostedDataStatus);state.textContent=connected?"Published":dirty?"Unpublished changes":"Storage unavailable";state.title=connected?"Public visitors have this version":dirty?"Drafts are safely stored in this browser":errorMessage||"Publishing is unavailable";state.classList.toggle("error",failed);state.classList.toggle("dirty",dirty);warning.hidden=!failed;description.textContent=connected?"Public graph is up to date.":dirty?"Draft saved locally. Continue editing, then publish the whole dataset once.":"Draft saved locally, but public storage could not be reached.";button.disabled=connected;button.textContent=connected?"Published":"Publish changes";}
var dataVersion=0;
function saveData() {
  normalizeIdentityIntroductionOrder(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(PUBLISH_DIRTY_KEY,"1");hostedDataStatus="dirty";updatePublishingStatus();
  dataVersion++;
}
async function publishData(){if(!isUploadRoute||!adminAuthenticated){toast("Unlock the editor before publishing");return;}normalizeIdentityIntroductionOrder(data);localStorage.setItem(STORAGE_KEY,JSON.stringify(data));const state=$("#hosted-save-state"),button=$("#publish-data");if(state){state.textContent="Publishing…";state.classList.add("saving");}if(button)button.disabled=true;try{const response=await fetch("/api/data",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||"Publish failed");localStorage.removeItem(PUBLISH_DIRTY_KEY);hostedDataStatus="connected";updatePublishingStatus();toast("Published once for all public visitors");}catch(error){hostedDataStatus="error";updatePublishingStatus(error.message);toast(`Not published: ${error.message}`);}finally{if(state)state.classList.remove("saving");if(button&&hostedDataStatus!=="connected")button.disabled=false;}}
function cacheActiveVolume(){try{localStorage.setItem(VIEW_STATE_KEY,JSON.stringify({activeVolume,currentChapter,currentActionIndex,openProfileId}));}catch{}}
function restoreActiveVolume(){let cached={};try{cached=JSON.parse(localStorage.getItem(VIEW_STATE_KEY)||"{}");}catch{}activeVolume=data.volumes.some(volume=>volume.id===cached.activeVolume)?cached.activeVolume:(data.volumes[0]?.id||"");const vol=activeVol(),inRange=vol&&Number.isFinite(cached.currentChapter)&&cached.currentChapter>=vol.from&&cached.currentChapter<=vol.to;currentChapter=inRange?cached.currentChapter:(vol?.from||1);currentActionIndex=inRange&&Number.isFinite(cached.currentActionIndex)?cached.currentActionIndex:0;openProfileId=typeof cached.openProfileId==="string"&&entity(cached.openProfileId)?cached.openProfileId:null;}
function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "entity"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }
function safeExternalUrl(value){
  try { const url=new URL(String(value||"").trim()); return ["http:","https:"].includes(url.protocol)?url.href:""; }
  catch { return ""; }
}
function richInline(value){
  const text=String(value??""),pattern=/\[\[cite:(\d+)\]\]|\[\[\/cite\]\]|\[\[([^\]|[]+?)\|([^\]|[]+?)(?:\|([^\]|[]+?))?\]\]|\[\[(\d+)\]\]/g;
  let html="",lastIndex=0,match,openChapter=null;
  const closeZone=()=>{html+=chapterCitation({chapter:openChapter})+"</span>";openChapter=null;};
  while((match=pattern.exec(text))){
    html+=escapeHtml(text.slice(lastIndex,match.index));
    if(match[1]!==undefined){
      if(openChapter!==null)closeZone();
      const chapter=validChapter(match[1]);
      if(chapter){html+=`<span class="prose-chapter-ref sentence-cite" data-chapter="${chapter}">`;openChapter=chapter;}
      else html+=escapeHtml(match[0]);
      lastIndex=pattern.lastIndex;continue;
    }
    if(match[0]==="[[/cite]]"){
      if(openChapter!==null)closeZone();else html+=escapeHtml(match[0]);
      lastIndex=pattern.lastIndex;continue;
    }
    if(match[5]!==undefined){
      const chapter=validChapter(match[5]);
      html+=chapter?`<span class="prose-chapter-ref">${chapterCitation({chapter})}</span>`:escapeHtml(match[0]);
      lastIndex=pattern.lastIndex;continue;
    }
    const label=match[2].trim();
    const wikiLink=url=>`<a class="wiki-external-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span aria-hidden="true">↗</span></a>`;
    if(match[4]!==undefined){
      let urlPart=match[3].trim(),chapterPart=match[4].trim();
      if(!validChapter(chapterPart)&&validChapter(urlPart))[urlPart,chapterPart]=[chapterPart,urlPart];
      const url=safeExternalUrl(urlPart),chapter=validChapter(chapterPart);
      const linkHtml=url?wikiLink(url):escapeHtml(label);
      html+=chapter?linkHtml+`<span class="prose-chapter-ref">${chapterCitation({chapter})}</span>`:linkHtml;
    }else{
      const target=match[3].trim(),chapter=validChapter(target);
      if(chapter){
        const url=chapterUrl(chapter),tag=url?"a":"span",attrs=url?` href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Open the source for chapter ${chapter}"`:` title="No source saved for chapter ${chapter} yet"`;
        html+=`<span class="prose-chapter-ref"><${tag} class="chapter-ref-link${url?"":" uncited"}"${attrs}>${escapeHtml(label)}</${tag}>${chapterCitation({chapter})}</span>`;
      }else{
        const url=safeExternalUrl(target);
        html+=url?wikiLink(url):escapeHtml(label);
      }
    }
    lastIndex=pattern.lastIndex;
  }
  html+=escapeHtml(text.slice(lastIndex));
  if(openChapter!==null)closeZone();
  return html;
}
function richText(value){
  return String(value??"").split(/\r?\n/).map(line=>{
    const parts=line.split(/\s+\|\s+/),chapterIndex=parts.length===2?1:parts.length>=3?parts.length-2:-1,chapter=chapterIndex>=0?validChapter(parts[chapterIndex]):null,sourceUrl=chapter&&parts.length>=3?safeExternalUrl(parts.at(-1)):"";
    if(!chapter)return richInline(line);
    const prose=parts.slice(0,chapterIndex).join(" | ").trim();
    return `<span class="cited-prose-line"><span>${richInline(prose)}</span>${chapterCitation({chapter,sourceUrl})}</span>`;
  }).join("<br>");
}
function chapterUrl(chapter){if(!chapter)return "";const explicit=safeExternalUrl(data?.chapterSources?.[chapter]);if(explicit)return explicit;const template=String(data?.chapterUrlTemplate||"").trim();if(!template)return "";return safeExternalUrl(template.replaceAll("{n}",String(chapter)));}
function chapterSourcesFromText(value){const map={};listFromText(value).forEach(line=>{const [chapterText,urlText]=line.split(/\s+\|\s+/,2);const chapter=validChapter(chapterText),url=safeExternalUrl(urlText);if(chapter&&url)map[chapter]=url;});return map;}
function chapterSourcesToText(map){return Object.keys(map||{}).map(Number).sort((a,b)=>a-b).map(chapter=>`${chapter} | ${map[chapter]}`).join("\n");}
var missingChapterLinksCache=null;
function referencedChaptersWithoutLinks(){
  if(missingChapterLinksCache&&missingChapterLinksCache.forVersion===dataVersion)return missingChapterLinksCache.list;
  const missing=new Set();
  data.events.forEach(event=>{const chapter=validChapter(event.chapter);if(chapter&&!safeExternalUrl(event.sourceUrl)&&!chapterUrl(chapter))missing.add(chapter);});
  const markerPattern=/\[\[(?:[^\]|]+?\|)?(\d+)\]\]/g;
  data.entities.forEach(item=>{
    const profile=item.profile||{};
    const fields=[profile.history,profile.appearance,profile.personality,profile.purpose,profile.quote,profile.subtitle,item.description,...(profile.trivia||[]),...(profile.abilities||[]),...(profile.traits||[]),...(profile.achievements||[]).map(entry=>typeof entry==="string"?entry:entry.text)];
    fields.filter(Boolean).forEach(text=>{let match;markerPattern.lastIndex=0;while((match=markerPattern.exec(text))){const chapter=validChapter(match[1]);if(chapter&&!chapterUrl(chapter))missing.add(chapter);}});
  });
  const list=[...missing].sort((a,b)=>a-b);
  missingChapterLinksCache={forVersion:dataVersion,list};
  return list;
}
function chapterCitation(record,{requireUrl=false}={}){const chapter=validChapter(record?.chapter);if(!chapter)return "";const url=safeExternalUrl(record?.sourceUrl)||chapterUrl(chapter);if(url)return `<a class="chapter-citation" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Open the source for chapter ${chapter}"><span>Chapter ${chapter}</span><i aria-hidden="true">↗</i></a>`;return requireUrl?"":`<span class="chapter-citation uncited" title="No external chapter source has been added">Chapter ${chapter}</span>`;}
function eventOriginControl(event){const owner=entity(event.source),label=owner?.name||"event";return `<span class="event-controls">${chapterCitation(event)}<button class="event-origin-link" type="button" data-open-event="${escapeHtml(event.source)}" data-event-chapter="${event.chapter}" title="Open ${escapeHtml(label)}’s detailed timeline at chapter ${event.chapter}" aria-label="Open this event in ${escapeHtml(label)}’s detailed timeline"><span>Details</span><i aria-hidden="true">→</i></button></span>`;}
function entityWikiUrl(id){return safeExternalUrl(entity(id)?.profile?.wikiUrl);}
function entityNameLink(id,label=entity(id)?.name||id,className="entity-wiki-link"){const url=entityWikiUrl(id),text=escapeHtml(label);return url?`<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Open ${text} on the wiki">${text}<span aria-hidden="true">↗</span></a>`:text;}
function achievementEntries(value){return listFromText(value).map(line=>{const [text,chapterText="",sourceUrl=""] = line.split(/\s+\|\s+/,3);const chapter=validChapter(chapterText);return chapter||sourceUrl.trim()?{text:text.trim(),...(chapter?{chapter}:{}),...(safeExternalUrl(sourceUrl)?{sourceUrl:safeExternalUrl(sourceUrl)}:{})}:text.trim();}).filter(item=>typeof item==="string"?item:Boolean(item.text));}
function achievementLine(item){if(typeof item==="string")return item;return [item.text,item.chapter||"",item.sourceUrl||""].filter((value,index)=>index===0||value!=="").join(" | ");}
function achievementList(items){return `<ul class="wiki-list achievement-list">${items.map(item=>{const entry=typeof item==="string"?{text:item}:item;return `<li><span>${richText(entry.text)}</span>${entry.chapter?chapterCitation(entry):""}</li>`;}).join("")}</ul>`;}
function entity(id) { return data.entities.find(item => item.id === id); }
function validChapter(value){const chapter=Number(value);return value!==null&&value!==undefined&&value!==""&&Number.isFinite(chapter)&&chapter>0?chapter:null;}
function earliestChapter(values){const chapters=values.map(validChapter).filter(Boolean);return chapters.length?Math.min(...chapters):null;}
function firstMention(item){return earliestChapter([item?.mentioned,...data.events.filter(event=>event.source===item?.id&&event.type==="mention").map(event=>event.chapter)]);}
function firstAppearance(item){return earliestChapter([item?.appeared,...data.events.filter(event=>event.source===item?.id&&["appearance","corpse_appearance"].includes(event.type)).map(event=>event.chapter)]);}
function hasAppeared(item,chapter){const first=firstAppearance(item);return first!==null&&first<=chapter;}
function pairKey(a,b) { return [a,b].sort().join("|"); }
function activeVol() { return data.volumes.find(v => v.id === activeVolume) || data.volumes[0]; }
function eventInvolves(event,id) { return event.source === id || event.target === id || event.location === id || (event.characters || []).includes(id); }
function eventLocation(event){return event.location?entity(event.location):null;}
function eventsAtLocation(id,chapter=currentChapter){const source=chapter===currentChapter?appliedEvents():orderedEvents();return source.filter(event=>event.chapter===chapter&&event.location===id).sort((a,b)=>(a.order||0)-(b.order||0));}
function locationCharacterIds(event){return [...new Set([event.source,event.target,...(event.characters||[])].filter(id=>entity(id)?.kind==="character"))];}
function eventChapters(id, volume) { return [...new Set(data.events.filter(e => eventInvolves(e,id) && e.chapter >= volume.from && e.chapter <= volume.to).map(e => e.chapter))].sort((a,b)=>a-b); }
function timelineChaptersFor(chosen,volume){if(chosen?.kind==="location"&&locationPovId)return [...new Set(data.events.filter(event=>event.location===chosen.id&&event.chapter>=volume.from&&event.chapter<=volume.to&&locationCharacterIds(event).includes(locationPovId)).map(event=>event.chapter))].sort((a,b)=>a-b);return chosen?eventChapters(chosen.id,volume):[];}
function eventMatchesTimelineFocus(event,chosen){return !chosen||(chosen.kind==="location"&&locationPovId?event.location===chosen.id&&locationCharacterIds(event).includes(locationPovId):eventInvolves(event,chosen.id));}
function orderedEvents(){return data.events.map((event,index)=>({event,index})).sort((a,b)=>a.event.chapter-b.event.chapter||(a.event.order||0)-(b.event.order||0)||a.index-b.index).map(item=>item.event);}
function nextEventOrder(chapter,drafts=[]){const sameChapter=[...data.events,...drafts].filter(event=>event.chapter===chapter);return sameChapter.reduce((max,event,index)=>Math.max(max,Number(event.order)||index+1),0)+1;}
function volumeActions(volume=activeVol()){return orderedEvents().filter(event=>event.chapter>=volume.from&&event.chapter<=volume.to);}
function revealedVolumeActions(){return volumeActions().slice(0,currentActionIndex);}
function currentActionEvent(){return currentActionIndex>0?volumeActions()[currentActionIndex-1]||null:null;}
function appliedEvents(){const volume=activeVol(),selected=new Set(volumeActions().slice(0,currentActionIndex).map(event=>event.id));return orderedEvents().filter(event=>event.chapter<volume.from||(event.chapter<=volume.to&&selected.has(event.id)));}
function resolveEntity(text) {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  const direct = data.entities.find(item => item.name.toLowerCase() === q || item.id === q);
  if (direct) return direct;
  const aliasEvent = data.events.find(event => ["alias","display_name"].includes(event.type) && String(event.value).toLowerCase() === q);
  return aliasEvent ? entity(aliasEvent.source) : null;
}
function stateName(derived,id){return derived?.states?.get(id)?.displayName||entity(id)?.name||id;}
function resolvePublicEntity(text){const q=text.trim().toLowerCase();if(!q)return null;const d=currentDerived(),knownEvents=appliedEvents(),knownIds=new Set(knownEvents.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),direct=data.entities.find(item=>knownIds.has(item.id)&&(stateName(d,item.id).toLowerCase()===q||item.name.toLowerCase()===q||item.id===q));if(direct)return direct;const known=knownEvents.find(event=>["alias","display_name"].includes(event.type)&&String(event.value||"").toLowerCase()===q);return known?entity(known.source):null;}
function relationHistoryFor(a,b,chapter) { return data.events.filter(e => e.type === "relationship" && e.chapter <= chapter && pairKey(e.source,e.target) === pairKey(a,b)).sort((x,y)=>x.chapter-y.chapter); }
function meetingFor(a,b,chapter) { return data.events.find(e => e.type === "meeting" && e.chapter <= chapter && pairKey(e.source,e.target) === pairKey(a,b)); }
function currentRelation(a,b,chapter) { const history = relationHistoryFor(a,b,chapter); return history.length ? String(history.at(-1).value || "neutral").toLowerCase() : "neutral"; }
function locationLineage(id,derived){const chain=[],seen=new Set([id]);let cursor=id;while(true){const link=derived.locationParents.find(item=>item.child===cursor);if(!link||seen.has(link.parent))break;chain.unshift(link.parent);seen.add(link.parent);cursor=link.parent;}return [...chain,id];}
function locationDescendants(id,derived){const result=[],queue=[id],seen=new Set([id]);while(queue.length){const parent=queue.shift();derived.locationParents.filter(link=>link.parent===parent).forEach(link=>{if(seen.has(link.child))return;seen.add(link.child);result.push(link.child);queue.push(link.child);});}return result;}

function derive(chapter,eventSubset=null) {
  const states = new Map();
  const actionLimited=Array.isArray(eventSubset);
  data.entities.forEach(item => states.set(item.id,{...item,displayName:item.name,nameHistory:[],mentioned:actionLimited?null:firstMention(item),appeared:actionLimited?null:firstAppearance(item),aliases:[],level:0,realm:"Unrevealed",canonicalRealm:"Unrevealed",status:"unknown",memberships:[]}));
  const memberships = new Map();
  const awareness = new Map();
  const meetings = new Map();
  const relations = new Map();
  const locations = new Map();
  const locationVisits = [];
  const organizationLocations = new Map();
  const residences = new Map();
  const locationParents = new Map();
  const identityParents = new Map();
  (eventSubset||orderedEvents().filter(e=>e.chapter<=chapter)).forEach(event => {
    const source = states.get(event.source);
    if(event.type==="mention"&&source)source.mentioned=source.mentioned===null?event.chapter:Math.min(source.mentioned,event.chapter);
    if(["appearance","corpse_appearance"].includes(event.type)&&source)source.appeared=source.appeared===null?event.chapter:Math.min(source.appeared,event.chapter);
    if(event.type==="appearance"&&source&&source.status==="unknown")source.status="alive";
    if(event.type==="corpse_appearance"&&source)source.status="dead";
    if (event.type === "alias" && source) source.aliases.push({chapter:event.chapter,value:event.value});
    if (event.type === "display_name" && source && event.value) { source.displayName=event.value;source.nameHistory.push({chapter:event.chapter,value:event.value}); }
    if (event.type === "cultivation" && source) { source.level = Number(event.level)||1; source.canonicalRealm=cultivationCanonical(event);source.realm=cultivationDisplay(event); }
    if (event.type === "status" && source) source.status = event.value || "unknown";
    if (event.type === "gender" && source && event.value) source.gender = event.value;
    if (event.type === "age" && source && event.value) source.age = event.value;
    if (event.type === "membership" && source && states.has(event.target)) {
      const key = event.source+"|"+event.target;
      if (event.action === "leave") memberships.delete(key); else memberships.set(key,{character:event.source,organization:event.target,role:event.value||"Member",from:event.chapter,revealed:event.action==="reveal"});
    }
    if(event.type==="organization_location"&&source?.kind==="organization"&&states.get(event.location)?.kind==="location"){
      const key=event.source+"|"+event.location;
      if(event.action==="close")organizationLocations.delete(key);else organizationLocations.set(key,{organization:event.source,location:event.location,role:event.value||"Branch",from:event.chapter});
    }
    if(event.type==="residency"&&source?.kind==="character"&&states.get(event.location)?.kind==="location"){
      const key=event.source+"|"+event.location;
      if(event.action==="end")residences.delete(key);else residences.set(key,{character:event.source,location:event.location,role:event.value||"Resident",from:event.chapter});
    }
    if(event.type==="location_parent"&&source?.kind==="location"&&states.get(event.location)?.kind==="location"){
      if(event.action==="remove"){if(locationParents.get(event.source)?.parent===event.location)locationParents.delete(event.source);}else locationParents.set(event.source,{child:event.source,parent:event.location,from:event.chapter});
    }
    if(event.type==="identity_parent"&&source?.kind==="character"&&states.get(event.target)?.kind==="character"){
      if(event.action==="remove"){if(identityParents.get(event.source)?.parent===event.target)identityParents.delete(event.source);}else identityParents.set(event.source,{child:event.source,parent:event.target,relation:event.value||"Clone",from:event.chapter});
    }
    if (event.type === "awareness" && source && states.has(event.target)) {
      const key = pairKey(event.source,event.target);
      if (!awareness.has(key)) awareness.set(key,{a:key.split("|")[0],b:key.split("|")[1],aToB:false,bToA:false});
      const pair = awareness.get(key); if (event.source === pair.a) pair.aToB = true; else pair.bToA = true;
    }
    if (event.type === "meeting" && source && states.has(event.target)) meetings.set(pairKey(event.source,event.target),event);
    if (event.type === "relationship" && source && states.has(event.target)) {
      const key = pairKey(event.source,event.target); if (!relations.has(key)) relations.set(key,[]); relations.get(key).push(event);
    }
    if(event.location&&states.get(event.location)?.kind==="location"&&!['mention','residency','location_parent','organization_location'].includes(event.type)){
      locationCharacterIds(event).forEach(character=>{const visit={character,location:event.location,chapter:event.chapter,order:event.order||0,eventId:event.id,type:event.type};locationVisits.push(visit);});
      if(event.type==="movement"&&source?.kind==="character")locations.set(event.source,{character:event.source,location:event.location,chapter:event.chapter,order:event.order||0,eventId:event.id,type:event.type});
    }
  });
  memberships.forEach(item => states.get(item.character)?.memberships.push(item));
  return { states, memberships:[...memberships.values()], organizationLocations:[...organizationLocations.values()], residences:[...residences.values()], locationParents:[...locationParents.values()], identityParents:[...identityParents.values()], awareness, meetings, relations, locations, locationVisits };
}
function currentDerived(){return derive(currentChapter,appliedEvents());}

function configure() {
  $("#novel-name").textContent = data.novel;
  volumeSelect.innerHTML = data.volumes.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`).join("");
  volumeSelect.value = activeVolume;
  updateSuggestions();
  configureTimeline();
}
function updateSuggestions() {
  const d=currentDerived(),known=appliedEvents(),knownIds=new Set(known.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),publicOptions=[],adminOptions=[];
  data.entities.forEach(item=>{const shown=stateName(d,item.id);if(knownIds.has(item.id)){publicOptions.push(`<option value="${escapeHtml(shown)}">${item.kind}</option>`);if(shown!==item.name)publicOptions.push(`<option value="${escapeHtml(item.name)}">Earlier name of ${escapeHtml(shown)}</option>`);known.filter(e=>["alias","display_name"].includes(e.type)&&e.source===item.id).forEach(e=>publicOptions.push(`<option value="${escapeHtml(e.value)}">Known name of ${escapeHtml(shown)}</option>`));}adminOptions.push(`<option value="${escapeHtml(item.name)}">${item.kind}</option>`);data.events.filter(e=>["alias","display_name"].includes(e.type)&&e.source===item.id).forEach(e=>adminOptions.push(`<option value="${escapeHtml(e.value)}">Name of ${escapeHtml(item.name)}</option>`));});
  $("#entity-options").innerHTML = publicOptions.join("");
  $("#admin-entity-options").innerHTML = adminOptions.join("");
  $("#location-options").innerHTML=data.entities.filter(item=>item.kind==="location").map(item=>`<option value="${escapeHtml(item.name)}"></option>`).join("");
}
function eventMarkerFill(events){const colors=[...new Set(events.map(event=>EVENT_TYPE_COLORS[event.type]||"#7f8da3"))];if(colors.length===1)return colors[0];const size=100/colors.length;return `conic-gradient(${colors.map((color,index)=>`${color} ${index*size}% ${(index+1)*size}%`).join(",")})`;}
function volumeChapterGroups(){const groups=[],byChapter=new Map();volumeActions().forEach((event,index)=>{if(!byChapter.has(event.chapter)){const group={chapter:event.chapter,entries:[]};byChapter.set(event.chapter,group);groups.push(group);}byChapter.get(event.chapter).entries.push({event,index:index+1});});return groups;}
function chapterEventEntries(chapter){return volumeChapterGroups().find(group=>group.chapter===chapter)?.entries||[];}
function renderTimelineMarkers(){
  const marks=[];
  if(expandedChapter!==null){const entries=chapterEventEntries(expandedChapter),denominator=entries.length+1;marks.push(`<span class="expanded-boundary-mark previous-boundary" style="left:0" title="Drag here to close and go to the previous chapter">‹</span>`);entries.forEach((entry,index)=>{marks.push(`<button type="button" class="main-timeline-mark expanded-event-mark selectable" style="left:${(index+1)/denominator*100}%;--marker-fill:${EVENT_TYPE_COLORS[entry.event.type]||"#7f8da3"}" title="Event ${index+1} · ${escapeHtml(entry.event.type.replaceAll("_"," "))}" data-event-action="${entry.index}" aria-label="Show event ${index+1} of chapter ${expandedChapter}"></button>`);});marks.push(`<span class="expanded-boundary-mark next-boundary" style="left:100%" title="Drag here to close and go to the next chapter">›</span>`);}
  else{const groups=volumeChapterGroups();groups.forEach((group,index)=>{const position=groups.length?(index+1)/groups.length*100:0,multi=group.entries.length>1,tag=multi?"button":"span";marks.push(`<${tag}${multi?' type="button"':""} class="main-timeline-mark${multi?" multi-event-mark expandable":""}" style="left:${position}%;--marker-fill:${eventMarkerFill(group.entries.map(entry=>entry.event))}" title="Chapter ${group.chapter}${multi?` · ${group.entries.length} events · click to expand`:""}"${multi?` data-expand-chapter="${group.chapter}" aria-label="Expand chapter ${group.chapter} events"`:""}></${tag}>`);});}
  $("#timeline-marks").innerHTML=marks.join("");document.querySelectorAll("[data-expand-chapter]").forEach(marker=>marker.onclick=event=>{event.preventDefault();event.stopPropagation();expandChapterEvents(Number(marker.dataset.expandChapter));});document.querySelectorAll("[data-event-action]").forEach(marker=>marker.onclick=event=>{event.preventDefault();event.stopPropagation();cancelChapterSequence();currentActionIndex=Number(marker.dataset.eventAction);currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();});
}
function configureTimeline() {
  const volume=activeVol(),actions=volumeActions(),groups=volumeChapterGroups();currentActionIndex=Math.max(0,Math.min(actions.length,currentActionIndex));const action=currentActionEvent(),field=document.querySelector(".timeline-field"),collapse=$("#collapse-chapter-events");currentChapter=action?.chapter||volume.from;
  if(expandedChapter!==null&&action?.chapter!==expandedChapter)expandedChapter=null;
  if(expandedChapter!==null){const entries=chapterEventEntries(expandedChapter),eventIndex=Math.max(0,entries.findIndex(entry=>entry.index===currentActionIndex));timeline.min=0;timeline.max=entries.length+1;timeline.value=eventIndex+1;timeline.dataset.mode="chapter-events";$("#event-position").textContent=`event ${eventIndex+1}/${entries.length} · ends close`;$("#previous").disabled=false;$("#next").disabled=false;$("#chapter-value").textContent=expandedChapter;collapse.hidden=false;field.classList.add("events-expanded","multi-event-chapter");}
  else{const groupIndex=action?groups.findIndex(group=>group.chapter===action.chapter):-1,group=groups[groupIndex];timeline.min=0;timeline.max=groups.length;timeline.value=groupIndex+1;timeline.dataset.mode="chapters";$("#event-position").textContent=currentActionIndex===0?`0 of ${groups.length} chapters`:`chapter stop ${groupIndex+1} of ${groups.length}${group?.entries.length>1?` · ${group.entries.length} events`:""}`;$("#previous").disabled=groupIndex<0;$("#next").disabled=groupIndex===groups.length-1;$("#chapter-value").textContent=action?action.chapter:"—";collapse.hidden=true;field.classList.remove("events-expanded");field.classList.toggle("multi-event-chapter",Boolean(group&&group.entries.length>1));}
  renderTimelineMarkers();
}
function cancelChapterSequence(){clearTimeout(chapterAutoplayTimer);chapterAutoplayTimer=null;}
function expandChapterEvents(chapter){const entries=chapterEventEntries(chapter);if(entries.length<2)return;cancelChapterSequence();expandedChapter=chapter;if(currentActionEvent()?.chapter!==chapter)currentActionIndex=entries[0].index;currentChapter=chapter;renderAll();}
function collapseChapterEvents(){cancelChapterSequence();expandedChapter=null;renderAll();}
function scheduleChapterSequence(){cancelChapterSequence();if(expandedChapter!==null)return;const current=currentActionEvent(),next=volumeActions()[currentActionIndex];if(!current||!next||next.chapter!==current.chapter)return;chapterAutoplayTimer=setTimeout(()=>{chapterAutoplayTimer=null;currentActionIndex+=1;currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();scheduleChapterSequence();},1150);}
function applyTimeline() {
  const previous=currentActionIndex,value=Number(timeline.value);cancelChapterSequence();if(timeline.dataset.mode==="chapter-events"){const groups=volumeChapterGroups(),groupIndex=groups.findIndex(group=>group.chapter===expandedChapter),entries=groups[groupIndex]?.entries||[];if(value<=0){expandedChapter=null;currentActionIndex=groupIndex>0?groups[groupIndex-1].entries.at(-1).index:0;currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();return;}if(value>=entries.length+1){expandedChapter=null;const nextGroup=groups[groupIndex+1];currentActionIndex=nextGroup?nextGroup.entries[0].index:entries.at(-1)?.index||0;currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();if(nextGroup)scheduleChapterSequence();return;}currentActionIndex=entries[value-1].index;currentChapter=expandedChapter;renderAll();return;}const groups=volumeChapterGroups();if(value<=0){currentActionIndex=0;currentChapter=activeVol().from;renderAll();return;}const group=groups[value-1];if(!group)return;currentActionIndex=group.entries[0].index;currentChapter=group.chapter;renderAll();if(currentActionIndex>previous)scheduleChapterSequence();
}
function stepTimeline(direction) { const next=Math.max(Number(timeline.min),Math.min(Number(timeline.max),Number(timeline.value)+direction));if(next===Number(timeline.value))return;timeline.value=next;applyTimeline(); }

function svgEl(name,attrs={}) { const element=document.createElementNS(SVG_NS,name); Object.entries(attrs).forEach(([key,value])=>element.setAttribute(key,String(value))); return element; }
function arcPath(cx,cy,r,startDeg,endDeg){const a=startDeg*Math.PI/180,b=endDeg*Math.PI/180;return `M ${cx+Math.cos(a)*r} ${cy+Math.sin(a)*r} A ${r} ${r} 0 0 1 ${cx+Math.cos(b)*r} ${cy+Math.sin(b)*r}`;}
function diamondPoints(cx,cy,s){return `${cx},${cy-s} ${cx+s},${cy} ${cx},${cy+s} ${cx-s},${cy}`;}
function seedPosition(item,index,total) {
  const fixed={lex:[125,90],eclipse:[585,80],inn:[355,165],mary:[595,225],luthor:[110,270],gerald:[350,305],jotun:[70,435],garden:[650,435],"inn-estate":[205,435],"inn-lobby":[365,435],"garden-realm":[525,435]};
  if(fixed[item.id]) return fixed[item.id]; const angle=index*2.3999632297,r=58+27*Math.sqrt(index+1);return [360+Math.cos(angle)*r,260+Math.sin(angle)*r*.78];
}
function visibleFrom(item){return item.kind!=="character"?(validChapter(item.intro)??Infinity):(firstMention(item)??firstAppearance(item)??Infinity);}
function radius(state){return 19+Math.min(CULTIVATION_LEVELS.length,Math.max(0,Number(state.level)||0))*1.4;}

function createGradient(defs,id,history,chapter){
  if(!history.length)return {url:COLORS.neutral,el:null}; const gradient=svgEl("linearGradient",{id,gradientUnits:"userSpaceOnUse"}); const startChapter=history[0].chapter;
  history.forEach((event,i)=>{const denominator=Math.max(1,chapter-startChapter),instant=chapter===startChapter&&history.length===1,start=instant?0:Math.max(0,(event.chapter-startChapter)/denominator),next=i+1<history.length?history[i+1].chapter:chapter,end=instant?1:Math.min(1,(next-startChapter)/denominator),color=COLORS[event.value]||COLORS.neutral;gradient.append(svgEl("stop",{offset:start*100+"%","stop-color":color}),svgEl("stop",{offset:end*100+"%","stop-color":color}));}); defs.appendChild(gradient); return {url:`url(#${id})`,el:gradient};
}

// --- Flowy force-directed layout engine (Obsidian-style): positions persist across
// renders and drift continuously under simple physics, so the graph never "snaps" —
// it drags, settles, and re-flows smoothly whenever the underlying data changes.
const physics = { pos: new Map(), vel: new Map(), bounds: new Map(), edges: [], containments:[], dragId: null };
const view = { x: 0, y: 0, scale: 1 };
let lastAutoFitSignature="";
let viewportGroup = null;
let dragMoved = false, dragOffset = { x: 0, y: 0 }, dragStartClient = { x: 0, y: 0 };
let panStart = null;

function ensurePos(id, seedFn) {
  if (!physics.pos.has(id)) { const [x, y] = seedFn(); physics.pos.set(id, { x, y }); physics.vel.set(id, { x: 0, y: 0 }); }
  return physics.pos.get(id);
}
function stepPhysics() {
  const ids = [...physics.pos.keys()]; if (!ids.length) return;
  const force = new Map(ids.map(id => [id, { x: 0, y: 0 }]));
  const REPEL = 2600+Math.min(6200,Math.max(0,ids.length-10)*115), CENTER = Math.max(.00032,.00115-Math.max(0,ids.length-12)*.000015), cx = 360, cy = 260;
  for (let i = 0; i < ids.length; i++) {
    const a = physics.pos.get(ids[i]), fa = force.get(ids[i]);
    for (let j = i + 1; j < ids.length; j++) {
      const b = physics.pos.get(ids[j]), fb = force.get(ids[j]);
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 9) { dx = (Math.random() - 0.5) * 3; dy = (Math.random() - 0.5) * 3; d2 = dx * dx + dy * dy || 1; }
      const d = Math.sqrt(d2), f = REPEL / d2, fx = dx / d * f, fy = dy / d * f;
      fa.x += fx; fa.y += fy; fb.x -= fx; fb.y -= fy;
      const ab=physics.bounds.get(ids[i]),bb=physics.bounds.get(ids[j]);
      if(ab&&bb){const labelDx=(a.x+ab.ox)-(b.x+bb.ox),labelDy=(a.y+ab.oy)-(b.y+bb.oy),overlapX=ab.hw+bb.hw+12-Math.abs(labelDx),overlapY=ab.hh+bb.hh+6-Math.abs(labelDy);if(overlapX>0&&overlapY>0){if(overlapX<overlapY){const direction=labelDx>=0?1:-1,push=Math.min(4,.08*overlapX);fa.x+=direction*push;fb.x-=direction*push;}else{const direction=labelDy>=0?1:-1,push=Math.min(4,.11*overlapY);fa.y+=direction*push;fb.y-=direction*push;}}}
    }
    fa.x += (cx - a.x) * CENTER; fa.y += (cy - a.y) * CENTER;
  }
  physics.edges.forEach(edge => {
    const a = physics.pos.get(edge.a), b = physics.pos.get(edge.b); if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
    const f = (d - edge.length) * edge.strength, fx = dx / d * f, fy = dy / d * f;
    const fa = force.get(edge.a), fb = force.get(edge.b);
    if (fa) { fa.x += fx; fa.y += fy; } if (fb) { fb.x -= fx; fb.y -= fy; }
  });
  physics.containments.forEach(rule=>{const member=physics.pos.get(rule.member),location=physics.pos.get(rule.location);if(!member||!location)return;const dx=member.x-location.x,dy=member.y-location.y,norm=Math.hypot(dx/Math.max(1,rule.rx*.72),dy/Math.max(1,rule.ry*.72));if(norm<=1)return;const overflow=norm-1,fx=-dx*overflow*.075,fy=-dy*overflow*.075,fm=force.get(rule.member),fl=force.get(rule.location);if(fm){fm.x+=fx;fm.y+=fy;}if(fl){fl.x-=fx*.08;fl.y-=fy*.08;}});
  const DAMP = 0.82, MAXV = 13;
  ids.forEach(id => {
    if (id === physics.dragId) return;
    const v = physics.vel.get(id), f = force.get(id), p = physics.pos.get(id);
    v.x = Math.max(-MAXV, Math.min(MAXV, (v.x + f.x) * DAMP));
    v.y = Math.max(-MAXV, Math.min(MAXV, (v.y + f.y) * DAMP));
    p.x += v.x; p.y += v.y;
  });
}
let nodeEls = new Map(), edgeUpdaters = [];
function applyViewTransform() { if (viewportGroup) viewportGroup.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.scale})`); }
function toSvgPoint(clientX, clientY) {
  const pt = graph.createSVGPoint(); pt.x = clientX; pt.y = clientY;
  const ctm = graph.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse()); return { x: p.x, y: p.y };
}
function toContentPoint(clientX, clientY) { const u = toSvgPoint(clientX, clientY); return { x: (u.x - view.x) / view.scale, y: (u.y - view.y) / view.scale }; }
function zoomBy(factor, atX = 360, atY = 260) {
  const contentX = (atX - view.x) / view.scale, contentY = (atY - view.y) / view.scale;
  view.scale = Math.max(0.35, Math.min(3, view.scale * factor));
  view.x = atX - contentX * view.scale; view.y = atY - contentY * view.scale;
  applyViewTransform();
}
function fitGraphToCount(count,force=false){const signature=`${activeVolume}:${count}`;if(!force&&signature===lastAutoFitSignature)return;lastAutoFitSignature=signature;const scale=Math.max(.38,Math.min(1,Math.sqrt(18/Math.max(18,count))));view.scale=scale;view.x=360*(1-scale);view.y=260*(1-scale);applyViewTransform();}
function tickGraph() {
  if (activeView === "graph" && physics.pos.size) {
    stepPhysics();
    nodeEls.forEach((el, id) => { const p = physics.pos.get(id); if (p) el.setAttribute("transform", `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`); });
    edgeUpdaters.forEach(update => update());
  }
  requestAnimationFrame(tickGraph);
}
function renderGraph() {
  const awaitingAction=currentActionIndex===0,layout=$("#graph-layout"),onboarding=$("#slider-onboarding");layout.classList.toggle("awaiting-action",awaitingAction);onboarding.hidden=!awaitingAction;
  if(awaitingAction){nodeEls=new Map();edgeUpdaters=[];physics.edges=[];physics.containments=[];graph.replaceChildren();requestAnimationFrame(positionSliderOnboarding);return;}
  const volumeApplied=revealedVolumeActions(),previousApplied=volumeActions().slice(0,Math.max(0,currentActionIndex-1)),currentEvent=currentActionEvent(),appliedNow=appliedEvents(),fullDerived=derive(currentChapter,appliedNow),priorCultivationDerived=currentEvent?.type==="cultivation"?derive(currentChapter,appliedNow.filter(event=>event.id!==currentEvent.id)):null,volumeDerived=derive(currentChapter,volumeApplied),derived={...volumeDerived,states:fullDerived.states},visibleIds=new Set(volumeApplied.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),previousVisibleIds=new Set(previousApplied.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),chapterChangedIds=new Set(volumeApplied.filter(event=>event.chapter===currentChapter).flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),visible=data.entities.filter(item=>visibleIds.has(item.id));
  if(selectedId&&!visibleIds.has(selectedId))selectedId=null;
  [...physics.pos.keys()].filter(id=>!visibleIds.has(id)).forEach(id=>{physics.pos.delete(id);physics.vel.delete(id);physics.bounds.delete(id);});
  visible.forEach((item,index)=>ensurePos(item.id,()=>seedPosition(item,index,visible.length)));
  fitGraphToCount(visible.length);
  const positions=physics.pos;
  const locationPopulation=new Map(),addLocationMember=(location,id)=>{if(!locationPopulation.has(location))locationPopulation.set(location,new Set());locationPopulation.get(location).add(id);};derived.locations.forEach(visit=>addLocationMember(visit.location,visit.character));derived.residences.forEach(link=>addLocationMember(link.location,link.character));derived.organizationLocations.forEach(link=>addLocationMember(link.location,link.organization));derived.locationParents.forEach(link=>addLocationMember(link.parent,link.child));for(let pass=0;pass<8;pass++)derived.locationParents.forEach(link=>{const childMembers=locationPopulation.get(link.child);if(childMembers)childMembers.forEach(id=>addLocationMember(link.parent,id));});const directChildren=location=>derived.locationParents.filter(link=>link.parent===location).length,locationMetrics=location=>{const load=locationPopulation.get(location)?.size||0,nested=directChildren(location);return {rx:Math.min(520,105+Math.sqrt(Math.max(1,load))*38+nested*110),ry:Math.min(380,70+Math.sqrt(Math.max(1,load))*27+nested*90),orbit:Math.min(185,55+Math.sqrt(Math.max(1,load))*14)};},locationDistance=location=>locationMetrics(location).orbit;
  physics.bounds.clear();visible.forEach(item=>{const state=derived.states.get(item.id),shownName=state.displayName||item.name,labelY=item.kind==="character"?5:item.kind==="location"?-locationMetrics(item.id).ry-10:58;physics.bounds.set(item.id,{ox:0,oy:labelY-5,hw:Math.min(150,Math.max(28,String(shownName).length*4.2)),hh:9});});
  physics.edges=[
    ...derived.memberships.map(m=>({a:m.character,b:m.organization,length:105,strength:0.022})),
    ...derived.identityParents.map(link=>({a:link.child,b:link.parent,length:68,strength:0.09})),
    ...derived.organizationLocations.map(l=>({a:l.organization,b:l.location,length:locationDistance(l.location),strength:0.032})),
    ...derived.residences.map(l=>({a:l.character,b:l.location,length:locationDistance(l.location),strength:0.04})),
    ...derived.locationParents.map(l=>({a:l.child,b:l.parent,length:52,strength:0.075})),
    ...[...derived.locations.values()].map(l=>({a:l.character,b:l.location,length:locationDistance(l.location),strength:0.047})),
    ...[...derived.relations.keys(),...derived.awareness.keys()].map(key=>{const [a,b]=key.split("|");return {a,b,length:150,strength:0.02};}),
  ];
  physics.containments=[...derived.organizationLocations.map(link=>({member:link.organization,location:link.location,...locationMetrics(link.location)})),...derived.residences.map(link=>({member:link.character,location:link.location,...locationMetrics(link.location)})),...[...derived.locations.values()].map(visit=>({member:visit.character,location:visit.location,...locationMetrics(visit.location)})),...derived.locationParents.map(link=>({member:link.child,location:link.parent,...locationMetrics(link.parent)}))];
  nodeEls=new Map(); edgeUpdaters=[];
  graph.replaceChildren(); const defs=svgEl("defs"); Object.entries(COLORS).forEach(([type,color])=>{const marker=svgEl("marker",{id:`arrow-${type}`,viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:6,markerHeight:6,orient:"auto-start-reverse"});marker.appendChild(svgEl("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:color}));defs.appendChild(marker);});graph.appendChild(defs);
  viewportGroup=svgEl("g",{class:`graph-viewport${currentEvent?" has-action-focus":""}${selectedId?" has-selection-focus":""}`});
  const regionLayer=svgEl("g",{class:"location-region-layer"}),edgeLayer=svgEl("g"),nodeLayer=svgEl("g");viewportGroup.append(regionLayer,edgeLayer,nodeLayer);graph.appendChild(viewportGroup);applyViewTransform();
  const straightEdge=(a,b,className,dataA,dataB)=>{const aPos=positions.get(a),bPos=positions.get(b);if(!aPos||!bPos)return null;const element=svgEl("line",{x1:aPos.x,y1:aPos.y,x2:bPos.x,y2:bPos.y,class:className,"data-a":dataA,"data-b":dataB});edgeLayer.appendChild(element);edgeUpdaters.push(()=>{const p1=positions.get(a),p2=positions.get(b);if(!p1||!p2)return;element.setAttribute("x1",p1.x);element.setAttribute("y1",p1.y);element.setAttribute("x2",p2.x);element.setAttribute("y2",p2.y);});return element;};
  const pairKeys=new Set([...derived.relations.keys(),...derived.awareness.keys()]);
  pairKeys.forEach((key,index)=>{const [aId,bId]=key.split("|"),aPos=positions.get(aId),bPos=positions.get(bId);if(!aPos||!bPos)return;const history=derived.relations.get(key)||[],met=derived.meetings.get(key),aware=derived.awareness.get(key),type=history.length?String(history.at(-1).value).toLowerCase():"neutral";let element;
    const newPair=Boolean(currentEvent&&["awareness","relationship"].includes(currentEvent.type)&&pairKey(currentEvent.source,currentEvent.target)===key),edgeClass=`edge relation-edge${newPair?" newly-revealed-edge":""}`;
    if(aware&&!met){const ar=radius(derived.states.get(aId))+12,br=radius(derived.states.get(bId))+12,grad=createGradient(defs,`grad-a-${index}`,history,currentChapter),curve=(p1,p2)=>{const dx=p2.x-p1.x,dy=p2.y-p1.y,d=Math.max(1,Math.hypot(dx,dy)),x1=p1.x+dx/d*ar,y1=p1.y+dy/d*ar,x2=p2.x-dx/d*br,y2=p2.y-dy/d*br,cx=(x1+x2)/2-dy/d*16,cy=(y1+y2)/2+dx/d*16;return {x1,y1,x2,y2,cx,cy};},start=curve(aPos,bPos);
      element=svgEl("path",{d:`M ${start.x1} ${start.y1} Q ${start.cx} ${start.cy} ${start.x2} ${start.y2}`,class:edgeClass,stroke:grad.url,"data-a":aId,"data-b":bId});if(aware.aToB)element.setAttribute("marker-end",`url(#arrow-${type in COLORS?type:"neutral"})`);if(aware.bToA)element.setAttribute("marker-start",`url(#arrow-${type in COLORS?type:"neutral"})`);
      edgeUpdaters.push(()=>{const p1=positions.get(aId),p2=positions.get(bId);if(!p1||!p2)return;const c=curve(p1,p2);element.setAttribute("d",`M ${c.x1} ${c.y1} Q ${c.cx} ${c.cy} ${c.x2} ${c.y2}`);if(grad.el){grad.el.setAttribute("x1",c.x1);grad.el.setAttribute("y1",c.y1);grad.el.setAttribute("x2",c.x2);grad.el.setAttribute("y2",c.y2);}});
    } else if(history.length){const grad=createGradient(defs,`grad-r-${index}`,history,currentChapter);element=svgEl("line",{x1:aPos.x,y1:aPos.y,x2:bPos.x,y2:bPos.y,class:edgeClass,stroke:grad.url,"data-a":aId,"data-b":bId});
      edgeUpdaters.push(()=>{const p1=positions.get(aId),p2=positions.get(bId);if(!p1||!p2)return;element.setAttribute("x1",p1.x);element.setAttribute("y1",p1.y);element.setAttribute("x2",p2.x);element.setAttribute("y2",p2.y);if(grad.el){grad.el.setAttribute("x1",p1.x);grad.el.setAttribute("y1",p1.y);grad.el.setAttribute("x2",p2.x);grad.el.setAttribute("y2",p2.y);}});
    }
    if(element)edgeLayer.appendChild(element);
  });
  derived.memberships.forEach(m=>straightEdge(m.character,m.organization,`edge membership-edge${currentEvent?.type==="membership"&&currentEvent.source===m.character&&currentEvent.target===m.organization?" newly-revealed-edge":""}`,m.character,m.organization));
  derived.organizationLocations.forEach(link=>straightEdge(link.organization,link.location,`edge organization-location-edge${currentEvent?.type==="organization_location"&&currentEvent.source===link.organization&&currentEvent.location===link.location?" newly-revealed-edge":""}`,link.organization,link.location));
  derived.residences.forEach(link=>straightEdge(link.character,link.location,`edge residence-edge${currentEvent?.type==="residency"&&currentEvent.source===link.character&&currentEvent.location===link.location?" newly-revealed-edge":""}`,link.character,link.location));derived.locationParents.forEach(link=>straightEdge(link.child,link.parent,`edge hierarchy-edge${currentEvent?.type==="location_parent"&&currentEvent.source===link.child&&currentEvent.location===link.parent?" newly-revealed-edge":""}`,link.child,link.parent));
  derived.locations.forEach((visit,character)=>straightEdge(character,visit.location,`edge location-edge${currentEvent?.type==="movement"&&currentEvent.source===character&&currentEvent.location===visit.location?" newly-revealed-edge":""}`,character,visit.location));
  derived.identityParents.forEach(link=>straightEdge(link.child,link.parent,`edge identity-edge${currentEvent?.type==="identity_parent"&&currentEvent.source===link.child&&currentEvent.target===link.parent?" newly-revealed-edge":""}`,link.child,link.parent));
  const activeIds=new Set(currentEvent?[currentEvent.source,currentEvent.target,currentEvent.location,...(currentEvent.characters||[])].filter(Boolean):[]);
  visible.forEach(item=>{const state=derived.states.get(item.id),shownName=state.displayName||item.name,pos=positions.get(item.id),mentionedOnly=item.kind==="character"&&state.mentioned!==null&&(state.appeared===null||state.appeared>currentChapter),newlyRevealed=!previousVisibleIds.has(item.id),eventActive=activeIds.has(item.id),chapterChanged=chapterChangedIds.has(item.id),cultivationReveal=currentEvent?.type==="cultivation"&&currentEvent.source===item.id,priorCultivationState=cultivationReveal?priorCultivationDerived?.states.get(item.id):null,priorCultivationLevel=cultivationReveal?(priorCultivationState?.level||0):(state.level||0),group=svgEl("g",{class:`node ${item.kind}${mentionedOnly?" mentioned-only":""}${newlyRevealed?" newly-revealed-node":""}${chapterChanged?" chapter-changed-node":""}${eventActive?" event-active-node":""}${cultivationReveal?" cultivation-reveal":""}`,"data-id":item.id,role:"button",tabindex:0,"aria-label":mentionedOnly?`${shownName}, mentioned but not appeared`:shownName,transform:`translate(${pos.x},${pos.y})`});let labelY=item.kind==="character"?5:58;
    if(item.kind==="organization"){const points=Array.from({length:6},(_,i)=>{const angle=Math.PI/3*i-Math.PI/6;return `${39*Math.cos(angle)},${39*Math.sin(angle)}`}).join(" ");group.append(svgEl("circle",{cx:0,cy:0,r:46,class:"node-hit-target"}),svgEl("polygon",{points,class:"org-shape"}));
    }else if(item.kind==="location"){const {rx,ry}=locationMetrics(item.id);labelY=-ry-10;group.append(svgEl("ellipse",{cx:0,cy:0,rx,ry,class:"location-region"}),svgEl("circle",{cx:0,cy:0,r:24,class:"node-hit-target location-hit-target"}),svgEl("circle",{cx:0,cy:0,r:4,class:"location-region-core"}));
    }else{const appeared=state.appeared!==null&&state.appeared<=currentChapter,r=appeared?radius(state):20;group.appendChild(svgEl("circle",{cx:0,cy:0,r:Math.max(44,r+22),class:"node-hit-target"}));if(!appeared){group.append(svgEl("circle",{cx:0,cy:0,r:r+7,class:"ghost-ring"}),svgEl("circle",{cx:0,cy:0,r,class:`ghost-core ${state.gender==="female"?"core-female":"core-male"}`}));}else{const lifeClass=state.status==="dead"?"life-dead":state.status==="alive"?"life-alive":"life-unknown";group.append(svgEl("circle",{cx:0,cy:0,r:r+7,class:lifeClass}),svgEl("circle",{cx:0,cy:0,r,class:state.gender==="female"?"core-female":"core-male"}));if(cultivationReveal)group.appendChild(svgEl("circle",{cx:0,cy:0,r:r+11,class:"cultivation-reveal-pulse"}));const segmentAngle=360/CULTIVATION_LEVELS.length;for(let seg=0;seg<CULTIVATION_LEVELS.length;seg++){const start=-88+seg*segmentAngle,isOn=state.level>seg,wasOn=priorCultivationLevel>seg,isChanged=cultivationReveal&&isOn!==wasOn,isGain=isChanged&&isOn;group.appendChild(svgEl("path",{d:arcPath(0,0,r+(isChanged?21:15),start,start+segmentAngle*.76),class:`${isOn?"corona-on":"corona-off"}${isChanged?` cultivation-change-segment ${isGain?"cultivation-gain":"cultivation-loss"}`:""}`,...(isChanged?{pathLength:1,style:`--cultivation-delay:${Math.abs(seg-priorCultivationLevel)*55}ms`}:{})}));}if(cultivationReveal){const before=priorCultivationLevel?(priorCultivationState?.realm||priorCultivationState?.canonicalRealm||CULTIVATION_LEVELS[priorCultivationLevel-1]):"Unrevealed",after=state.realm||state.canonicalRealm,changeLabel=svgEl("text",{x:0,y:-r-35,class:"cultivation-change-label"});changeLabel.textContent=currentEvent.initial===true&&!priorCultivationLevel?`Cultivation revealed: ${after}`:before===after?after:`${before} → ${after}`;group.appendChild(changeLabel);}const gems=Math.min(7,state.aliases.length),gemR=r+27;for(let i=0;i<gems;i++){const angle=Math.PI+(i+1)*Math.PI/(gems+1);group.appendChild(svgEl("polygon",{points:diamondPoints(Math.cos(angle)*gemR,Math.sin(angle)*gemR,4),class:"alias-gem"}));}}}
    const label=svgEl("text",{x:0,y:labelY,class:`node-label${item.kind==="location"?" location-region-label":""}`});label.textContent=shownName;group.appendChild(label);if(mentionedOnly){const stateLabel=svgEl("text",{x:0,y:39,class:"node-state-label"});stateLabel.textContent="MENTIONED";group.appendChild(stateLabel);}
    group.addEventListener("pointerdown",event=>{if(event.button!==undefined&&event.button!==0)return;event.stopPropagation();physics.dragId=item.id;dragMoved=false;dragStartClient={x:event.clientX,y:event.clientY};const c=toContentPoint(event.clientX,event.clientY),p=positions.get(item.id);dragOffset={x:p.x-c.x,y:p.y-c.y};physics.vel.set(item.id,{x:0,y:0});group.classList.add("dragging");group.setPointerCapture(event.pointerId);});
    group.addEventListener("pointermove",event=>{if(physics.dragId!==item.id)return;const c=toContentPoint(event.clientX,event.clientY),p=positions.get(item.id);p.x=c.x+dragOffset.x;p.y=c.y+dragOffset.y;if(!dragMoved&&Math.hypot(event.clientX-dragStartClient.x,event.clientY-dragStartClient.y)>4)dragMoved=true;});
    const selectNode=()=>{cancelChapterSequence();const next=selectedId===item.id?null:item.id;if(next!==selectedId||item.kind!=="location")locationPovId=null;selectedId=next;setMobilePanel("info");renderAll();};
    const endDrag=event=>{if(physics.dragId!==item.id)return;physics.dragId=null;group.classList.remove("dragging");if(event.type==="pointerup"&&!dragMoved)selectNode();};
    group.addEventListener("pointerup",endDrag);group.addEventListener("pointercancel",endDrag);
    group.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();selectNode();});
    group.addEventListener("dblclick",()=>openProfile(item.id));
    (item.kind==="location"?regionLayer:nodeLayer).appendChild(group);nodeEls.set(item.id,group);
  });
  applyGraphFocus(derived);
}

function applyGraphFocus(derived){if(!selectedId)return;const chosen=entity(selectedId),connected=new Set([selectedId]);document.querySelectorAll("#graph .edge").forEach(edge=>{const match=edge.dataset.a===selectedId||edge.dataset.b===selectedId;if(match){connected.add(edge.dataset.a);connected.add(edge.dataset.b);edge.classList.add("selected-connection");}else edge.classList.add("dim");});document.querySelectorAll("#graph .node").forEach(node=>{if(node.dataset.id===selectedId)node.classList.add("selected");else if(connected.has(node.dataset.id))node.classList.add("selected-neighbor");else node.classList.add("dim");});if(chosen?.kind==="organization"||chosen?.kind==="location")document.querySelectorAll("#graph .relation-edge").forEach(edge=>edge.classList.add("hidden"));}

function summaryPills(items,limit=3){if(!items.length)return "";return `<div class="summary-pills">${items.slice(0,limit).map(item=>{const record=typeof item==="string"?{label:item}:item,label=record.label||item,url=record.id?entityWikiUrl(record.id):"";return url?`<a class="${escapeHtml(record.tone||"")}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<i aria-hidden="true">↗</i></a>`:`<span class="${escapeHtml(record.tone||"")}">${escapeHtml(label)}</span>`;}).join("")}${items.length>limit?`<span class="more">+${items.length-limit}</span>`:""}</div>`;}
function summaryGroup(label,items,limit){return items.length?`<div class="summary-group"><span>${escapeHtml(label)}</span>${summaryPills(items,limit)}</div>`:"";}
function renderSummary(){
  const box=$("#summary"),chosen=entity(selectedId),panelActive=box.classList.contains("mobile-active");if(!chosen){box.className=`side-card summary${panelActive?" mobile-active":""}`;box.innerHTML='<div class="empty">Select a character, organization, or location. Double-click a node for full details.</div>';return;}
  const d=currentDerived(),state=d.states.get(chosen.id),shownName=state.displayName||chosen.name,header=`<div class="summary-title"><div><strong>${entityNameLink(chosen.id,shownName)}</strong><small>${escapeHtml(activeVol().name)} · action ${currentActionIndex}</small></div><button class="button ghost" id="full-details">Show more</button></div>`;
  if(chosen.kind==="organization"){
    const members=d.memberships.filter(m=>m.organization===chosen.id).map(m=>({id:m.character,label:`${stateName(d,m.character)} · ${m.role}`})),places=d.organizationLocations.filter(link=>link.organization===chosen.id).map(link=>({id:link.location,label:`${stateName(d,link.location)} · ${link.role}`}));box.className=`side-card summary${panelActive?" mobile-active":""}`;box.innerHTML=`${header}<div class="summary-stats"><article><span>Active members</span><strong>${members.length}</strong></article><article><span>Locations</span><strong>${places.length}</strong></article><article><span>Introduced</span><strong>Ch. ${chosen.intro}</strong></article></div>${summaryGroup("Locations",places,5)}${summaryGroup("Members",members,5)}`;$("#full-details").onclick=()=>openProfile(chosen.id);return;
  }
  if(chosen.kind==="location"){
    const chapterEvents=eventsAtLocation(chosen.id),visitors=[...new Set(chapterEvents.flatMap(locationCharacterIds))].map(id=>({id,label:entity(id)?.name||id})),occupants=[...d.locations.values()].filter(visit=>visit.location===chosen.id).map(visit=>({id:visit.character,label:entity(visit.character)?.name||visit.character})),residents=d.residences.filter(link=>link.location===chosen.id).map(link=>({id:link.character,label:`${entity(link.character)?.name} · ${link.role}`})),organizations=d.organizationLocations.filter(link=>link.location===chosen.id).map(link=>({id:link.organization,label:`${entity(link.organization)?.name} · ${link.role}`})),parent=d.locationParents.find(link=>link.child===chosen.id),children=d.locationParents.filter(link=>link.parent===chosen.id).map(link=>({id:link.child,label:entity(link.child)?.name||link.child})),hierarchy=parent?[{id:parent.parent,label:`Inside ${entity(parent.parent)?.name||parent.parent}`}]:[],pov=locationPovId?[{id:locationPovId,label:`${entity(locationPovId)?.name||locationPovId} event POV`}]:[];box.className=`side-card summary${panelActive?" mobile-active":""}`;box.innerHTML=`${header}<div class="summary-stats"><article><span>Place type</span><strong>${escapeHtml(chosen.locationType||"Other")}</strong></article><article><span>Residents</span><strong>${residents.length}</strong></article><article><span>Here now</span><strong>${occupants.length}</strong></article></div><div class="summary-groups">${summaryGroup("Viewing",pov,1)}${summaryGroup("Hierarchy",hierarchy,1)}${summaryGroup("Contains",children,5)}${summaryGroup("Residents",residents,5)}${summaryGroup("Based here",organizations,5)}${summaryGroup("Here now",occupants,5)}${summaryGroup("Active chapter",visitors,5)}</div>`;$("#full-details").onclick=()=>openProfile(chosen.id);return;
  }
  const applied=appliedEvents(),unrevealed=state.appeared===null||state.appeared>currentChapter,relationItems=[...new Set(applied.filter(e=>e.type==="relationship"&&(e.source===chosen.id||e.target===chosen.id)).map(e=>pairKey(e.source,e.target)))].map(key=>{const [a,b]=key.split("|"),other=a===chosen.id?b:a,history=applied.filter(e=>e.type==="relationship"&&pairKey(e.source,e.target)===key),type=String(history.at(-1)?.value||"neutral").toLowerCase();return {id:other,label:stateName(d,other),tone:`tone-${type}`};}),meetingIds=[...new Set(applied.filter(e=>e.type==="meeting"&&(e.source===chosen.id||e.target===chosen.id)).map(e=>e.source===chosen.id?e.target:e.source))],meetings=meetingIds.map(id=>({id,label:stateName(d,id)})),awareOutIds=[...new Set(applied.filter(e=>e.type==="awareness"&&e.source===chosen.id).map(e=>e.target))],awareOut=awareOutIds.map(id=>({id,label:stateName(d,id)})),awareInIds=[...new Set(applied.filter(e=>e.type==="awareness"&&e.target===chosen.id).map(e=>e.source))],awareIn=awareInIds.map(id=>({id,label:stateName(d,id)})),aliases=state.aliases.map(alias=>({label:alias.value})),organizations=state.memberships.map(m=>({id:m.organization,label:`${stateName(d,m.organization)} · ${m.role}`})),identityParent=d.identityParents.find(link=>link.child===chosen.id),identityChildren=d.identityParents.filter(link=>link.parent===chosen.id).map(link=>({id:link.child,label:`${stateName(d,link.child)} · ${link.relation}`})),identityFamily=[...(identityParent?[{id:identityParent.parent,label:`${stateName(d,identityParent.parent)} · ${identityParent.relation} parent`}]:[]),...identityChildren];
  const currentPlace=d.locations.get(chosen.id),currentPlaces=currentPlace?[{id:currentPlace.location,label:entity(currentPlace.location)?.name||currentPlace.location}]:[],chapterPlaces=[...new Set(d.locationVisits.filter(visit=>visit.character===chosen.id&&visit.chapter===currentChapter).map(visit=>visit.location))].map(id=>({id,label:entity(id)?.name||id})),residences=d.residences.filter(link=>link.character===chosen.id).map(link=>({id:link.location,label:`${entity(link.location)?.name} · ${link.role}`}));
  const stats=[{label:"State",value:unrevealed?"Mentioned":"Appeared"},!unrevealed&&state.realm!=="Unrevealed"?{label:"Cultivation",value:state.realm.toLowerCase()===state.canonicalRealm.toLowerCase()?state.realm:`${state.realm} · ${state.canonicalRealm}`} : null,!unrevealed&&state.status!=="unknown"?{label:"Status",value:state.status}:null].filter(Boolean);
  box.className=`side-card summary${panelActive?" mobile-active":""}${unrevealed?" muted":""}`;box.innerHTML=`${header}<div class="summary-stats">${stats.map(stat=>`<article><span>${escapeHtml(stat.label)}</span><strong>${escapeHtml(stat.value)}</strong></article>`).join("")}</div><div class="summary-groups">${summaryGroup("Identity family",identityFamily,4)}${summaryGroup("Current place",currentPlaces,1)}${summaryGroup("Homes / bases",residences,3)}${summaryGroup("Places this chapter",chapterPlaces,4)}${summaryGroup("Aliases",aliases,3)}${summaryGroup("Organizations",organizations,2)}${summaryGroup("Relations",relationItems,4)}${summaryGroup("Met",meetings,4)}${summaryGroup("Aware of",awareOut,4)}${summaryGroup("Known by",awareIn,4)}</div>`;$("#full-details").onclick=()=>openProfile(chosen.id);
}

function eventPanelRow(event,index,{current=false,related=false}={}){return `<li class="event-summary-row${current?" current-action":""}${related?" selection-related-event":""}"${index?` data-focus-action="${index}" title="Show this action on the graph"`:""}><div><div class="event-panel-meta"><span>Chapter ${event.chapter}</span><b class="event-type event-${escapeHtml(event.type)}">${escapeHtml(event.type.replaceAll("_"," "))}</b></div><p>${richText(event.description||event.type)}${event.location?` <small>· ${escapeHtml(entity(event.location)?.name||event.location)}</small>`:""}</p></div>${eventOriginControl(event)}</li>`;}
function bindEventPanelRows(){document.querySelectorAll("[data-focus-action]").forEach(row=>row.onclick=event=>{if(event.target.closest("button,a"))return;cancelChapterSequence();currentActionIndex=Number(row.dataset.focusAction);currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();});}
function renderEvents(){const list=$("#events-list"),event=currentActionEvent(),card=list.closest(".events-card");list.className="events-list";card.classList.toggle("selection-event-mode",Boolean(selectedId));card.classList.toggle("current-event-mode",Boolean(event&&!selectedId));if(!event){$("#events-title").textContent=`${activeVol().name} · Start`;$("#events-count").textContent="Action 0";list.innerHTML='<li class="slider-start-message"><strong>Use the slider to begin</strong><span>Each step reveals one story action in entry order.</span></li>';return;}if(selectedId){const chosen=entity(selectedId),actions=volumeActions().slice(0,currentActionIndex).map((item,index)=>({event:item,index:index+1})).filter(entry=>eventInvolves(entry.event,selectedId));$("#events-title").textContent=`${stateName(currentDerived(),selectedId)} · connected events`;$("#events-count").textContent=`${actions.length} shown`;list.innerHTML=`<li class="selection-event-note"><strong>Connection focus</strong><span>Click ${escapeHtml(chosen?.name||"this node")} again to return to the current event.</span></li>${actions.length?actions.slice().reverse().map(entry=>eventPanelRow(entry.event,entry.index,{current:entry.index===currentActionIndex,related:true})).join(""):'<li class="selection-event-empty">No connected event has been revealed yet.</li>'}`;bindEventPanelRows();return;}$("#events-title").textContent=`Chapter ${event.chapter} · Action ${currentActionIndex}`;$("#events-count").textContent=event.type;list.innerHTML=eventPanelRow(event,currentActionIndex,{current:true});bindEventPanelRows();}

function renderAll(){configureTimeline();renderGraph();renderSummary();renderEvents();renderAdmin();updateSuggestions();cacheActiveVolume();}

function setMobilePanel(name){
  document.querySelectorAll(".mobile-panel-tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.panel===name));
  document.querySelectorAll("[data-panel-content]").forEach(panel=>panel.classList.toggle("mobile-active",panel.dataset.panelContent===name));
}

function chipList(items){return items?.length?`<div class="profile-chips">${items.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`:"";}
function proseList(items){return items?.length?`<ul class="wiki-list">${items.map(item=>`<li>${richText(item)}</li>`).join("")}</ul>`:"";}
function fact(label,value){if(value===undefined||value===null||value===""||value==="Unknown"||value==="unknown"||value==="Unrevealed"||value==="None")return "";return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${richText(value)}</dd></div>`;}
function profileSection(id,title,body,kicker="Dossier"){return `<section class="wiki-section" id="${id}"><div class="wiki-section-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></div>${body}</section>`;}
function safeImageUrl(value){try{const url=new URL(value,location.href);return ["http:","https:"].includes(url.protocol)?url.href:"";}catch{return "";}}

async function loadProfileFor(item){
  if(item.profile===null)return {};
  if(item.profile&&Object.keys(item.profile).length)return item.profile;
  const loader=profileLoaders[`./profiles/${item.id}.js`];if(!loader)return {};
  if(!profilePromises.has(item.id))profilePromises.set(item.id,loader().then(module=>module.default).catch(()=>({})));
  return profilePromises.get(item.id);
}

async function openProfile(id,focusChapter=null){
  const item=entity(id);if(!item)return;
  const volumeSnapshot=activeVol(),profileChapter=volumeSnapshot.to,applied=orderedEvents().filter(event=>event.chapter<=profileChapter),profile=await loadProfileFor(item),derived=derive(profileChapter,applied),state=derived.states.get(id),shownName=state.displayName||item.name,events=applied.filter(e=>eventInvolves(e,id)),aliases=events.filter(e=>e.type==="alias"&&e.source===id),nameChanges=events.filter(e=>e.type==="display_name"&&e.source===id),cultivation=events.filter(e=>e.type==="cultivation"&&e.source===id),statuses=events.filter(e=>e.type==="status"&&e.source===id),membershipEvents=events.filter(e=>e.type==="membership"&&(e.source===id||e.target===id)),initials=shownName.split(/\s+/).map(word=>word[0]).join("").slice(0,2).toUpperCase();
  const profileEvents=events;
  const stopMap=new Map();profileEvents.forEach(event=>{if(!stopMap.has(event.chapter))stopMap.set(event.chapter,[]);stopMap.get(event.chapter).push(event);});const profileStops=[...stopMap].map(([chapter,stopEvents])=>({chapter,events:stopEvents}));
  const relationIds=item.kind==="character"?[...new Set(data.events.filter(e=>e.chapter<=profileChapter&&["relationship","awareness","meeting"].includes(e.type)&&(e.source===id||e.target===id)).map(e=>e.source===id?e.target:e.source).filter(Boolean))]:[];
  const relationCards=relationIds.map(otherId=>{
    const other=entity(otherId),history=relationHistoryFor(id,otherId,profileChapter),meeting=meetingFor(id,otherId,profileChapter),awareOut=data.events.some(e=>e.type==="awareness"&&e.chapter<=profileChapter&&e.source===id&&e.target===otherId),awareIn=data.events.some(e=>e.type==="awareness"&&e.chapter<=profileChapter&&e.source===otherId&&e.target===id),relation=history.length?String(history.at(-1).value||"neutral").toLowerCase():"neutral";
    const knowledge=meeting?`Met in chapter ${meeting.chapter}`:awareOut&&awareIn?"Mutually aware":awareOut?`${item.name} is aware of ${other?.name}`:`Known by ${other?.name}`;
    const changes=history.map(event=>`Chapter ${event.chapter}: ${event.value}`).join(" → ")||"No formal relationship recorded";
    return `<article class="relation-card ${relation in COLORS?relation:"neutral"}"><div class="relation-card-head"><strong>${entityNameLink(otherId,other?.name||otherId)}</strong><span>${escapeHtml(relation)}</span></div><p>${escapeHtml(knowledge)}</p><small>${escapeHtml(changes)}</small></article>`;
  }).join("")||'<p class="profile-empty">No relationships are known by this chapter.</p>';
  const activeMemberships=item.kind==="character"?state.memberships:item.kind==="organization"?derived.memberships.filter(m=>m.organization===id):[];
  const organizationNames=activeMemberships.map(m=>item.kind==="character"?`${entity(m.organization)?.name} — ${m.role}`:`${entity(m.character)?.name} — ${m.role}`);
  const locationVisitors=item.kind==="location"?[...new Set(events.flatMap(locationCharacterIds))].map(visitorId=>entity(visitorId)?.name||visitorId):[];
  const currentLocation=item.kind==="character"?derived.locations.get(id):null,movementEvents=item.kind==="character"?events.filter(event=>event.type==="movement"&&event.source===id):[];
  const residenceEvents=events.filter(event=>event.type==="residency"&&(event.source===id||event.location===id)),activeResidences=item.kind==="character"?derived.residences.filter(link=>link.character===id):item.kind==="location"?derived.residences.filter(link=>link.location===id):[];
  const locationHistory=movementEvents.length||residenceEvents.length?profileSection("profile-locations","Travel & residences",`${movementEvents.length?`<h3>Movement</h3><div class="history-table">${movementEvents.map(event=>`<div><span>Chapter ${event.chapter}</span><strong>${escapeHtml(entity(event.location)?.name||event.location||"Unknown location")}</strong><em>${richText(event.description||"Moved")}</em></div>`).join("")}</div>`:""}${residenceEvents.length?`<h3>Residence history</h3><div class="history-table">${residenceEvents.map(event=>`<div><span>Chapter ${event.chapter}</span><strong>${escapeHtml(item.kind==="character"?(entity(event.location)?.name||event.location):(entity(event.source)?.name||event.source))}</strong><em>${escapeHtml(event.action==="end"?"Residence ended":event.value||"Resident")}</em></div>`).join("")}</div>`:""}`,"Whereabouts"):"";
  const profilePovIds=item.kind==="location"?[...new Set(events.flatMap(locationCharacterIds))]:[];
  const activeOrganizationLocations=item.kind==="organization"?derived.organizationLocations.filter(link=>link.organization===id):item.kind==="location"?derived.organizationLocations.filter(link=>link.location===id):[];
  const organizationLocationEvents=events.filter(event=>event.type==="organization_location");
  const organizationLocationBody=organizationLocationEvents.length?`<div class="history-table">${organizationLocationEvents.map(event=>`<div><span>Chapter ${event.chapter}</span><strong>${escapeHtml(item.kind==="organization"?(entity(event.location)?.name||event.location):(entity(event.source)?.name||event.source))}</strong><em>${escapeHtml(event.action==="close"?`${event.value||"Location"} closed`:event.value||"Branch")}</em></div>`).join("")}</div>`:"";
  const parentLink=item.kind==="location"?derived.locationParents.find(link=>link.child===id):null,childLinks=item.kind==="location"?derived.locationParents.filter(link=>link.parent===id):[],lineageIds=item.kind==="location"?locationLineage(id,derived):[],isMasterLocation=item.kind==="location"&&lineageIds[0]===id;
  const locationNetwork=item.kind==="location"?profileSection("profile-places","Place network",`${parentLink?`<button type="button" class="location-up-link" data-open-location="${escapeHtml(parentLink.parent)}">← Go up to ${escapeHtml(entity(parentLink.parent)?.name||parentLink.parent)}</button>`:""}${lineageIds.length?`<h3>Hierarchy</h3><nav class="location-breadcrumb" aria-label="Location hierarchy">${lineageIds.map((locationId,index)=>index===lineageIds.length-1?`<span aria-current="page">${escapeHtml(entity(locationId)?.name||locationId)}</span>`:`<button type="button" data-open-location="${escapeHtml(locationId)}">${escapeHtml(entity(locationId)?.name||locationId)}</button><i>›</i>`).join("")}</nav>`:""}${childLinks.length?`<h3>Contains</h3><div class="location-nav-chips">${childLinks.map(link=>`<button type="button" data-open-location="${escapeHtml(link.child)}"><span>${escapeHtml(entity(link.child)?.locationType||"Place")}</span>${escapeHtml(entity(link.child)?.name||link.child)}</button>`).join("")}</div>`:""}${activeResidences.length?`<h3>Residents & long-term bases</h3>${chipList(activeResidences.map(link=>`${entity(link.character)?.name} — ${link.role}`))}`:""}${activeOrganizationLocations.length?`<h3>Organizations based here</h3>${chipList(activeOrganizationLocations.map(link=>`${entity(link.organization)?.name} — ${link.role}`))}`:""}${organizationLocationBody}`,"Hierarchy, residents, and organizations"):"";
  const branchArchives=isMasterLocation?childLinks.map(link=>{const locationIds=[link.child,...locationDescendants(link.child,derived)],locationSet=new Set(locationIds),branchEvents=data.events.filter(event=>event.chapter<=profileChapter&&locationSet.has(event.location)).sort((a,b)=>a.chapter-b.chapter||(a.order||0)-(b.order||0));return {id:link.child,locationIds,events:branchEvents};}).filter(branch=>branch.events.length):[];
  const descendantArchive=branchArchives.length?profileSection("profile-sub-locations","Sub-location activity",`<p class="sub-location-explainer">This master location keeps its own timeline separate. Open a branch only when you want the events recorded inside its descendant places.</p><div class="sub-location-archive">${branchArchives.map(branch=>{const lastChapter=branch.events.at(-1)?.chapter;return `<details data-sub-location-branch="${escapeHtml(branch.id)}"><summary><div><span>${escapeHtml(entity(branch.id)?.locationType||"Place")}</span><strong>${escapeHtml(entity(branch.id)?.name||branch.id)}</strong></div><div><b>${branch.locationIds.length} place${branch.locationIds.length===1?"":"s"}</b><b>${branch.events.length} event${branch.events.length===1?"":"s"}</b><small>through chapter ${lastChapter}</small></div></summary><div class="sub-location-branch-body"><p>Open to load this branch.</p></div></details>`;}).join("")}</div>`,"Collapsed descendant archive"):"";
  const organizationPlaces=item.kind==="organization"&&(activeOrganizationLocations.length||organizationLocationEvents.length)?profileSection("profile-places","Locations & branches",`${chipList(activeOrganizationLocations.map(link=>`${entity(link.location)?.name} — ${link.role}`))}${organizationLocationBody}`,"Organization map"):locationNetwork;
  const timeline=profileEvents.map(event=>{
    const counterpart=event.target&&event.target!==id?entity(event.target)?.name:event.source!==id?entity(event.source)?.name:null;
    return `<li class="profile-event-link" data-event-index="${profileStops.findIndex(stop=>stop.chapter===event.chapter)}" data-event-chapter="${event.chapter}"><span class="timeline-dot event-${escapeHtml(event.type)}"></span><div><div class="timeline-meta"><strong>Chapter ${event.chapter}</strong><span>${escapeHtml(event.type)}</span></div><p>${richText(event.description||event.type)}${counterpart?` <em>· ${richText(counterpart)}</em>`:""}${event.location&&event.location!==id?` <em>· at ${richText(entity(event.location)?.name||event.location)}</em>`:""}</p>${chapterCitation(event)}</div></li>`;
  }).join("");
  const cultivationBody=cultivation.length?`<div class="progression-list">${cultivation.map((event,index)=>`<button type="button" class="progression-event" data-event-index="${profileStops.findIndex(stop=>stop.chapter===event.chapter)}"><span class="progression-index">${escapeHtml(event.level||index+1)}</span><div><strong>${escapeHtml(cultivationDisplay(event))}</strong><p>${cultivationDisplay(event).toLowerCase()===cultivationCanonical(event).toLowerCase()?"Canonical tier":`Equivalent to ${escapeHtml(cultivationCanonical(event))}`} · Chapter ${event.chapter}</p></div><span class="progression-jump">View event →</span></button>`).join("")}</div>`:"";
  const membershipBody=membershipEvents.length?`<div class="history-table">${membershipEvents.map(event=>`<div><span>Chapter ${event.chapter}</span><strong>${escapeHtml(item.kind==="organization"?(entity(event.source)?.name||event.source):(entity(event.target)?.name||event.target))}</strong><em>${escapeHtml(event.action==="leave"?"Left":event.action==="reveal"?`${event.value||"Member"} · revealed`:event.value||"Member")}</em></div>`).join("")}</div>`:"";
  const initialProfilePov=item.kind==="location"?(profilePovIds.includes(locationPovId)?locationPovId:profilePovIds[0]||null):null,stopsForProfilePov=povId=>{const filtered=povId?profileEvents.filter(event=>locationCharacterIds(event).includes(povId)):profileEvents,map=new Map();filtered.forEach(event=>{if(!map.has(event.chapter))map.set(event.chapter,[]);map.get(event.chapter).push(event);});return [...map].map(([chapter,stopEvents])=>({chapter,events:stopEvents}));},initialNavigatorStops=stopsForProfilePov(initialProfilePov),marksForStops=stops=>stops.map((stop,index)=>{const types=[...new Set(stop.events.map(event=>event.type))];return `<button type="button" class="event-mark${index===stops.length-1?" active":""}" style="left:${stops.length===1?50:index/(stops.length-1)*100}%;--marker-fill:${eventMarkerFill(stop.events)}" data-event-index="${index}" title="Chapter ${stop.chapter} · ${escapeHtml(types.join(", "))}" aria-label="Chapter ${stop.chapter} ${escapeHtml(types.join(", "))}"></button>`;}).join("");
  const profilePovPicker=item.kind==="location"?`<label class="profile-pov-picker"><span>Character event POV</span><select id="profile-pov-select"><option value="">All characters (combined)</option>${profilePovIds.map(characterId=>`<option value="${escapeHtml(characterId)}"${initialProfilePov===characterId?" selected":""}>${escapeHtml(entity(characterId)?.name||characterId)}</option>`).join("")}</select></label>`:"";
  const eventNavigator=profileStops.length?profileSection("profile-events","Story event navigator",`<p class="profile-snapshot-note">The dossier above shows the end of ${escapeHtml(volumeSnapshot.name)}. Use this scroller to inspect each change through chapter ${profileChapter}.</p><div class="profile-event-navigator">${profilePovPicker}<div class="event-slider-head"><span>Chapter stop <strong id="profile-event-position">${initialNavigatorStops.length}</strong> of <span id="profile-event-total">${initialNavigatorStops.length}</span></span><span id="profile-event-chapter">Chapter ${initialNavigatorStops.at(-1)?.chapter||profileChapter}</span></div><div class="event-range-row"><button type="button" id="profile-event-previous" aria-label="Previous event">−</button><div class="event-range-wrap"><input id="profile-event-range" type="range" min="0" max="${Math.max(0,initialNavigatorStops.length-1)}" value="${Math.max(0,initialNavigatorStops.length-1)}" step="1"><div class="event-marks">${marksForStops(initialNavigatorStops)}</div></div><button type="button" id="profile-event-next" aria-label="Next event">+</button></div><div class="event-marker-legend"><span class="cultivation">Cultivation</span><span class="relationship">Relationship</span><span class="status">Status</span><span class="alias">Alias</span><span class="membership">Membership</span><span class="movement">Travel</span><span class="residency">Residence</span><span class="location-parent">Hierarchy</span><span class="organization-location">Org location</span><span class="meeting">Meeting</span><span class="awareness">Awareness</span><span class="mention">Mention / appearance</span><span class="note">Story note</span></div><article id="profile-event-detail" class="profile-event-detail"></article></div>`,item.kind==="location"?"Character-filtered place history":"Changes through volume end"):"";
  const toc=["Overview",profile.history?"Biography":null,item.kind==="character"&&profile.appearance?"Appearance":null,item.kind==="character"&&profile.personality?"Personality":null,item.kind==="character"&&(cultivation.length||profile.abilities?.length)?"Cultivation":null,locationHistory?"Locations":null,item.kind!=="character"&&(profile.purpose||profile.traits?.length)?"Purpose":null,organizationPlaces?"Places":null,descendantArchive?"Sub-locations":null,(activeMemberships.length||membershipEvents.length)?"Affiliations":null,relationIds.length?"Relationships":null,profileStops.length?"Events":null,profileEvents.length?"Chronology":null,(profile.achievements?.length||profile.trivia?.length)?"Trivia":null].filter(Boolean);
  const sectionId=label=>`profile-${label.toLowerCase()}`;
  const portraitUrl=safeImageUrl(profile.image||"");
  const heroBadgeValues=item.kind==="character"?[state.status!=="unknown"?state.status:null,state.realm!=="Unrevealed"?state.realm:null,currentLocation?entity(currentLocation.location)?.name:null,...(profile.roles||[]).slice(0,2)]:item.kind==="organization"?[activeMemberships.length?`${activeMemberships.length} active members`:null,...(profile.roles||[]).slice(0,3)]:[item.locationType||"Location",activeResidences.length?`${activeResidences.length} residents`:null,locationVisitors.length?`${locationVisitors.length} recorded visitors`:null];
  const heroBadges=heroBadgeValues.filter(Boolean).map(value=>`<span class="${value===state.status?`status-${escapeHtml(state.status)}`:""}">${escapeHtml(value)}</span>`).join("");
  const genders=events.filter(e=>e.type==="gender"&&e.source===id),ages=events.filter(e=>e.type==="age"&&e.source===id),latestGenderEvent=genders.at(-1),latestAgeEvent=ages.at(-1);
  const citedFact=(value,event)=>event?`${value} | ${event.chapter}${event.sourceUrl?` | ${event.sourceUrl}`:""}`:value;
  const coreInfoboxFacts=item.kind==="character"?[
    fact("Species",profile.species||"Unknown"),fact("Gender",citedFact(state.gender,latestGenderEvent)),fact("Age",citedFact(state.age,latestAgeEvent)),fact("Presence",state.appeared===null||state.appeared>profileChapter?"Mentioned, not appeared":"Appeared"),fact("Status",state.status),fact("Cultivation",state.appeared===null||state.appeared>profileChapter?"Unrevealed":state.realm.toLowerCase()===state.canonicalRealm.toLowerCase()?state.realm:`${state.realm} (equivalent to ${state.canonicalRealm})`),fact("Current location",currentLocation?(entity(currentLocation.location)?.name||currentLocation.location):"Unknown"),fact("First mentioned",state.mentioned!==null?`Chapter ${state.mentioned}`:""),fact("First appearance",state.appeared!==null&&state.appeared<=profileChapter?`Chapter ${state.appeared}`:""),fact("Affiliations",organizationNames.join(", ")||"None")
  ].join(""):item.kind==="organization"?[fact("Type","Organization"),fact("Introduced",`Chapter ${item.intro}`),fact("Active members",String(activeMemberships.length)),fact("Active locations",String(activeOrganizationLocations.length)),fact("Purpose",profile.purpose||"Unknown")].join(""):[fact("Type",item.locationType||"Location"),fact("Inside",parentLink?entity(parentLink.parent)?.name:""),fact("Contains",String(childLinks.length)),fact("Residents",String(activeResidences.length)),fact("Introduced",`Chapter ${item.intro}`),fact("Recorded visitors",String(locationVisitors.length)),fact("Organizations",String(activeOrganizationLocations.length)),fact("Description",profile.purpose||item.description||"Unknown")].join("");
  const infoboxFacts=coreInfoboxFacts+(profile.facts||[]).map(item=>fact(item.label,item.value)).join("");
  const overview=profileSection("profile-overview","Overview",`${item.description?`<p class="lead-copy">${richText(item.description)}</p>`:""}<div class="volume-snapshot-banner"><span>End-of-volume snapshot</span><strong>${escapeHtml(volumeSnapshot.name)} · Chapter ${profileChapter}</strong></div><div class="overview-stat-grid"><article><span>${item.kind==="character"?"Presence by volume end":"Known by volume end"}</span><strong>${escapeHtml(item.kind==="character"?(state.appeared===null||state.appeared>profileChapter?"Mentioned":"Appeared"):item.kind==="organization"?"Known organization":"Known location")}</strong></article><article><span>Events through volume end</span><strong>${events.length}</strong></article><article><span>${item.kind==="character"?"Known aliases":item.kind==="organization"?"Active members":"Recorded visitors"}</span><strong>${item.kind==="character"?aliases.length:item.kind==="organization"?activeMemberships.length:locationVisitors.length}</strong></article></div>`,"Volume-end knowledge");
  const biography=profile.history?profileSection("profile-biography",item.kind==="character"?"Biography":"History",`<p>${richText(profile.history)}</p>`,"Story"):"";
  const appearance=item.kind==="character"&&profile.appearance?profileSection("profile-appearance","Appearance",`<p>${richText(profile.appearance)}</p>`,"Physical description"):"";
  const personality=item.kind==="character"&&profile.personality?profileSection("profile-personality","Personality",`<p>${richText(profile.personality)}</p>`,"Characterization"):"";
  const powerOrPurpose=item.kind==="character"?(cultivation.length||profile.abilities?.length?profileSection("profile-cultivation","Cultivation & abilities",`${cultivationBody}${profile.abilities?.length?`<h3>Known abilities</h3>${proseList(profile.abilities)}`:""}`,"Progression"):""):(profile.purpose||profile.traits?.length?profileSection("profile-purpose",item.kind==="location"?"Description & features":"Purpose & identity",`${profile.purpose?`<p>${richText(profile.purpose)}</p>`:""}${profile.traits?.length?`<h3>${item.kind==="location"?"Notable features":"Defining traits"}</h3>${chipList(profile.traits)}`:""}`,item.kind==="location"?"Location":"Organization"):"");
  const affiliations=activeMemberships.length||membershipEvents.length?profileSection("profile-affiliations","Affiliations",`${chipList(organizationNames)}${membershipBody}`,"Organizations"):"";
  const relationships=relationIds.length?profileSection("profile-relationships","Relationships",`<div class="relation-grid">${relationCards}</div>`,"Connections"):"";
  const chronology=profileEvents.length?profileSection("profile-chronology","Complete chronology",`<div class="chronology-scroll"><ol class="profile-timeline">${timeline}</ol></div>`,`${profileEvents.length} recorded events`):"";
  const achievementBlock=profile.achievements?.length?`<article><h3>Achievements</h3>${achievementList(profile.achievements)}</article>`:"",triviaBlock=profile.trivia?.length?`<article><h3>Trivia</h3>${proseList(profile.trivia)}</article>`:"";
  const trivia=achievementBlock||triviaBlock?profileSection("profile-trivia","Achievements & trivia",`<div class="trivia-grid">${achievementBlock}${triviaBlock}</div>`,"Additional information"):"";
  $("#profile-title").textContent=shownName;
  $("#profile-body").innerHTML=`
    <article class="wiki-profile ${item.kind} ${item.gender||item.kind}">
      <header class="profile-hero ${item.gender||item.kind}">
        <div class="hero-copy"><span class="hero-kicker">${item.kind==="character"?"Character dossier":item.kind==="organization"?"Organization archive":"Location archive"} · ${escapeHtml(volumeSnapshot.name)} through chapter ${profileChapter}</span><h1>${entityNameLink(item.id,shownName,"profile-wiki-name")}</h1>${profile.subtitle||item.description?`<p>${richText(profile.subtitle||item.description)}</p>`:""}${heroBadges?`<div class="hero-badges">${heroBadges}</div>`:""}</div>
        <button type="button" class="chapter-ref-toggle profile-hero-toggle" data-chapter-ref-toggle aria-pressed="false" title="Hover marked text to reveal its chapter"><span aria-hidden="true">🔖</span> Chapter refs</button>
        <div class="hero-orbit"><span>${escapeHtml(initials)}</span><i></i><i></i><i></i></div>
      </header>
      <nav class="profile-mobile-nav" aria-label="Profile sections">${["Overview","Cultivation","Locations","Places","Sub-locations","Events","Relationships","Chronology"].filter(label=>toc.includes(label)).map(label=>`<a href="#${sectionId(label)}">${escapeHtml(label)}</a>`).join("")}</nav>
      <div class="wiki-layout">
        <aside class="profile-toc"><strong>Contents</strong><ol>${toc.map(label=>`<li><a href="#${sectionId(label)}">${escapeHtml(label)}</a></li>`).join("")}</ol></aside>
        <main class="wiki-article">
          ${profile.quote?`<blockquote><span>“</span><p>${richText(profile.quote)}</p><cite>— ${escapeHtml(shownName)}</cite></blockquote>`:""}
          ${overview}${biography}${appearance}${personality}${powerOrPurpose}${locationHistory}${organizationPlaces}${descendantArchive}${affiliations}${relationships}${eventNavigator}${chronology}${trivia}
        </main>
        <aside class="profile-infobox${portraitUrl?"":" no-portrait"}">
          ${portraitUrl?`<div class="portrait-card ${item.gender||item.kind}"><img src="${escapeHtml(portraitUrl)}" alt="" loading="lazy" decoding="async"><small>${escapeHtml(profile.subtitle||item.kind)}</small></div>`:""}
          <div class="infobox-name"><span>${escapeHtml(item.kind)}</span><strong>${escapeHtml(shownName)}</strong></div>
          <dl>${infoboxFacts}</dl>
          <section><h3>Names & identities</h3>${chipList([shownName,...nameChanges.map(event=>event.value),...aliases.map(event=>event.value)])}</section>
          ${statuses.length?`<section><h3>Status history</h3>${proseList(statuses.map(event=>citedFact(event.value,event)))}</section>`:""}
          ${genders.length?`<section><h3>Gender history</h3>${proseList(genders.map(event=>citedFact(event.value,event)))}</section>`:""}
          ${ages.length?`<section><h3>Age history</h3>${proseList(ages.map(event=>citedFact(event.value,event)))}</section>`:""}
        </aside>
      </div>
    </article>`;
  syncChapterRefToggles(document.body.classList.contains("show-chapter-refs"));
  $("#profile-body").onclick=event=>{const navigation=event.target.closest("[data-open-location]");if(!navigation)return;event.preventDefault();const nextId=navigation.dataset.openLocation;if(!entity(nextId))return;selectedId=nextId;locationPovId=null;renderAll();openProfile(nextId);};
  document.querySelectorAll("#profile-body [data-sub-location-branch]").forEach(details=>details.addEventListener("toggle",()=>{if(!details.open||details.dataset.loaded)return;const branch=branchArchives.find(candidate=>candidate.id===details.dataset.subLocationBranch);if(!branch)return;const body=details.querySelector(".sub-location-branch-body"),eventsByLocation=new Map();branch.events.forEach(event=>{if(!eventsByLocation.has(event.location))eventsByLocation.set(event.location,[]);eventsByLocation.get(event.location).push(event);});body.innerHTML=`<div class="sub-location-groups">${branch.locationIds.filter(locationId=>eventsByLocation.has(locationId)).map(locationId=>{const locationEvents=eventsByLocation.get(locationId);return `<article class="sub-location-group"><header><button type="button" data-open-location="${escapeHtml(locationId)}"><span>${escapeHtml(entity(locationId)?.locationType||"Place")}</span><strong>${escapeHtml(entity(locationId)?.name||locationId)}</strong></button><b>${locationEvents.length} event${locationEvents.length===1?"":"s"}</b></header><div>${locationEvents.map(event=>`<section><span>Chapter ${event.chapter}</span><i class="event-type event-${escapeHtml(event.type)}">${escapeHtml(event.type)}</i><p>${richText(event.description||event.type)}${chapterCitation(event)}</p></section>`).join("")}</div></article>`;}).join("")}</div>`;details.dataset.loaded="true";}));
  const profileImage=$("#profile-body .portrait-card img");if(profileImage){const hideBrokenPortrait=()=>{profileImage.closest(".portrait-card")?.remove();$("#profile-body .profile-infobox")?.classList.add("no-portrait");};profileImage.addEventListener("error",hideBrokenPortrait,{once:true});if(profileImage.complete&&!profileImage.naturalWidth)hideBrokenPortrait();}
  if(!$("#profile-modal").open)$("#profile-modal").showModal();
  openProfileId=item.id;cacheActiveVolume();
  if(profileStops.length){
    const range=$("#profile-event-range"),previous=$("#profile-event-previous"),next=$("#profile-event-next"),detail=$("#profile-event-detail"),marks=$("#profile-body .event-marks");let navigatorStops=initialNavigatorStops;
    const showEvent=(rawIndex,jump=false)=>{
      if(!navigatorStops.length)return;const index=Math.max(0,Math.min(navigatorStops.length-1,Number(rawIndex))),stop=navigatorStops[index];
      range.value=index;$("#profile-event-position").textContent=index+1;$("#profile-event-chapter").textContent=`Chapter ${stop.chapter}`;previous.disabled=index===0;next.disabled=index===navigatorStops.length-1;
      document.querySelectorAll(".event-mark").forEach(mark=>mark.classList.toggle("active",Number(mark.dataset.eventIndex)===index));
      detail.innerHTML=`<div class="event-detail-heading"><strong>Chapter ${stop.chapter}</strong><span>${stop.events.length} change${stop.events.length===1?"":"s"}</span></div><div class="event-detail-list">${stop.events.map(event=>{const counterpartId=event.target&&event.target!==id?event.target:event.source!==id?event.source:null,placeId=event.location&&event.location!==id?event.location:null;return `<article><span class="event-type event-${escapeHtml(event.type)}">${escapeHtml(event.type)}</span><div><p>${richText(event.description||event.type)}</p>${counterpartId?`<small>Connected identity: ${entityNameLink(counterpartId)}</small>`:""}${placeId?`<small>Location: ${entityNameLink(placeId)}</small>`:""}${chapterCitation(event)}</div></article>`;}).join("")}</div>`;
      if(jump)$("#profile-events").scrollIntoView({behavior:"smooth",block:"start"});
    };
    const bindMarks=()=>document.querySelectorAll("#profile-body .event-mark").forEach(mark=>mark.onclick=()=>showEvent(mark.dataset.eventIndex));
    const selectProfilePov=(povId,requestedChapter=null,jump=false)=>{navigatorStops=stopsForProfilePov(povId);const picker=$("#profile-pov-select");if(picker)picker.value=povId||"";range.max=Math.max(0,navigatorStops.length-1);$("#profile-event-total").textContent=navigatorStops.length;marks.innerHTML=marksForStops(navigatorStops);bindMarks();const requestedIndex=requestedChapter===null?-1:navigatorStops.findIndex(stop=>stop.chapter===Number(requestedChapter));showEvent(requestedIndex>=0?requestedIndex:navigatorStops.length-1,jump);};
    range.addEventListener("input",()=>showEvent(range.value));previous.onclick=()=>showEvent(Number(range.value)-1);next.onclick=()=>showEvent(Number(range.value)+1);
    bindMarks();const profilePovSelect=$("#profile-pov-select");if(profilePovSelect)profilePovSelect.onchange=event=>{const chapter=navigatorStops[Number(range.value)]?.chapter;selectProfilePov(event.currentTarget.value||null,chapter);};
    document.querySelectorAll(".progression-event,.profile-event-link").forEach(element=>element.addEventListener("click",event=>{if(event.target.closest("a"))return;if(item.kind==="location"){const chapter=Number(element.dataset.eventChapter),povId=element.dataset.characterPov||null;if(povId)selectProfilePov(povId,chapter,true);else{const index=navigatorStops.findIndex(stop=>stop.chapter===chapter);if(index>=0)showEvent(index,true);else selectProfilePov(null,chapter,true);}}else showEvent(element.dataset.eventIndex,true);}));
    const focusedIndex=focusChapter===null?-1:navigatorStops.findIndex(stop=>stop.chapter===Number(focusChapter));showEvent(focusedIndex>=0?focusedIndex:navigatorStops.length-1,focusedIndex>=0);
  }
}

function deleteIdentity(id){const item=entity(id);if(!item)return;const eventCount=data.events.filter(event=>eventInvolves(event,id)).length;if(!confirm(`Delete ${item.name} and ${eventCount} connected events?`))return;data.entities=data.entities.filter(candidate=>candidate.id!==id);data.events=data.events.filter(event=>!eventInvolves(event,id));if(selectedId===id)selectedId=null;if(locationPovId===id)locationPovId=null;if($("#entity-form").elements.editingId.value===id)resetEntityEditor();saveData();renderAll();toast(`${item.name} deleted`);}

function isCreationManagedEvent(record){
  if(!record)return false;
  if(record.creationManaged===true||record.identityIntro===true||record.initial===true)return true;
  const item=entity(record.source);
  if(!item)return false;
  if(item.kind==="character"&&record.type==="mention"&&record.chapter===validChapter(item.mentioned)&&/first time| is mentioned\.?$/i.test(record.description||""))return true;
  if(item.kind==="character"&&record.type==="appearance"&&record.chapter===validChapter(item.appeared)&&/first time| appears alive\.?$/i.test(record.description||""))return true;
  return item.kind!=="character"&&record.type==="note"&&/ is introduced\.?$/i.test(record.description||"");
}
function creationEventsFor(item){return orderedEvents().filter(record=>record.source===item?.id&&isCreationManagedEvent(record));}
function isAutomaticCreationDescription(record){
  if(!record)return true;
  if(record.type==="mention")return / is mentioned(?: for the first time)?\.?$/i.test(record.description||"");
  if(record.type==="appearance")return / appears(?: alive| for the first time)?\.?$/i.test(record.description||"");
  if(record.type==="cultivation")return /cultivation is revealed as/i.test(record.description||"");
  return record.type==="note"&&/ is introduced\.?$/i.test(record.description||"");
}

let renderedChapterSources=undefined;
function renderAdmin(){
  renderVolumeEditor();
  const templateField=$("#chapter-url-template");if(templateField&&document.activeElement!==templateField)templateField.value=data.chapterUrlTemplate||"";
  const sourcesField=$("#chapter-sources-text");if(sourcesField&&document.activeElement!==sourcesField&&renderedChapterSources!==data.chapterSources){sourcesField.value=chapterSourcesToText(data.chapterSources);renderedChapterSources=data.chapterSources;}
  const missingBox=$("#missing-chapter-links");if(missingBox){const missing=referencedChaptersWithoutLinks();missingBox.hidden=!missing.length;if(missing.length)missingBox.querySelector("span").textContent=`Chapter${missing.length===1?"":"s"} ${missing.join(", ")} ${missing.length===1?"is":"are"} referenced somewhere but ${missing.length===1?"has":"have"} no saved link yet.`;}
  const sorted=[...data.events].sort((a,b)=>a.chapter-b.chapter||(a.order||0)-(b.order||0)||String(a.type).localeCompare(String(b.type)));$("#data-count").textContent=`${data.events.length} events`;$("#entity-count").textContent=`${data.entities.length} identities`;$("#entity-table").innerHTML=[...data.entities].sort((a,b)=>a.name.localeCompare(b.name)).map(item=>{const connected=data.events.filter(event=>eventInvolves(event,item.id)).length,intro=item.kind==="character"?(firstMention(item)||firstAppearance(item)||item.intro):item.intro;return `<tr class="${connected?"":"orphan-identity"}"><td><strong>${escapeHtml(item.name)}</strong>${connected?"":'<small class="orphan-warning">Not yet visible on graph</small>'}</td><td><span class="chip">${escapeHtml(item.kind)}</span></td><td>${intro?`Chapter ${intro}`:"—"}</td><td>${connected||'<span class="orphan-warning">0 — repair needed</span>'}</td><td><div class="table-actions"><button class="button ghost edit-identity" data-id="${escapeHtml(item.id)}">Edit identity</button><button class="button ghost delete-identity-row" data-id="${escapeHtml(item.id)}">Delete</button></div></td></tr>`;}).join("");$("#event-table").innerHTML=sorted.map(e=>{const creationManaged=isCreationManagedEvent(e);return `<tr data-event-id="${escapeHtml(e.id)}" data-event-owner="${creationManaged?"identity":"chapter"}"><td>${e.chapter}</td><td><span class="chip">${escapeHtml(e.type)}</span>${creationManaged?'<small class="table-location">creation record</small>':""}</td><td>${escapeHtml([entity(e.source)?.name,e.target?entity(e.target)?.name:null].filter(Boolean).join(" → "))}${e.location?`<small class="table-location">at ${escapeHtml(entity(e.location)?.name||e.location)}</small>`:""}</td><td>${escapeHtml(e.description||"")}</td><td><div class="table-actions"><button class="button ghost edit-event" data-id="${escapeHtml(e.id)}">${creationManaged?"Edit creation":"Edit event"}</button><button class="button ghost delete-event" data-id="${escapeHtml(e.id)}">Delete</button></div></td></tr>`;}).join("");
  document.querySelectorAll(".edit-identity").forEach(button=>button.onclick=()=>loadEntityEditor(button.dataset.id));
  document.querySelectorAll(".delete-identity-row").forEach(button=>button.onclick=()=>deleteIdentity(button.dataset.id));
  document.querySelectorAll(".edit-event").forEach(button=>button.onclick=()=>loadEventEditor(button.dataset.id));
  document.querySelectorAll(".delete-event").forEach(button=>button.onclick=()=>{const record=data.events.find(e=>e.id===button.dataset.id);if(!record||!confirm(`Delete this chapter ${record.chapter} ${record.type} event?`))return;data.events=data.events.filter(e=>e.id!==button.dataset.id);syncPresenceFromEvents(record.source,record.type);if($("#event-form").elements.editingId.value===button.dataset.id)resetEventEditor();saveData();renderAll();toast("Event deleted");});
}

function volumeRowMarkup(volume,index){const eventCount=data.events.filter(event=>event.chapter>=Number(volume.from)&&event.chapter<=Number(volume.to)).length;return `<div class="volume-row" data-volume-id="${escapeHtml(volume.id)}"><span class="volume-order">${index+1}</span><label class="field"><span>Volume name</span><input name="volumeName" value="${escapeHtml(volume.name||"")}" required placeholder="Volume ${index+1}"></label><label class="field"><span>First chapter</span><input name="volumeFrom" type="number" min="1" step="1" value="${escapeHtml(volume.from||1)}" required></label><label class="field"><span>Last chapter</span><input name="volumeTo" type="number" min="1" step="1" value="${escapeHtml(volume.to||volume.from||1)}" required></label><div class="volume-row-actions"><button type="button" class="volume-move" data-move="-1" aria-label="Move ${escapeHtml(volume.name||"volume")} earlier" title="Move earlier">↑</button><button type="button" class="volume-move" data-move="1" aria-label="Move ${escapeHtml(volume.name||"volume")} later" title="Move later">↓</button><button type="button" class="volume-remove" aria-label="Remove ${escapeHtml(volume.name||"volume")}" title="Remove volume">Remove</button></div><small class="volume-event-count">${eventCount} existing event${eventCount===1?"":"s"} in this range</small></div>`;}
function refreshVolumeRowOrder(){const rows=[...document.querySelectorAll("#volume-rows .volume-row")];rows.forEach((row,index)=>{row.querySelector(".volume-order").textContent=index+1;row.querySelector('[data-move="-1"]').disabled=index===0;row.querySelector('[data-move="1"]').disabled=index===rows.length-1;row.querySelector(".volume-remove").disabled=rows.length===1;});}
function renderVolumeEditor(){const rows=$("#volume-rows");if(!rows)return;rows.innerHTML=data.volumes.map(volumeRowMarkup).join("");$("#volume-error").textContent="";refreshVolumeRowOrder();}
function collectVolumeRows(){return [...document.querySelectorAll("#volume-rows .volume-row")].map(row=>({id:row.dataset.volumeId||`volume-${crypto.randomUUID()}`,name:row.querySelector('[name="volumeName"]').value.trim(),from:Number(row.querySelector('[name="volumeFrom"]').value),to:Number(row.querySelector('[name="volumeTo"]').value)}));}
function validateVolumes(volumes){if(!volumes.length)return "Add at least one volume.";const names=new Set();for(let index=0;index<volumes.length;index++){const volume=volumes[index];if(!volume.name)return `Enter a name for volume ${index+1}.`;if(!Number.isInteger(volume.from)||!Number.isInteger(volume.to)||volume.from<1||volume.to<1)return `${volume.name}: chapter numbers must be whole numbers starting from 1.`;if(volume.from>volume.to)return `${volume.name}: the first chapter cannot be after the last chapter.`;const key=volume.name.toLowerCase();if(names.has(key))return `Two volumes cannot both be named “${volume.name}”.`;names.add(key);if(index&&volume.from<=volumes[index-1].to)return `${volume.name} overlaps ${volumes[index-1].name}. Start it after chapter ${volumes[index-1].to}.`;}return "";}

function updateEntityFormFields(){const form=$("#entity-form"),kind=form.elements.kind.value,isCharacter=kind==="character",isLocation=kind==="location";$("#entity-gender-field").hidden=!isCharacter;$("#entity-location-type-field").hidden=!isLocation;$("#entity-mentioned-field").hidden=!isCharacter;$("#entity-initial-cultivation-field").hidden=!isCharacter;$("#entity-initial-cultivation-alias-field").hidden=!isCharacter;$("#entity-appeared-label").textContent=isCharacter?"First appearance chapter (optional)":"Introduction chapter";form.elements.appeared.placeholder=isCharacter?"Leave blank if they have not appeared yet":`When this ${kind} becomes known`;form.elements.appeared.required=!isCharacter;$("#entity-help").textContent=isCharacter?"Presence and cultivation are separate facts. Use the cultivation fields above only for a level confirmed when the character is introduced. Leave Unknown when it has not been revealed; later breakthroughs belong in chapter events.":isLocation?"Choose the place's scale once. Use a hierarchy event to place it inside its direct parent; use movement for travel and residence for long-term homes or bases.":"Create the organization once. Membership and headquarters or branch changes are recorded chapter by chapter.";}
function resetEntityEditor(){const form=$("#entity-form");form.reset();form.elements.editingId.value="";form.elements.editingCreationEventId.value="";$("#creation-edit-note").hidden=true;$("#entity-creation-description-field").hidden=true;$("#entity-form-title").textContent="Create character, organization, or location";$("#save-entity").textContent="Create and add to graph";$("#delete-entity").hidden=true;$("#cancel-entity-edit").hidden=true;$("#manage-entity").value="";updateEntityFormFields();}
function loadEntityEditor(id=null,{scroll=true,creationEventId=""}={}){const item=id?entity(id):resolveEntity($("#manage-entity").value);if(!item){toast("Choose an existing identity");return;}const form=$("#entity-form"),initialCultivation=item.kind==="character"?orderedEvents().find(event=>event.type==="cultivation"&&event.source===item.id&&event.initial===true):null,managedEvents=creationEventsFor(item),selectedCreationEvent=managedEvents.find(event=>event.id===creationEventId)||null,commonSourceUrl=selectedCreationEvent?.sourceUrl||managedEvents.find(event=>event.sourceUrl)?.sourceUrl||"";$("#manage-entity").value=item.name;form.elements.editingId.value=item.id;form.elements.editingCreationEventId.value=selectedCreationEvent?.id||"";form.elements.kind.value=item.kind;form.elements.name.value=item.name;form.elements.gender.value=item.gender||"unknown";form.elements.locationType.value=item.locationType||"Other";form.elements.mentioned.value=item.kind==="character"?(firstMention(item)||""):"";form.elements.appeared.value=item.kind==="character"?(firstAppearance(item)||""):(item.intro||"");form.elements.initialLevel.value=initialCultivation?.level||"";form.elements.initialCultivationAlias.value=initialCultivation&&cultivationDisplay(initialCultivation).toLowerCase()!==cultivationCanonical(initialCultivation).toLowerCase()?cultivationDisplay(initialCultivation):"";form.elements.creationSourceUrl.value=commonSourceUrl;form.elements.creationEventDescription.value=selectedCreationEvent?.description||"";form.elements.description.value=item.description||"";updateEntityFormFields();$("#creation-edit-note").hidden=!selectedCreationEvent;$("#entity-creation-description-field").hidden=!selectedCreationEvent;$("#entity-form-title").textContent=selectedCreationEvent?`Edit creation record — ${item.name}`:`Edit ${item.name}`;$("#save-entity").textContent=selectedCreationEvent?"Update linked creation record":"Save identity";$("#delete-entity").hidden=false;$("#cancel-entity-edit").hidden=false;if(scroll){form.scrollIntoView({behavior:"smooth",block:"start"});(selectedCreationEvent?form.elements.creationEventDescription:form.elements.name).focus({preventScroll:true});}toast(selectedCreationEvent?`Editing the original creation record for ${item.name}`:`${item.name} loaded in the identity form`);}
function resetEventEditor(){const form=$("#event-form");form.reset();form.elements.editingId.value="";form.elements.chapter.value=eventDrafts[0]?.chapter||currentChapter;$("#event-edit-mode-note").hidden=true;$("#event-form-title").textContent="Add chapter changes";$("#save-event").textContent="Save this change";$("#cancel-event-edit").hidden=true;$("#queue-event").hidden=false;updateEventHelp();}
function loadEventEditor(id){const record=data.events.find(event=>event.id===id);if(!record)return;if(isCreationManagedEvent(record)){resetEventEditor();loadEntityEditor(record.source,{creationEventId:record.id});return;}const form=$("#event-form"),isCanonicalCultivationName=record.type==="cultivation"&&CULTIVATION_LEVELS.some(name=>name.toLowerCase()===String(record.value||"").trim().toLowerCase());form.elements.editingId.value=record.id;form.elements.type.value=record.type;form.elements.chapter.value=record.chapter;form.elements.source.value=entity(record.source)?.name||record.source;form.elements.location.value=record.location?(entity(record.location)?.name||record.location):"";form.elements.target.value=record.target?(entity(record.target)?.name||record.target):"";form.elements.value.value=isCanonicalCultivationName?"":record.value||"";form.elements.level.value=record.level||"";form.elements.description.value=record.description||"";form.elements.sourceUrl.value=record.sourceUrl||"";updateEventHelp();const defaults={organization_location:"open",residency:"begin",location_parent:"add",identity_parent:"add",membership:"reveal"};form.elements.action.value=record.action||defaults[record.type]||"join";$("#event-edit-mode-note").hidden=false;$("#event-form-title").textContent=`Edit this exact chapter ${record.chapter} event`;$("#save-event").textContent="Replace this event";$("#cancel-event-edit").hidden=false;$("#queue-event").hidden=true;form.scrollIntoView({behavior:"smooth",block:"start"});form.elements.type.focus({preventScroll:true});toast(`Editing only the selected chapter ${record.chapter} event`);}
function syncPresenceFromEvents(id,type){if(!["mention","appearance","corpse_appearance"].includes(type))return;const item=entity(id);if(!item||item.kind!=="character")return;const field=type==="mention"?"mentioned":"appeared",types=field==="appeared"?["appearance","corpse_appearance"]:["mention"],chapters=data.events.filter(event=>event.source===id&&types.includes(event.type)).map(event=>event.chapter);item[field]=earliestChapter(chapters);}

function listFromText(value,commas=false){return String(value||"").split(commas?/[,\n]/:/\n/).map(item=>item.trim()).filter(Boolean);}
function labelDivider(line){let depth=0;for(let i=0;i<line.length;i++){if(line[i]==="["&&line[i+1]==="["){depth++;i++;continue;}if(line[i]==="]"&&line[i+1]==="]"){depth=Math.max(0,depth-1);i++;continue;}if(line[i]===":"&&depth===0)return i;}return -1;}
function factsFromText(value){return listFromText(value).map(line=>{const divider=labelDivider(line);return divider<1?null:{label:line.slice(0,divider).trim(),value:line.slice(divider+1).trim()};}).filter(item=>item?.label&&item.value);}
function setProfileEditorMode(kind){document.querySelectorAll(".character-profile-field").forEach(field=>field.hidden=kind!=="character");document.querySelectorAll(".organization-profile-field").forEach(field=>field.hidden=kind==="character");$("#profile-purpose-label").textContent=kind==="location"?"Location description":"Organization purpose";$("#profile-traits-label").textContent=kind==="location"?"Notable features — one per line":"Defining traits — one per line";}
async function fillProfileEditor(){
  const form=$("#profile-form"),item=resolveEntity(form.elements.entity.value);if(!item){toast("Choose an existing character, organization, or location");return;}
  const requestedId=item.id,profile=await loadProfileFor(item);if(resolveEntity(form.elements.entity.value)?.id!==requestedId)return;["wikiUrl","subtitle","image","quote","species","history","appearance","personality","purpose"].forEach(name=>form.elements[name].value=profile[name]||"");
  form.elements.roles.value=(profile.roles||[]).join(", ");form.elements.abilities.value=(profile.abilities||[]).join("\n");form.elements.achievements.value=(profile.achievements||[]).map(achievementLine).join("\n");form.elements.traits.value=(profile.traits||[]).join("\n");form.elements.trivia.value=(profile.trivia||[]).join("\n");form.elements.facts.value=(profile.facts||[]).map(item=>`${item.label}: ${item.value}`).join("\n");setProfileEditorMode(item.kind);toast(`${item.name}'s wiki profile loaded`);
}
function updateEventHelp(){
  const form=$("#event-form"),type=form.elements.type.value,isOrgLocation=type==="organization_location",isResidence=type==="residency",isHierarchy=type==="location_parent",isIdentityHierarchy=type==="identity_parent",needsTarget=["awareness","meeting","relationship","membership","identity_parent"].includes(type),showsTarget=needsTarget||type==="note",needsValue=["alias","display_name","status","gender","age","relationship","organization_location","residency","identity_parent"].includes(type),showsValue=needsValue||type==="membership"||type==="cultivation",usesAction=["membership","organization_location","residency","location_parent","identity_parent"].includes(type),help={mention:"Use this when an identity is referred to without physically appearing. Status remains unknown.",appearance:"A normal physical appearance also proves that the character is alive at this action.",corpse_appearance:"Use when a dead body is the character's first physical appearance. This sets appearance and dead status together.",display_name:"Changes the public label from this exact action onward. Add another display-name event later to end a spy name or restore an earlier name.",identity_parent:"Keeps clones, avatars, incarnations, split souls, and their original identity close together in the graph.",movement:"Records travel and changes the character's current physical position.",residency:"Records a home, permanent residence, long-term stay, camp, or personal domain.",location_parent:"Places one location directly inside another. Nested location regions will cluster and overlap.",alias:"Adds another searchable name without changing the main displayed label.",cultivation:"Choose the canonical tier by name; an equivalent path title remains synchronized.",status:"Use this for later changes or uncertain states such as missing and presumed dead.",gender:"Use this for a later reveal or an actual change — not needed if it was already set when the character was created.",age:"Use this whenever an age is stated or changes in-story — an exact number, a range, or a description.",awareness:"The first character knows the second exists.",meeting:"Records that two characters meet.",relationship:"Choose a second character and enter friendly, neutral, or hostile.",membership:"Choose whether the membership begins now, was already true but is only revealed now, or ends here.",organization_location:"Connect an organization to a headquarters, branch, base, territory, or outpost.",note:"A general story event."};
  $("#event-target-field").hidden=!showsTarget;$("#event-value-field").hidden=!showsValue;$("#event-level-field").hidden=type!=="cultivation";$("#event-action-field").hidden=!usesAction;
  form.elements.target.required=needsTarget;form.elements.value.required=needsValue;form.elements.location.required=["movement","organization_location","residency","location_parent"].includes(type);
  $("#event-location-label").textContent=type==="movement"?"Destination":isOrgLocation?"Headquarters / branch location":isResidence?"Home / long-term location":isHierarchy?"Direct parent location":"Where this happened (optional)";
  $("#event-source-label").textContent=type==="movement"?"Character travelling":isOrgLocation?"Organization":isResidence?"Resident character":isHierarchy?"Child location":isIdentityHierarchy?"Clone / avatar / child identity":type==="note"?"Main character, organization, or location":"Identity / source";
  $("#event-target-label").textContent=type==="membership"?"Organization":isIdentityHierarchy?"Original / parent identity":type==="note"?"Related identity (optional)":"Second character";
  $("#event-value-label").textContent=type==="display_name"?"New public display name":type==="identity_parent"?"Identity relationship":type==="alias"?"New alias":type==="cultivation"?"Equivalent path name (optional)":type==="status"?"New status":type==="gender"?"Gender":type==="age"?"Age":type==="relationship"?"Relationship (friendly, neutral, or hostile)":isOrgLocation?"Organization location role":isResidence?"Residence type":"Role or title (optional)";
  form.elements.target.placeholder=type==="membership"?"Type an organization name":isIdentityHierarchy?"Original character or parent clone":type==="note"?"Optional":"Type a character name or alias";
  form.elements.value.placeholder=type==="display_name"?"Name readers see from this action":type==="identity_parent"?"Clone / Avatar / Incarnation / Split soul":type==="alias"?"E.g. The Innkeeper":type==="cultivation"?"E.g. Earthen Deity":type==="status"?"Unknown / Alive / Dead / Missing":type==="gender"?"E.g. Male, Female, Unknown, Nonbinary":type==="age"?"E.g. 17, Early twenties, Over 900 years":type==="relationship"?"friendly / neutral / hostile":isOrgLocation?"Headquarters / Branch / Base / Outpost":isResidence?"Home / Permanent resident / Camp":"E.g. Founder or member";
  if(isOrgLocation)form.elements.value.setAttribute("list","location-role-options");else if(isResidence)form.elements.value.setAttribute("list","residence-role-options");else form.elements.value.removeAttribute("list");
  const action=form.elements.action;if(isOrgLocation){action.innerHTML='<option value="open">Establishes / opens here</option><option value="close">Closes / leaves this location</option>';$("#event-action-label").textContent="Organization location change";}else if(isResidence){action.innerHTML='<option value="begin">Residence begins</option><option value="end">Residence ends</option>';$("#event-action-label").textContent="Residence change";}else if(isHierarchy){action.innerHTML='<option value="add">Place inside parent</option><option value="remove">Remove from parent</option>';$("#event-action-label").textContent="Location hierarchy change";}else if(isIdentityHierarchy){action.innerHTML='<option value="add">Connect to parent identity</option><option value="remove">Separate from parent identity</option>';$("#event-action-label").textContent="Identity hierarchy change";}else{action.innerHTML='<option value="reveal">Existing membership is revealed</option><option value="join">Joins in this chapter</option><option value="leave">Leaves / membership ends</option>';$("#event-action-label").textContent="Organization membership knowledge";}
  $("#event-help").textContent=`${help[type]||"Record a story change."} Add a wiki link inside details as [[visible text|https://full-link]].`;
}

function generatedEventDescription(type,source,target,location,value,level,action,initial=false){
  const other=target?.name;
  const canonical=CULTIVATION_LEVELS[(Number(level)||1)-1]||"unknown tier",cultivationText=value?`${value}, equivalent to ${canonical}`:canonical;
  const membershipText=action==="leave"?`${source.name} leaves ${other}${value?` (${value})`:""}.`:action==="reveal"?`${source.name} is revealed to already be part of ${other}${value?` as ${value}`:""}.`:`${source.name} joins ${other}${value?` as ${value}`:""}.`;
  return {mention:`${source.name} is mentioned.`,appearance:`${source.name} appears alive.`,corpse_appearance:`${source.name}'s dead body appears.`,display_name:`${source.name} is now publicly known as ${value}.`,identity_parent:action==="remove"?`${source.name} is separated from ${other}.`:`${source.name} is connected to ${other} as ${value||"a clone"}.`,movement:`${source.name} travels to ${location?.name}.`,residency:action==="end"?`${source.name}'s ${value||"residence"} at ${location?.name} ends.`:`${source.name} begins using ${location?.name} as ${value||"a residence"}.`,location_parent:action==="remove"?`${source.name} is no longer recorded inside ${location?.name}.`:`${source.name} is inside ${location?.name}.`,alias:`${value} is revealed as an alias of ${source.name}.`,cultivation:initial?`${source.name}'s cultivation is revealed as ${cultivationText}.`:`${source.name} reaches ${cultivationText}.`,status:`${source.name}'s status changes to ${value}.`,awareness:`${source.name} becomes aware that ${other} exists.`,meeting:`${source.name} meets ${other}.`,relationship:`${source.name} and ${other}'s relationship becomes ${value}.`,membership:membershipText,organization_location:action==="close"?`${source.name} closes its ${value||"location"} at ${location?.name}.`:`${location?.name} becomes ${source.name}'s ${value||"branch"}.`,note:`A story event involving ${source.name}.`}[type]||`${source.name}: ${type}.`;
}

function isAutomaticCultivationDescription(description,previous){if(!previous||previous.type!=="cultivation")return false;const text=String(description||""),oldNames=[cultivationDisplay(previous),cultivationCanonical(previous)].filter(Boolean);return /\b(cultivation is revealed as|reaches|is introduced at)\b/i.test(text)&&oldNames.some(name=>text.toLowerCase().includes(name.toLowerCase()));}

function buildEventRecord(formElement,id="ev-"+crypto.randomUUID()){
  const form=new FormData(formElement),type=String(form.get("type")),source=resolveEntity(String(form.get("source")||"")),target=resolveEntity(String(form.get("target")||"")),location=resolveEntity(String(form.get("location")||"")),rawValue=String(form.get("value")||"").trim(),value=type==="cultivation"&&CULTIVATION_LEVELS.some(name=>name.toLowerCase()===rawValue.toLowerCase())?"":rawValue,level=Number(form.get("level"))||undefined,action=String(form.get("action")||"join"),chapter=Number(form.get("chapter")),sourceUrl=String(form.get("sourceUrl")||"").trim();
  if(!source){toast("Choose an existing character, organization, or location");return null;}
  if(!Number.isFinite(chapter)||chapter<1){toast("Enter a valid chapter");return null;}
  if(String(form.get("location")||"").trim()&&!location){toast("Choose an existing location");return null;}
  if(location&&location.kind!=="location"){toast("The event location must be a location, not a character or organization");return null;}
  if(type==="movement"&&!location){toast("Choose the character's new location");return null;}
  if(type==="movement"&&source.kind!=="character"){toast("Only a character can change location");return null;}
  if(sourceUrl&&!safeExternalUrl(sourceUrl)){toast("The chapter citation must be a complete http:// or https:// URL");return null;}
  if(type==="residency"&&!location){toast("Choose the home or long-term location");return null;}
  if(type==="residency"&&source.kind!=="character"){toast("Choose the character who resides there");return null;}
  if(type==="location_parent"&&!location){toast("Choose the direct parent location");return null;}
  if(type==="location_parent"&&(source.kind!=="location"||location.kind!=="location")){toast("Hierarchy requires a child location and a parent location");return null;}
  if(type==="location_parent"&&source.id===location.id){toast("A location cannot contain itself");return null;}
  if(type==="location_parent"&&action!=="remove"&&locationLineage(location.id,derive(chapter)).includes(source.id)){toast("That would create a circular location hierarchy");return null;}
  if(type==="organization_location"&&!location){toast("Choose the headquarters or branch location");return null;}
  if(type==="organization_location"&&source.kind!=="organization"){toast("Choose the organization connected to this location");return null;}
  if(["awareness","meeting","relationship","membership","identity_parent"].includes(type)&&!target){toast(type==="membership"?"Choose the organization":type==="identity_parent"?"Choose the original or parent identity":"Choose the second character");return null;}
  if(["awareness","meeting","relationship"].includes(type)&&(source.kind!=="character"||target.kind!=="character")){toast("This event requires two characters");return null;}
  if(type==="membership"&&source.kind!=="character"){toast("Choose the character joining or leaving");return null;}
  if(type==="membership"&&target.kind!=="organization"){toast("Membership must point to an organization");return null;}
  if(type==="identity_parent"&&(source.kind!=="character"||target.kind!=="character")){toast("Clone and identity hierarchy requires two characters");return null;}
  if(type==="identity_parent"&&source.id===target.id){toast("An identity cannot be its own parent");return null;}
  if(["appearance","corpse_appearance"].includes(type)&&source.kind!=="character"){toast("Only a character can physically appear");return null;}
  if(["alias","display_name","identity_parent","status","gender","age","relationship","organization_location","residency"].includes(type)&&!value){toast(`Enter the ${$("#event-value-label").textContent.toLowerCase()}`);return null;}
  if(type==="cultivation"&&!level){toast("Choose the canonical cultivation tier");return null;}
  if(type==="relationship"&&!Object.keys(COLORS).includes(value.toLowerCase())){toast("Relationship must be friendly, neutral, or hostile");return null;}
  const previous=data.events.find(event=>event.id===id),enteredDescription=String(form.get("description")||"").trim(),previousGenerated=previous?generatedEventDescription(previous.type,entity(previous.source),entity(previous.target),entity(previous.location),previous.value,previous.level,previous.action,previous.initial===true):"",useGenerated=!enteredDescription||enteredDescription===previousGenerated||isAutomaticCultivationDescription(enteredDescription,previous),description=useGenerated?generatedEventDescription(type,source,target,location,value,level,action,previous?.initial===true):enteredDescription,order=previous?.chapter===chapter&&previous?.order?previous.order:nextEventOrder(chapter,eventDrafts),record={id,chapter,order,type,source:source.id,description,...(sourceUrl?{sourceUrl:safeExternalUrl(sourceUrl)}:{})};
  if(location)record.location=location.id;
  if(["awareness","meeting","relationship","membership","identity_parent"].includes(type)||(type==="note"&&target))record.target=target?.id;
  if(["alias","display_name","identity_parent","cultivation","status","relationship","membership","organization_location","residency"].includes(type)&&value)record.value=["relationship","status"].includes(type)?value.toLowerCase():value;
  if(type==="cultivation"){record.level=level;if(!value)record.value=CULTIVATION_LEVELS[level-1];}
  if(previous?.initial===true&&type==="cultivation")record.initial=true;
  if(previous?.identityIntro===true)record.identityIntro=true;
  if(["membership","organization_location","residency","location_parent","identity_parent"].includes(type))record.action=action;
  return record;
}

function renderEventBatch(){
  const box=$("#event-batch");box.hidden=!eventDrafts.length;if(!eventDrafts.length)return;
  $("#event-batch-chapter").textContent=eventDrafts[0].chapter;$("#event-batch-count").textContent=`${eventDrafts.length} change${eventDrafts.length===1?"":"s"}`;
  $("#event-batch-list").innerHTML=eventDrafts.map(draft=>`<li><span class="event-type event-${escapeHtml(draft.type)}">${escapeHtml(draft.type)}</span><div><strong>${escapeHtml(entity(draft.source)?.name||draft.source)}${draft.location?` · ${escapeHtml(entity(draft.location)?.name||draft.location)}`:""}</strong><small>${escapeHtml(draft.description)}</small></div><button class="button ghost remove-draft" type="button" data-id="${escapeHtml(draft.id)}" aria-label="Remove change">Remove</button></li>`).join("");
  document.querySelectorAll(".remove-draft").forEach(button=>button.onclick=()=>{eventDrafts=eventDrafts.filter(draft=>draft.id!==button.dataset.id);renderEventBatch();});
}

function clearEventInputsForNext(){const form=$("#event-form"),chapter=form.elements.chapter.value,source=form.elements.source.value,location=form.elements.location.value,type=form.elements.type.value;form.reset();form.elements.chapter.value=chapter;form.elements.source.value=source;form.elements.location.value=location;form.elements.type.value=type;updateEventHelp();}

document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{activeView=tab.dataset.view;document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));$("#graph-view").classList.toggle("active",activeView==="graph");$("#admin-view").classList.toggle("active",activeView==="admin");if(activeView==="graph")renderAll();}));
document.querySelectorAll(".mobile-panel-tab").forEach(tab=>tab.addEventListener("click",()=>setMobilePanel(tab.dataset.panel)));
volumeSelect.addEventListener("change",()=>{cancelChapterSequence();expandedChapter=null;activeVolume=volumeSelect.value;cacheActiveVolume();currentActionIndex=0;currentChapter=activeVol().from;selectedId=null;locationPovId=null;setMobilePanel("events");renderAll();});
timeline.addEventListener("input",applyTimeline);timeline.addEventListener("wheel",event=>{event.preventDefault();wheelDelta+=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;if(Math.abs(wheelDelta)>=24){stepTimeline(wheelDelta>0?1:-1);wheelDelta=0;}},{passive:false});
$("#collapse-chapter-events").onclick=collapseChapterEvents;
$("#previous").onclick=()=>stepTimeline(-1);$("#next").onclick=()=>stepTimeline(1);
searchInput.addEventListener("change",()=>{const match=resolvePublicEntity(searchInput.value);if(match){cancelChapterSequence();expandedChapter=null;selectedId=match.id;locationPovId=null;setMobilePanel("info");const index=revealedVolumeActions().findIndex(event=>eventInvolves(event,match.id));if(index>=0){currentActionIndex=index+1;renderAll();}}});
$("#close-profile").onclick=()=>{$("#profile-modal").close();openProfileId=null;cacheActiveVolume();};

$("#entity-form").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.currentTarget),parsedName=parseIdentityName(form.get("name")),name=parsedName.name,existingName=resolveEntity(name);let editingId=String(form.get("editingId")||"");if(!name){toast("Enter a public name or descriptor");return;}if(existingName&&existingName.id!==editingId){const hasEvents=data.events.some(storyEvent=>eventInvolves(storyEvent,existingName.id));if(!editingId&&!hasEvents){editingId=existingName.id;toast(`${existingName.name} existed without a graph event; repairing it now`);}else{$("#manage-entity").value=existingName.name;loadEntityEditor();toast(`${existingName.name} already exists and has been loaded for editing`);return;}}
  const kind=String(form.get("kind")),mentioned=validChapter(form.get("mentioned")),appeared=validChapter(form.get("appeared")),initialLevel=Number(form.get("initialLevel"))||0,initialCultivationAlias=String(form.get("initialCultivationAlias")||"").trim(),creationSourceUrl=String(form.get("creationSourceUrl")||"").trim(),editingCreationEventId=String(form.get("editingCreationEventId")||""),creationEventDescription=String(form.get("creationEventDescription")||"").trim();if(kind==="character"&&!mentioned&&!appeared){toast("Enter either a first mention or a first appearance");return;}if(kind!=="character"&&!appeared){toast(`${kind==="location"?"Locations":"Organizations"} need an introduction chapter`);return;}if(initialCultivationAlias&&!initialLevel){toast("Choose the canonical cultivation tier for that equivalent path title");return;}if(initialCultivationAlias&&CULTIVATION_LEVELS.some(tier=>tier.toLowerCase()===initialCultivationAlias.toLowerCase())){toast("An equivalent path title cannot be another canonical tier. Clear it or choose that tier above.");return;}if(creationSourceUrl&&!safeExternalUrl(creationSourceUrl)){toast("The introduction citation must be a complete http:// or https:// URL");return;}
  let id=editingId;if(!id){id=slugify(name);let suffix=2;while(entity(id))id=slugify(name)+"-"+suffix++;}
  const record=editingId?entity(editingId):{id},managedBefore=data.events.filter(storyEvent=>storyEvent.source===id&&isCreationManagedEvent(storyEvent)),selectedBefore=managedBefore.find(storyEvent=>storyEvent.id===editingCreationEventId),initialCultivationEvent=managedBefore.find(storyEvent=>storyEvent.type==="cultivation"&&storyEvent.initial===true);Object.assign(record,{kind,name,gender:kind==="character"?String(form.get("gender")):undefined,locationType:kind==="location"?String(form.get("locationType")||"Other"):undefined,mentioned:kind==="character"?mentioned:null,appeared:kind==="character"?appeared:null,intro:kind!=="character"?appeared:(mentioned||appeared),description:String(form.get("description")||"")});if(parsedName.wikiUrl)record.profile={...(record.profile||{}),wikiUrl:parsedName.wikiUrl};if(!editingId)data.entities.push(record);
  const sourceFields=creationSourceUrl?{sourceUrl:safeExternalUrl(creationSourceUrl)}:{};
  const creationDescription=(previous,generated)=>previous?.id===selectedBefore?.id&&creationEventDescription&&!(creationEventDescription===previous?.description&&isAutomaticCreationDescription(previous))?creationEventDescription:isAutomaticCreationDescription(previous)?generated:(previous?.description||generated);
  if(kind==="character"){
    const previousPresence=managedBefore.filter(storyEvent=>["mention","appearance"].includes(storyEvent.type));
    data.events=data.events.filter(storyEvent=>!(storyEvent.source===id&&isCreationManagedEvent(storyEvent)&&["mention","appearance"].includes(storyEvent.type)));
    if(mentioned){const previous=previousPresence.find(storyEvent=>storyEvent.type==="mention"),sameChapter=previous?.chapter===mentioned,generated=`${name} is mentioned for the first time.`;data.events.push({id:previous?.id||"ev-"+crypto.randomUUID(),chapter:mentioned,order:sameChapter&&previous?.order?previous.order:nextEventOrder(mentioned),type:"mention",source:id,creationManaged:true,description:creationDescription(previous,generated),...sourceFields});}
    if(appeared){const previous=previousPresence.find(storyEvent=>storyEvent.type==="appearance"),sameChapter=previous?.chapter===appeared,generated=`${name} appears for the first time.`;data.events.push({id:previous?.id||"ev-"+crypto.randomUUID(),chapter:appeared,order:sameChapter&&previous?.order?previous.order:nextEventOrder(appeared),type:"appearance",source:id,creationManaged:true,description:creationDescription(previous,generated),...sourceFields});}
    const cultivationChapter=appeared||mentioned;if(initialLevel){const cultivationRecord=initialCultivationEvent||{id:"ev-"+crypto.randomUUID(),type:"cultivation",source:id},presenceEvent=data.events.filter(storyEvent=>storyEvent.source===id&&storyEvent.creationManaged===true&&["mention","appearance"].includes(storyEvent.type)&&storyEvent.chapter===cultivationChapter).sort((a,b)=>(a.order||0)-(b.order||0)).at(-1),sameChapter=cultivationRecord.chapter===cultivationChapter,cultivationOrder=sameChapter&&cultivationRecord.order?cultivationRecord.order:presenceEvent?(Number(presenceEvent.order)||1)+.01:nextEventOrder(cultivationChapter),generated=initialCultivationAlias?`${name}'s cultivation is revealed as ${initialCultivationAlias}, equivalent to ${CULTIVATION_LEVELS[initialLevel-1]}.`:`${name}'s cultivation is revealed as ${CULTIVATION_LEVELS[initialLevel-1]}.`;Object.assign(cultivationRecord,{chapter:cultivationChapter,order:cultivationOrder,creationManaged:true,initial:true,level:initialLevel,value:initialCultivationAlias||CULTIVATION_LEVELS[initialLevel-1],description:creationDescription(initialCultivationEvent,generated),...sourceFields});if(!creationSourceUrl)delete cultivationRecord.sourceUrl;if(!initialCultivationEvent)data.events.push(cultivationRecord);}else if(initialCultivationEvent)data.events=data.events.filter(storyEvent=>storyEvent.id!==initialCultivationEvent.id);
  }else{data.events=data.events.filter(storyEvent=>!(storyEvent.source===id&&isCreationManagedEvent(storyEvent)&&["mention","appearance"].includes(storyEvent.type)));const introEvent=managedBefore.find(storyEvent=>storyEvent.type==="note"),generated=`${name} is introduced.`;if(introEvent){const sameChapter=introEvent.chapter===appeared;introEvent.chapter=appeared;introEvent.order=sameChapter&&introEvent.order?introEvent.order:nextEventOrder(appeared);introEvent.creationManaged=true;introEvent.identityIntro=true;introEvent.description=creationDescription(introEvent,generated);if(creationSourceUrl)introEvent.sourceUrl=safeExternalUrl(creationSourceUrl);else delete introEvent.sourceUrl;if(kind==="location")introEvent.location=id;else delete introEvent.location;}else data.events.push({id:"ev-"+crypto.randomUUID(),chapter:appeared,order:nextEventOrder(appeared),type:"note",source:id,creationManaged:true,identityIntro:true,...sourceFields,...(kind==="location"?{location:id}:{}),description:generated});}
  saveData();resetEntityEditor();renderAll();toast(`${name} ${editingId?"updated":"created"}`);
});
$("#entity-form").elements.kind.addEventListener("change",updateEntityFormFields);
$("#load-entity").onclick=()=>loadEntityEditor();
$("#cancel-entity-edit").onclick=resetEntityEditor;
$("#delete-entity").onclick=()=>deleteIdentity($("#entity-form").elements.editingId.value);

$("#event-form").addEventListener("submit",event=>{event.preventDefault();const editingId=event.currentTarget.elements.editingId.value,previous=editingId?data.events.find(item=>item.id===editingId):null,record=buildEventRecord(event.currentTarget,editingId||undefined);if(!record)return;if(editingId){const index=data.events.findIndex(item=>item.id===editingId);if(index>=0)data.events[index]=record;}else data.events.push(record);if(previous)syncPresenceFromEvents(previous.source,previous.type);syncPresenceFromEvents(record.source,record.type);saveData();resetEventEditor();renderAll();toast(`Change ${editingId?"updated":"saved"}; graph updated`);});
$("#event-form").elements.type.addEventListener("change",updateEventHelp);
$("#event-form").elements.level.addEventListener("change",()=>{const form=$("#event-form"),value=form.elements.value.value.trim().toLowerCase();if(form.elements.type.value==="cultivation"&&CULTIVATION_LEVELS.some(name=>name.toLowerCase()===value))form.elements.value.value="";});
function installWikiLinkHelpers(){document.querySelectorAll("#admin-view textarea").forEach(textarea=>{if(textarea.parentElement.querySelector(".inline-link-helper"))return;const button=document.createElement("button");button.type="button";button.className="inline-link-helper";button.textContent="＋ Link selected text to a wiki page";button.onclick=()=>{const start=textarea.selectionStart,end=textarea.selectionEnd,label=textarea.value.slice(start,end).trim()||prompt("Text readers should see (for example: Protos Energy)");if(!label)return;const url=prompt("Paste the full webpage URL");if(!safeExternalUrl(url)){if(url)toast("Use a complete http:// or https:// link");return;}const chapterInput=prompt("Also cite a chapter for this? Enter a chapter number, or leave blank to skip."),chapter=validChapter(chapterInput);if(chapterInput&&!chapter){toast("Enter a whole chapter number greater than 0 — link added without a chapter citation");}textarea.setRangeText(chapter?`[[${label}|${url.trim()}|${chapter}]]`:`[[${label}|${url.trim()}]]`,start,end,"end");textarea.focus();};const chapterButton=document.createElement("button");chapterButton.type="button";chapterButton.className="inline-link-helper chapter-mark-helper";chapterButton.textContent="＋ Mark chapter for selected text";chapterButton.onclick=()=>{const start=textarea.selectionStart,end=textarea.selectionEnd;if(start===end){toast("Select the sentence or passage this chapter reference belongs to first");return;}const selectedText=textarea.value.slice(start,end);const input=prompt("Which chapter does this belong to?"),chapter=validChapter(input);if(!chapter){if(input!==null)toast("Enter a whole chapter number greater than 0");return;}if(!chapterUrl(chapter)){const urlInput=prompt(`No link is saved for chapter ${chapter} yet. Paste its URL to save it once — every future reference to chapter ${chapter} anywhere will use it automatically. Leave blank to skip.`);const savedUrl=urlInput?safeExternalUrl(urlInput.trim()):"";if(urlInput&&!savedUrl)toast("That wasn't a complete http:// or https:// link — marker added without one");if(savedUrl){data.chapterSources={...(data.chapterSources||{}),[chapter]:savedUrl};saveData();}}textarea.setRangeText(`[[cite:${chapter}]]${selectedText}[[/cite]]`,start,end,"end");textarea.focus();};textarea.insertAdjacentElement("afterend",button);button.insertAdjacentElement("afterend",chapterButton);});}
document.addEventListener("click",event=>{const link=event.target.closest("[data-open-event]");if(!link)return;event.preventDefault();event.stopPropagation();openProfile(link.dataset.openEvent,Number(link.dataset.eventChapter));});
$("#cancel-event-edit").onclick=resetEventEditor;
$("#queue-event").onclick=()=>{const record=buildEventRecord($("#event-form"));if(!record)return;if(eventDrafts.length&&record.chapter!==eventDrafts[0].chapter){toast(`This batch is for chapter ${eventDrafts[0].chapter}. Save or clear it before changing chapters.`);return;}eventDrafts.push(record);renderEventBatch();clearEventInputsForNext();toast("Change added to the chapter batch");};
$("#clear-event-batch").onclick=()=>{eventDrafts=[];renderEventBatch();resetEventEditor();};
$("#save-event-batch").onclick=()=>{if(!eventDrafts.length)return;data.events.push(...eventDrafts);eventDrafts.forEach(record=>syncPresenceFromEvents(record.source,record.type));const count=eventDrafts.length;eventDrafts=[];saveData();renderEventBatch();resetEventEditor();renderAll();toast(`${count} chapter changes saved; graph updated`);};

$("#profile-form").elements.entity.addEventListener("change",fillProfileEditor);
$("#profile-form").addEventListener("submit",event=>{
  event.preventDefault();const form=event.currentTarget,item=resolveEntity(form.elements.entity.value);if(!item){toast("Choose an existing character, organization, or location");return;}
  const wikiUrl=form.elements.wikiUrl.value.trim();if(wikiUrl&&!safeExternalUrl(wikiUrl)){toast("Use a complete http:// or https:// Fandom/wiki URL");return;}const profile={...(item.profile||{}),wikiUrl:safeExternalUrl(wikiUrl),subtitle:form.elements.subtitle.value.trim(),image:form.elements.image.value.trim(),quote:form.elements.quote.value.trim(),history:form.elements.history.value.trim(),trivia:listFromText(form.elements.trivia.value),facts:factsFromText(form.elements.facts.value)};
  if(item.kind==="character"){Object.assign(profile,{species:form.elements.species.value.trim(),roles:listFromText(form.elements.roles.value,true),appearance:form.elements.appearance.value.trim(),personality:form.elements.personality.value.trim(),abilities:listFromText(form.elements.abilities.value),achievements:achievementEntries(form.elements.achievements.value)});}else{Object.assign(profile,{purpose:form.elements.purpose.value.trim(),traits:listFromText(form.elements.traits.value)});}
  item.profile=profile;saveData();renderAll();toast(`${item.name}'s wiki profile saved`);
});
$("#clear-profile").onclick=()=>{const form=$("#profile-form"),item=resolveEntity(form.elements.entity.value);if(!item){toast("Choose an existing character, organization, or location");return;}if(!confirm(`Clear all wiki profile fields for ${item.name}? Chapter events will remain.`))return;item.profile=null;saveData();fillProfileEditor();renderAll();toast(`${item.name}'s wiki profile cleared`);};

$("#volume-rows").addEventListener("click",event=>{const button=event.target.closest("button"),row=button?.closest(".volume-row"),rows=$("#volume-rows");if(!button||!row)return;if(button.classList.contains("volume-remove")){row.remove();refreshVolumeRowOrder();return;}if(!button.classList.contains("volume-move"))return;const direction=Number(button.dataset.move),sibling=direction<0?row.previousElementSibling:row.nextElementSibling;if(!sibling)return;if(direction<0)rows.insertBefore(row,sibling);else rows.insertBefore(row,sibling.nextSibling);refreshVolumeRowOrder();});
$("#add-volume").onclick=()=>{const rows=$("#volume-rows"),last=rows.lastElementChild,lastChapter=Number(last?.querySelector('[name="volumeTo"]')?.value)||0,index=rows.children.length,newVolume={id:`volume-${crypto.randomUUID()}`,name:`Volume ${index+1}`,from:lastChapter+1,to:lastChapter+1};rows.insertAdjacentHTML("beforeend",volumeRowMarkup(newVolume,index));refreshVolumeRowOrder();rows.lastElementChild.querySelector('[name="volumeName"]').select();rows.lastElementChild.scrollIntoView({behavior:"smooth",block:"nearest"});};
$("#volume-form").addEventListener("submit",event=>{event.preventDefault();const volumes=collectVolumeRows(),error=validateVolumes(volumes),errorBox=$("#volume-error");errorBox.textContent=error;if(error){errorBox.scrollIntoView({behavior:"smooth",block:"center"});return;}const orphanEvents=data.events.filter(storyEvent=>!volumes.some(volume=>storyEvent.chapter>=volume.from&&storyEvent.chapter<=volume.to));if(orphanEvents.length&&!confirm(`${orphanEvents.length} existing event${orphanEvents.length===1?" is":"s are"} outside these chapter ranges and will not appear in a volume. Save anyway?`))return;cancelChapterSequence();expandedChapter=null;data.volumes=volumes;activeVolume=volumes.some(volume=>volume.id===activeVolume)?activeVolume:volumes[0].id;cacheActiveVolume();currentActionIndex=0;currentChapter=activeVol().from;selectedId=null;locationPovId=null;lastAutoFitSignature="";saveData();configure();renderAll();toast(`${volumes.length} volume${volumes.length===1?"":"s"} saved`);});
$("#chapter-links-form").addEventListener("submit",event=>{event.preventDefault();const rawTemplate=$("#chapter-url-template").value.trim(),rawSources=$("#chapter-sources-text").value,errorBox=$("#chapter-links-error");errorBox.textContent="";if(rawTemplate&&!rawTemplate.includes("{n}")){errorBox.textContent="Include {n} in the template so each chapter number can be inserted — for example https://example.com/chapter-{n}.";return;}if(rawTemplate&&!safeExternalUrl(rawTemplate.replaceAll("{n}","1"))){errorBox.textContent="The fallback template must be a complete http:// or https:// URL.";return;}const badLine=listFromText(rawSources).find(line=>{const [chapterText,urlText]=line.split(/\s+\|\s+/,2);return !(validChapter(chapterText)&&safeExternalUrl(urlText));});if(badLine){errorBox.textContent=`Couldn't read this line — use "chapter number | full URL": ${badLine}`;return;}data.chapterUrlTemplate=rawTemplate;data.chapterSources=chapterSourcesFromText(rawSources);saveData();renderAll();toast("Chapter links saved");});
$("#quick-add-chapter").addEventListener("blur",()=>{const chapter=validChapter($("#quick-add-chapter").value);if(chapter){const existing=data.chapterSources?.[chapter];if(existing)$("#quick-add-url").value=existing;}});
$("#chapter-quick-add-form").addEventListener("submit",event=>{event.preventDefault();const chapter=validChapter($("#quick-add-chapter").value),url=safeExternalUrl($("#quick-add-url").value),errorBox=$("#quick-add-error");errorBox.textContent="";if(!chapter){errorBox.textContent="Enter a whole chapter number greater than 0.";return;}if(!url){errorBox.textContent="Enter a complete http:// or https:// URL.";return;}data.chapterSources={...(data.chapterSources||{}),[chapter]:url};saveData();renderAll();$("#quick-add-chapter").value="";$("#quick-add-url").value="";toast(`Chapter ${chapter} link saved`);});

$("#export-data").onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="living-story-graph-data.json";link.click();URL.revokeObjectURL(url);};
$("#publish-data").onclick=publishData;
$("#import-data").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.entities)||!Array.isArray(parsed.events)||!Array.isArray(parsed.volumes)||validateVolumes(parsed.volumes))throw new Error();data=parsed;activeVolume=data.volumes[0].id;cacheActiveVolume();currentActionIndex=0;currentChapter=data.volumes[0].from;saveData();selectedId=null;locationPovId=null;configure();renderAll();toast("Data imported");}catch{toast("That JSON file is not valid graph data");}event.target.value="";});
$("#reset-data").onclick=()=>{if(!confirm("Reset this browser's demo data to the original sample?"))return;cancelChapterSequence();expandedChapter=null;data=deepClone(sampleData);saveData();selectedId=null;locationPovId=null;activeVolume=data.volumes[0].id;cacheActiveVolume();currentActionIndex=0;currentChapter=activeVol().from;configure();renderAll();toast("Sample data restored");};
$("#clear-all-data").onclick=()=>{const answer=prompt("This permanently deletes every character, organization, location, profile, and event from the published graph. Your volume structure will remain. Type DELETE to continue.");if(answer!=="DELETE"){if(answer!==null)toast("Nothing was deleted");return;}cancelChapterSequence();expandedChapter=null;data={schemaVersion:5,novel:data.novel||"Living Story Graph",volumes:deepClone(data.volumes?.length?data.volumes:sampleData.volumes),cultivationLevels:deepClone(CULTIVATION_LEVELS),chapterUrlTemplate:data.chapterUrlTemplate||"",chapterSources:deepClone(data.chapterSources||{}),entities:[],events:[]};eventDrafts=[];selectedId=null;locationPovId=null;activeVolume=data.volumes[0].id;cacheActiveVolume();currentActionIndex=0;currentChapter=data.volumes[0].from;physics.pos.clear();physics.vel.clear();lastAutoFitSignature="";saveData();resetEntityEditor();resetEventEditor();renderEventBatch();configure();renderAll();toast("All story data deleted");};

function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2200);}

function positionSliderOnboarding(){const onboarding=$("#slider-onboarding"),card=onboarding?.parentElement;if(!onboarding||onboarding.hidden||!card)return;const sliderRect=timeline.getBoundingClientRect(),cardRect=card.getBoundingClientRect(),x=Math.max(72,Math.min(cardRect.width-72,sliderRect.left+sliderRect.width/2-cardRect.left));onboarding.style.setProperty("--slider-x",`${x}px`);}
window.addEventListener("resize",positionSliderOnboarding);

function syncChapterRefToggles(on){document.body.classList.toggle("show-chapter-refs",on);document.querySelectorAll("[data-chapter-ref-toggle]").forEach(button=>{button.classList.toggle("active",on);button.setAttribute("aria-pressed",String(on));});}
function dismissChapterRefHint(){const hint=$("#chapter-ref-hint");if(hint)hint.hidden=true;localStorage.setItem(CHAPTER_REF_HINT_SEEN_KEY,"1");}
function toggleChapterRefs(){const next=!document.body.classList.contains("show-chapter-refs");syncChapterRefToggles(next);localStorage.setItem(CHAPTER_REF_TOGGLE_KEY,next?"1":"0");dismissChapterRefHint();}
syncChapterRefToggles(localStorage.getItem(CHAPTER_REF_TOGGLE_KEY)==="1");
if(localStorage.getItem(CHAPTER_REF_HINT_SEEN_KEY)!=="1"){const hint=$("#chapter-ref-hint");if(hint)hint.hidden=false;}
$("#dismiss-chapter-ref-hint")?.addEventListener("click",event=>{event.stopPropagation();dismissChapterRefHint();});
document.addEventListener("click",event=>{if(event.target.closest("[data-chapter-ref-toggle]"))toggleChapterRefs();});
document.addEventListener("keydown",event=>{if(event.key==="Alt"&&!event.repeat){event.preventDefault();toggleChapterRefs();}});
graph.addEventListener("wheel",event=>{event.preventDefault();const {x:ux,y:uy}=toSvgPoint(event.clientX,event.clientY);zoomBy(event.deltaY>0?0.9:1.11,ux,uy);},{passive:false});
graph.addEventListener("pointerdown",event=>{if(event.button!==undefined&&event.button!==0)return;const p=toSvgPoint(event.clientX,event.clientY);panStart={ux:p.x,uy:p.y,viewX:view.x,viewY:view.y};graph.setPointerCapture(event.pointerId);});
graph.addEventListener("pointermove",event=>{if(!panStart)return;const p=toSvgPoint(event.clientX,event.clientY);view.x=panStart.viewX+(p.x-panStart.ux);view.y=panStart.viewY+(p.y-panStart.uy);applyViewTransform();});
const endPan=()=>{panStart=null;};graph.addEventListener("pointerup",endPan);graph.addEventListener("pointercancel",endPan);
$("#zoom-in").onclick=()=>zoomBy(1.25);$("#zoom-out").onclick=()=>zoomBy(1/1.25);$("#zoom-reset").onclick=()=>fitGraphToCount(nodeEls.size,true);
requestAnimationFrame(tickGraph);

function setApplicationVisible(visible){document.querySelector(".app > header").hidden=!visible;document.querySelector(".app > main").hidden=!visible;const login=$("#admin-login");if(login)login.hidden=visible;}
function startApplication(openAdmin=false){configure();updateEntityFormFields();setProfileEditorMode("character");updateEventHelp();installWikiLinkHelpers();if(openAdmin){activeView="admin";document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.view==="admin"));$("#graph-view").classList.remove("active");$("#admin-view").classList.add("active");}updatePublishingStatus();renderAll();if(openProfileId&&entity(openProfileId))openProfile(openProfileId);}
async function bootstrap(){
  data=await loadData();
  restoreActiveVolume();
  if(isUploadRoute){
    if(import.meta.env.DEV&&new URLSearchParams(location.search).get("admin")==="1")adminAuthenticated=true;
    else try{const response=await fetch("/api/session",{cache:"no-store"}),session=await response.json();adminAuthenticated=Boolean(session.authenticated);}catch{adminAuthenticated=false;}
    if(!adminAuthenticated){setApplicationVisible(false);return;}
  }
  setApplicationVisible(true);startApplication(isUploadRoute);if(isUploadRoute&&adminAuthenticated&&hostedDataStatus==="empty")publishData();
}
const loginForm=$("#admin-login-form");if(loginForm)loginForm.addEventListener("submit",async event=>{event.preventDefault();const button=loginForm.querySelector("button"),error=$("#admin-login-error");button.disabled=true;button.textContent="Checking…";error.textContent="";try{const response=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:loginForm.elements.password.value})}),result=await response.json();if(!response.ok)throw new Error(result.error||"Login failed");adminAuthenticated=true;setApplicationVisible(true);startApplication(true);if(hostedDataStatus==="empty")publishData();}catch(loginError){error.textContent=loginError.message;}finally{button.disabled=false;button.textContent="Unlock editor";}});
bootstrap();
