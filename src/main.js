import "./style.css";
import { normalizeIdentityIntroductionOrder } from "./order.js";

const COLORS = { friendly: "#45c98b", hostile: "#ef5d67", neutral: "#9aa9c0" };
const MARKED_EVENT_TYPES = new Set(["cultivation","relationship","status","alias","display_name","identity_parent","membership","movement","residency","location_parent","organization_location","system_host","system_parent","system_location","system_merge","system_end","system_rank","quest_issue","quest_progress","quest_end","quest_part","quest_update","quest_contribution"]);
const EVENT_TYPE_COLORS = { cultivation:"#e8ad3c",relationship:"#45c98b",status:"#ef5d67",alias:"#9f7aea",display_name:"#7dd3fc",identity_parent:"#c084fc",membership:"#4f8df7",movement:"#22c7b8",residency:"#55d6a7",location_parent:"#f2c95e",organization_location:"#c084fc",meeting:"#27b8b8",conversation:"#ffd479",system_host:"#b98cff",system_parent:"#b98cff",system_location:"#8f74c4",system_merge:"#8f74c4",system_end:"#ef5d67",system_rank:"#ffd479",quest_issue:"#ffb347",quest_progress:"#7dd3fc",quest_end:"#45c98b",quest_part:"#e8ad3c",quest_update:"#9f7aea",quest_contribution:"#22c7b8",awareness:"#36a8d4",mention:"#7f8da3",appearance:"#ef71b8",corpse_appearance:"#ef5d67",note:"#edf2ff" };
// What counts as a turning point for one person: the things that change who they are, what they
// hold, or where they stand — not every mention and meeting along the way.
// What may stand on either side of a clone / avatar / merged-identity link.
const IDENTITY_KINDS = new Set(["character","system"]);
// Actions that undo or end something, where the wording of the thing being ended is not needed.
const REMOVAL_ACTIONS = new Set(["remove","end","close","withdraw"]);
const MAJOR_EVENT_TYPES = new Set(["appearance","corpse_appearance","cultivation","status","display_name","identity_parent","relationship","membership","system_host","system_rank","quest_end"]);
const STORAGE_KEY = "living-story-graph-demo-v1";
const VIEW_STATE_KEY = "living-story-graph-view-state-v1";
const PUBLISH_DIRTY_KEY = "living-story-graph-publish-dirty-v1";
const CHAPTER_REF_TOGGLE_KEY = "living-story-graph-chapter-refs-v1";
const CHAPTER_REF_HINT_SEEN_KEY = "living-story-graph-chapter-ref-hint-seen-v1";
const SVG_NS = "http://www.w3.org/2000/svg";
const CULTIVATION_LEVELS = ["Mortal","Body Tempering","Qi Training","Foundation Establishment","Golden Core","Nascent Soul","Earth Immortal","Heaven Immortal","Celestial Immortal","Demi Dao Lord","Dao Lord","Above Dao Lord"];

const sampleData = {
  schemaVersion: 15,
  novel: "The Innkeeper — graph demonstration",
  volumes: [
    { id: "v1", name: "Volume 1", from: 1, to: 40 },
    { id: "v2", name: "Volume 2", from: 41, to: 80 },
    { id: "v3", name: "Volume 3", from: 81, to: 120 }
  ],
  cultivationLevels: CULTIVATION_LEVELS,
  progressionTracks: [{ id: "cultivation", name: "Cultivation", levels: CULTIVATION_LEVELS }],
  entities: [
    { id: "inn", kind: "organization", name: "Midnight Inn", intro: 1, description: "A growing inter-realm sanctuary and organization." },
    { id: "jotun", kind: "organization", name: "Jotun Empire", intro: 30, description: "A major empire active across the story." },
    { id: "garden", kind: "organization", name: "Primordial Garden", intro: 45, description: "A primordial domain connected to Eclipse." },
    { id: "inn-estate", kind: "location", locationType: "Site", name: "Midnight Inn Estate", intro: 1, description: "The complete grounds and buildings controlled by the Midnight Inn." },
    { id: "inn-lobby", kind: "location", locationType: "Room", name: "Midnight Inn Lobby", intro: 1, description: "The Inn's central arrival hall and meeting place." },
    { id: "garden-realm", kind: "location", locationType: "Realm", name: "Primordial Garden Realm", intro: 45, description: "An ancient garden realm where primordial beings gather." },
    { id: "azure-realm", kind: "location", locationType: "Realm", name: "Azure Mortal Realm", intro: 1, description: "The mortal realm that contains the worlds where the Midnight Inn first took root." },
    { id: "verdan", kind: "location", locationType: "World", name: "Verdan", intro: 1, description: "A temperate world inside the Azure Mortal Realm." },
    { id: "stonevale", kind: "location", locationType: "City", name: "Stonevale", intro: 1, description: "The trade city on Verdan where the Midnight Inn was built." },
    { id: "garden-heart", kind: "location", locationType: "Site", name: "Heart of the Garden", intro: 45, description: "The still centre of the Primordial Garden Realm." },
    { id: "inn-system", kind: "system", name: "Midnight Inn System", intro: 1, authority: 7, grade: "S", description: "The system bonded to Lex that runs the Inn's holdings." },
    { id: "inn-taverns", kind: "system", name: "Midnight Taverns", intro: 12, description: "The tavern branch of the Midnight Inn System. Neither its authority nor its grade is known when it is founded." },
    { id: "hearth-system", kind: "system", name: "Hearthkeeper System", intro: 18, authority: 2, grade: "C", description: "A small hearth system that the Midnight Inn System later swallowed." },
    { id: "ash-system", kind: "system", name: "Ashfall System", intro: 26, authority: 4, grade: "B", description: "A rival system destroyed in the Inn's early years." },
    { id: "warden-system", kind: "system", name: "Warden System", intro: 34, authority: 6, grade: "A", description: "An authority-graded system bonded to Vane." },
    { id: "inn-resorts", kind: "system", name: "Midnight Resorts", intro: 50, authority: 5, grade: "A-", description: "The resort branch of the Midnight Inn System." },
    { id: "q-hearth", kind: "quest", issuer: "inn-system", name: "Keep the Hearth Lit", intro: 4, questBadge: "World", timeLimit: "Until the winter breaks", achievements: ["First Innkeeper"], failure: "The Inn loses its licence and Lex loses the deed.", description: "Hold the Midnight Inn open through the whole of the first winter. Three tasks make up the chain." },
    { id: "q-stock", kind: "quest", issuer: "inn-system", name: "Stock the Cellar", intro: 4, timeLimit: "Seven days", description: "Fill the Inn's cellar before the roads close." },
    { id: "q-cook", kind: "quest", issuer: "inn-system", name: "Find a Cook", intro: 8, failure: "The kitchen stays shut for a month.", description: "Hire someone who can feed a full house." },
    { id: "q-winter", kind: "quest", issuer: "inn-system", name: "Survive the Long Frost", intro: 18, questBadge: "Urgent", timeLimit: "Ninety days", failure: "Authority falls by one and the Hearthkeeper System is recalled.", description: "Keep every guest alive until the thaw." },
    { id: "q-envoy", kind: "quest", issuer: "inn-system", name: "Answer the Jotun Envoy", intro: 26, questBadge: "Hidden", achievements: ["Spoken For"], failure: "The Jotun Empire marks the Inn as hostile.", description: "Meet Envoy Luthor without giving the Inn away. Nobody was told this quest existed." },
    { id: "q-ledger", kind: "quest", issuer: "inn-system", name: "Balance the Winter Ledger", intro: 30, timeLimit: "Before the spring audit", description: "A quest with no reward stated — the ledger simply has to balance." },
    { id: "q-anomaly", kind: "quest", issuer: "warden-system", name: "Investigate the anomaly in the Azure Mortal Realm", intro: 20, questBadge: "Urgent", description: "Find whatever is bending the realm's edges. The terms of this one grew as the story turned — the objectives below were added chapter by chapter, not split into new quests." },
    { id: "q-caravan", kind: "quest", issuer: "inn-system", name: "Bring the Stonevale Caravan Through", intro: 28, description: "Lex and Vane are told to get the caravan across the pass together. Their systems are not the same and neither is their share of the work." },
    { id: "lex", kind: "character", name: "Lex", gender: "male", mentioned: 1, appeared: 1, description: "Founder and central figure of the Midnight Inn." },
    { id: "mary", kind: "character", name: "Mary", gender: "female", mentioned: 8, appeared: 8, description: "An administrator and adviser within the Inn." },
    { id: "gerald", kind: "character", name: "Gerald", gender: "male", mentioned: 18, appeared: 22, description: "A charming host known for welcoming guests." },
    { id: "luthor", kind: "character", name: "Luthor", gender: "male", mentioned: 18, appeared: 18, description: "A reliable but dangerous member of the Inn." },
    { id: "eclipse", kind: "character", name: "Eclipse", gender: "female", mentioned: 45, appeared: 58, description: "An ancient primordial queen whose identity resists perception." },
    { id: "vane", kind: "character", name: "Vane", gender: "female", mentioned: 30, appeared: 33, description: "A warden of Stonevale, bonded to the Warden System." },
    { id: "halden", kind: "character", name: "Halden", gender: "male", mentioned: 36, appeared: 36, description: "A courier whose body is found before he is ever seen alive." },
    { id: "eclipse-veil", kind: "character", name: "The Veil", gender: "female", mentioned: 62, appeared: 62, description: "An avatar Eclipse wears when she walks outside the Garden." }
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
    { id: "loc-9", chapter: 58, order: 3, type: "movement", source: "eclipse", location: "garden-heart", description: "Eclipse withdraws into the Heart of the Garden." },
    { id: "loc-8", chapter: 58, order: 99, type: "movement", source: "lex", location: "inn-lobby", description: "Lex returns to the Midnight Inn Lobby later in the chapter." },
    { id: "orgloc-1", chapter: 1, order: 2, type: "organization_location", source: "inn", location: "inn-lobby", value: "Headquarters", action: "open", description: "The Midnight Inn Lobby serves as the Midnight Inn's headquarters." },
    { id: "orgloc-2", chapter: 45, order: 2, type: "organization_location", source: "garden", location: "garden-realm", value: "Headquarters", action: "open", description: "The Primordial Garden Realm is the Primordial Garden's headquarters." },
    { id: "hier-1", chapter: 1, order: 3, type: "location_parent", source: "inn-lobby", location: "inn-estate", action: "add", description: "The Midnight Inn Lobby is inside the Midnight Inn Estate." },
    { id: "hier-2", chapter: 1, order: 3, type: "location_parent", source: "inn-estate", location: "stonevale", action: "add", description: "The Midnight Inn Estate stands inside the city of Stonevale." },
    { id: "hier-3", chapter: 1, order: 3, type: "location_parent", source: "stonevale", location: "verdan", action: "add", description: "Stonevale is a city of the world Verdan." },
    { id: "hier-4", chapter: 1, order: 3, type: "location_parent", source: "verdan", location: "azure-realm", action: "add", ghost: true, description: "Verdan is one of the worlds held by the Azure Mortal Realm." },
    { id: "hier-5", chapter: 45, order: 3, type: "location_parent", source: "garden-heart", location: "garden-realm", action: "add", description: "The Heart of the Garden lies at the centre of the Primordial Garden Realm." },
    { id: "sys-1", chapter: 1, order: 5, type: "system_host", source: "inn-system", target: "lex", value: "Host", action: "add", description: "The Midnight Inn System bonds to Lex as its host." },
    { id: "sys-2", chapter: 12, order: 1, type: "system_parent", source: "inn-taverns", target: "inn-system", action: "add", description: "Midnight Taverns becomes a subsystem of the Midnight Inn System." },
    { id: "sys-3", chapter: 12, order: 2, type: "system_location", source: "inn-taverns", location: "inn-lobby", value: "Tavern", action: "open", description: "Midnight Taverns opens in the Midnight Inn Lobby." },
    { id: "sys-4", chapter: 30, order: 5, type: "system_location", source: "inn-taverns", location: "stonevale", value: "Tavern", action: "open", description: "Midnight Taverns opens a second house in Stonevale." },
    { id: "sys-7", chapter: 18, order: 6, type: "system_host", source: "hearth-system", target: "lex", value: "Host", action: "add", description: "The Hearthkeeper System bonds to Lex." },
    { id: "sys-8", chapter: 26, order: 6, type: "system_merge", source: "hearth-system", target: "inn-system", action: "add", description: "The Hearthkeeper System merges into the Midnight Inn System." },
    { id: "sys-9", chapter: 26, order: 7, type: "system_host", source: "ash-system", target: "luthor", value: "Host", action: "add", description: "The Ashfall System bonds to Luthor." },
    { id: "sys-10", chapter: 30, order: 6, type: "system_end", source: "ash-system", value: "Burned out in the Jotun campaign", action: "add", description: "The Ashfall System is destroyed." },
    { id: "sys-5", chapter: 50, order: 1, type: "system_parent", source: "inn-resorts", target: "inn-system", action: "add", description: "Midnight Resorts becomes a subsystem of the Midnight Inn System." },
    { id: "sys-6", chapter: 50, order: 2, type: "system_location", source: "inn-resorts", location: "garden-realm", value: "Resort", action: "open", description: "Midnight Resorts opens inside the Primordial Garden Realm." },
    { id: "age-1", chapter: 5, order: 6, type: "age", source: "lex", value: "Around thirty", description: "Lex is described as being around thirty." },
    { id: "note-1", chapter: 15, order: 1, type: "note", source: "inn", description: "The Inn survives its first hard winter without losing a guest." },
    { id: "dn-1", chapter: 30, order: 7, type: "display_name", source: "luthor", value: "Envoy Luthor", description: "Luthor is publicly styled Envoy Luthor once the Jotun posting is announced." },
    { id: "vane-1", chapter: 30, order: 8, type: "mention", source: "vane", description: "A warden named Vane is mentioned." },
    { id: "vane-2", chapter: 33, order: 1, type: "appearance", source: "vane", description: "Vane appears alive." },
    { id: "vane-3", chapter: 33, order: 2, type: "status", source: "vane", value: "alive", description: "Vane is alive." },
    { id: "auth-1", chapter: 33, order: 3, type: "cultivation", source: "vane", level: 5, value: "Golden Core", description: "Vane is recorded at Golden Core cultivation." },
    { id: "vane-4", chapter: 33, order: 4, type: "movement", source: "vane", location: "stonevale", description: "Vane takes up her post in Stonevale." },
    { id: "vsys-1", chapter: 34, order: 1, type: "system_host", source: "warden-system", target: "vane", value: "Host", action: "add", description: "The Warden System bonds to Vane." },
    { id: "vsys-2", chapter: 34, order: 2, type: "system_location", source: "warden-system", location: "stonevale", value: "Watchpost", action: "open", description: "The Warden System opens a watchpost in Stonevale." },
    { id: "corpse-1", chapter: 36, order: 1, type: "corpse_appearance", source: "halden", description: "Halden's body is found in Stonevale before anyone has seen him alive." },
    { id: "corpse-2", chapter: 36, order: 2, type: "movement", source: "halden", location: "stonevale", description: "Halden's body is recovered in Stonevale." },
    { id: "gender-1", chapter: 38, order: 1, type: "gender", source: "vane", value: "female", description: "Vane, taken for a man behind the warden's mask, is confirmed to be a woman." },
    { id: "auth-2", chapter: 39, order: 1, type: "cultivation", source: "vane", level: 6, value: "Nascent Soul", description: "Vane reaches Nascent Soul cultivation." },
    { id: "veil-1", chapter: 62, order: 1, type: "mention", source: "eclipse-veil", description: "A figure called the Veil is mentioned." },
    { id: "veil-2", chapter: 62, order: 2, type: "appearance", source: "eclipse-veil", description: "The Veil appears alive." },
    { id: "veil-3", chapter: 62, order: 3, type: "status", source: "eclipse-veil", value: "alive", description: "The Veil is alive." },
    { id: "ip-1", chapter: 62, order: 4, type: "identity_parent", source: "eclipse-veil", target: "eclipse", value: "Avatar", action: "add", description: "The Veil is revealed to be an avatar Eclipse wears outside the Garden." },
    { id: "rank-1", chapter: 20, order: 1, type: "system_rank", source: "inn-system", grade: "S+", description: "The Midnight Inn System is regraded S+ after the winter." },
    { id: "rank-2", chapter: 28, order: 1, type: "system_rank", source: "inn-system", authority: 11, description: "The Midnight Inn System's authority rises to 11." },
    { id: "rank-3", chapter: 31, order: 1, type: "system_rank", source: "ash-system", authority: 2, grade: "D", description: "The Ashfall System is broken down to authority 2, grade D, before it is destroyed." },
    { id: "rank-4", chapter: 37, order: 1, type: "system_rank", source: "warden-system", authority: 9, grade: "Death", description: "The Warden System is raised to authority 9 and regraded Death, the second-highest grade anyone has seen." },
    { id: "rank-5", chapter: 24, order: 1, type: "system_rank", source: "inn-taverns", authority: 3, grade: "B", description: "The Midnight Taverns are rated for the first time: authority 3, grade B." },
    { id: "rank-6", chapter: 25, order: 1, type: "system_rank", source: "hearth-system", grade: null, description: "The Hearthkeeper System is left ungraded in the days before the Inn swallows it." },
    { id: "qa-1", chapter: 4, order: 1, type: "quest_issue", source: "q-hearth", target: "lex", action: "issue", description: "Keep the Hearth Lit is issued to Lex." },
    { id: "qa-2", chapter: 4, order: 2, type: "quest_issue", source: "q-stock", target: "lex", action: "issue", description: "Stock the Cellar is issued to Lex." },
    { id: "qa-3", chapter: 4, order: 3, type: "quest_part", source: "q-stock", target: "q-hearth", action: "add", description: "Stock the Cellar is part of Keep the Hearth Lit." },
    { id: "qa-4", chapter: 6, order: 1, type: "quest_progress", source: "q-stock", progress: 45, description: "The cellar is nearly half filled." },
    { id: "qa-5", chapter: 8, order: 1, type: "quest_issue", source: "q-cook", target: "lex", action: "issue", description: "Find a Cook is issued to Lex." },
    { id: "qa-6", chapter: 8, order: 2, type: "quest_part", source: "q-cook", target: "q-hearth", action: "add", description: "Find a Cook is part of Keep the Hearth Lit." },
    { id: "qa-7", chapter: 9, order: 1, type: "quest_end", source: "q-stock", action: "complete", value: "40 contribution points", rewardRank: "C", performance: "B", description: "Quest complete. The cellar is full, a day early." },
    { id: "qa-8", chapter: 11, order: 1, type: "quest_end", source: "q-cook", action: "complete", value: "Mary's service contract", rewardRank: "A-", performance: "S", description: "Quest complete. Mary takes the kitchen and stays." },
    { id: "qa-9", chapter: 18, order: 1, type: "quest_issue", source: "q-winter", target: "lex", action: "issue", description: "Survive the Long Frost is issued to Lex." },
    { id: "qa-10", chapter: 18, order: 2, type: "quest_part", source: "q-winter", target: "q-hearth", action: "add", description: "Survive the Long Frost is part of Keep the Hearth Lit." },
    { id: "qa-11", chapter: 22, order: 6, type: "quest_progress", source: "q-winter", progress: 30, description: "A month of the frost is behind them." },
    { id: "qa-12", chapter: 26, order: 8, type: "quest_issue", source: "q-envoy", target: "lex", action: "issue", ghost: true, description: "Answer the Jotun Envoy is issued to Lex, though no one is told." },
    { id: "qa-13", chapter: 30, order: 1, type: "quest_issue", source: "q-ledger", action: "issue", description: "Balance the Winter Ledger is issued, to nobody in particular." },
    { id: "qa-14", chapter: 31, order: 2, type: "quest_progress", source: "q-winter", progress: 72, description: "The worst of the frost has passed." },
    { id: "qa-15", chapter: 34, order: 1, type: "quest_end", source: "q-envoy", action: "fail", performance: "E", description: "Luthor leaves unanswered. Quest failed." },
    { id: "qn-1", chapter: 20, order: 2, type: "quest_issue", source: "q-anomaly", target: "lex", action: "issue", description: "Investigate the anomaly in the Azure Mortal Realm is issued to Lex." },
    { id: "qn-2", chapter: 20, order: 3, type: "quest_update", source: "q-anomaly", value: "Remark", description: "Your reflection is not the anomaly. You really are that ugly." },
    { id: "qn-3", chapter: 23, order: 1, type: "quest_update", source: "q-anomaly", value: "Update", description: "Anomaly signature detected. Foreign presence identified — current designation: Hollowkin." },
    { id: "qn-4", chapter: 23, order: 2, type: "quest_update", source: "q-anomaly", value: "Hint", description: "The anomaly may be related to the non-indigenous Hollowkin." },
    { id: "qn-5", chapter: 24, order: 2, type: "quest_update", source: "q-anomaly", value: "Objective", description: "Trace where the Hollowkin are coming through." },
    { id: "qn-6", chapter: 27, order: 1, type: "quest_progress", source: "q-anomaly", progress: 60, description: "The trail leads under the Garden Heart." },
    { id: "qn-7", chapter: 32, order: 1, type: "quest_end", source: "q-anomaly", action: "complete", value: "Realm Seed", rewardRank: "Destiny", performance: "SSS+", description: "Quest complete. Anomaly source: a perpetual inter-realm wormhole." },
    { id: "qn-8", chapter: 32, order: 2, type: "quest_update", source: "q-anomaly", value: "Notification", description: "Realm Seed detected. It has been planted within the system and fertilised." },
    { id: "qj-1", chapter: 28, order: 1, type: "quest_issue", source: "q-caravan", target: "lex", characters: ["lex","vane"], action: "issue", description: "Bring the Stonevale Caravan Through is issued to Lex and Vane together." },
    { id: "qj-2", chapter: 33, order: 1, type: "quest_progress", source: "q-caravan", progress: 80, description: "The caravan clears the pass; only the last stretch remains." },
    { id: "qj-3", chapter: 36, order: 1, type: "quest_end", source: "q-caravan", action: "complete", value: "Split by contribution", rewardRank: "S", performance: "A+", description: "Quest complete. The caravan reaches Stonevale intact." },
    { id: "qj-4", chapter: 36, order: 2, type: "quest_contribution", source: "q-caravan", target: "lex", value: "Held the rear against the frost", rewardRank: "S", performance: "A+", description: "Lex contributed the greater share." },
    { id: "qj-5", chapter: 36, order: 3, type: "quest_contribution", source: "q-caravan", target: "vane", value: "Broke the road ahead", rewardRank: "A", performance: "B+", description: "Vane contributed the lesser share." },
    { id: "talk-1", chapter: 22, order: 5, type: "conversation", source: "lex", characters: ["lex","mary","gerald"], location: "inn-lobby", description: "Lex, Mary, and Gerald settle how the Inn will run its front of house." },
    { id: "talk-2", chapter: 58, order: 4, type: "conversation", source: "lex", characters: ["lex","gerald","eclipse"], location: "garden-realm", description: "Lex, Gerald, and Eclipse speak in the Primordial Garden Realm." },
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
let expandedLocations = new Set(), expandedSystems = new Set();
let lastLocationView = null, lastSystemView = null;
let collapsingLocationId = null, locationCollapseTimer = null, lastContentFit = 0;
// Ghosts of nodes on their way into whatever took them in. They are driven by the tick rather
// than by a css transition, because the thing they are travelling to is itself still moving.
let departingGhosts = [], questPulses = [];
let emergingLocations = new Set(), emergeTimer = null;
let activePodIds = [], activePodKey = "", retiringPodIds = [], podRetireTimer = null;
// Where a pod should start its journey from, when the place already had a node of its own a
// moment ago. Without this the node flies into its new parent while its pod flies back out of
// that same parent, and the reader sees the place going two ways at once.
let podOrigins = new Map();
let currentChapter = 1;
let currentActionIndex = 0;
let chapterAutoplayTimer=null,expandedChapter=null;
let eventScrollHold=false,autoplayHeldByHover=false;
const SELECTION_EVENT_PAGE=30;
let selectionEventPage=SELECTION_EVENT_PAGE,lastEventSelection=null,questPageActive=0,questPageSettled=0;
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
            <div class="graph-card"><svg id="graph" viewBox="0 0 720 520" role="img" aria-label="Chapter-aware novel relationship graph"></svg><div id="edge-tip" class="edge-tip" role="status" hidden></div><div id="slider-onboarding" class="slider-onboarding" hidden><span class="slider-pointer" aria-hidden="true">↑</span><strong>Use the slider</strong></div><div class="graph-zoom-controls"><button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="zoom-reset" aria-label="Reset view">⟲</button><button type="button" id="zoom-out" aria-label="Zoom out">−</button></div></div>
            <aside class="side">
              <div class="mobile-panel-tabs" role="tablist" aria-label="Graph information">
                <button class="mobile-panel-tab active" data-panel="info" role="tab">Info</button>
                <button class="mobile-panel-tab" data-panel="events" role="tab">Events</button>
                <button class="mobile-panel-tab" data-panel="quests" role="tab">Quests</button>
                <button class="mobile-panel-tab" data-panel="legend" role="tab">Legend</button>
              </div>
              <section id="summary" class="side-card summary mobile-active" data-panel-content="info"><div class="empty">Select a character, organization, or location. Double-click a node for full details.</div></section>
              <section class="side-card events-card" data-panel-content="events"><div class="events-head"><strong id="events-title">Chapter events</strong><span id="events-count"></span><span id="events-hold" class="events-hold" hidden>Paused</span></div><ul id="events-list" class="events-list"></ul></section>
              <section class="side-card quests-card" data-panel-content="quests" aria-label="Quests"><div class="events-head"><strong>Quests</strong><span id="quests-count"></span></div><div id="quests-list" class="quests-list"></div></section>
              <section class="side-card mobile-legend" data-panel-content="legend" aria-label="Mobile graph legend">
                <span><i class="dot female"></i>Female</span><span><i class="dot male"></i>Male</span><span><i class="hex"></i>Organization</span><span><i class="pin"></i>Place — click twice to open</span><span><i class="gem"></i>System — click to open its reach</span><span><i class="line-key conversation"></i>Conversation</span>
                <span><i class="line-key friendly"></i>Friendly</span><span><i class="line-key hostile"></i>Hostile</span><span><i class="line-key neutral"></i>Neutral / awareness</span><span><i class="line-key clone"></i>Clone / avatar</span><span><i class="line-key member"></i>Membership</span><span><i class="line-key location"></i>Travel / activity</span><span><i class="line-key residence"></i>Residence</span><span><i class="line-key hierarchy"></i>Inside location</span><span><i class="line-key organization-location"></i>Organization place</span>
                <span><i class="ring mentioned"></i>Mentioned only</span><span><i class="ring unknown"></i>Unknown status</span><span><i class="ring"></i>Alive</span><span><i class="ring dead"></i>Dead</span><span><i class="diamond"></i>Alias count</span><span><i class="corona-key"></i>Cultivation level</span>
              </section>
            </aside>
          </div>
          <div class="legend desktop-legend" aria-label="Graph legend">
            <span><i class="dot female"></i>Female</span><span><i class="dot male"></i>Male</span><span><i class="hex"></i>Organization</span><span><i class="pin"></i>Place — click twice to open</span><span><i class="gem"></i>System — click to open its reach</span><span><i class="line-key conversation"></i>Conversation</span>
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
              <label class="field"><span>Type</span><select name="kind"><option value="character">Character</option><option value="organization">Organization</option><option value="location">Location</option><option value="system">System</option><option value="quest">Quest</option></select></label>
              <label class="field"><span>Initial public name or descriptor</span><input name="name" required placeholder="E.g. Unknown Manufacturer"><small class="field-note">You may also paste <code>[[Visible name|https://fandom-page]]</code>; it will be separated automatically.</small></label>
              <label class="field" id="entity-gender-field"><span>Gender</span><select name="gender"><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label>
              <label class="field" id="entity-authority-field" hidden><span>Authority (optional)</span><input name="authority" list="system-unknown-options" inputmode="numeric" maxlength="12" placeholder="7" /><small class="field-note">A plain number, nothing else. Leave it blank if this system has no authority or none has been revealed. This is the starting authority; use a rank action to change it later.</small></label>
              <label class="field" id="entity-grade-field" hidden><span>Grade (optional)</span><input name="grade" list="system-grade-options" maxlength="7" placeholder="S" /><datalist id="system-grade-options"><option value="Destiny"></option><option value="Fate"></option><option value="Divine"></option><option value="Oblivion"></option><option value="Death"></option><option value="Spirit"></option><option value="Life"></option><option value="Chaos"></option><option value="Unknown"></option></datalist><datalist id="system-unknown-options"><option value="Unknown"></option></datalist><small class="field-note">One to three letters with an optional + or − — S, A+, SS, SSS− — or one of the named ranks: Destiny, Fate, Divine, Oblivion, Death, Spirit, Life, Chaos. Leave it blank if this system is ungraded or its grade is unknown. This is the starting grade; use a rank action to change it later.</small></label>
              <label class="field" id="entity-quest-issuer-field" hidden><span>Issued by (optional)</span><input name="issuer" list="admin-entity-options" placeholder="Midnight Inn System" /><small class="field-note">The system — or organisation, or character — this quest comes from. Everything the quest does then shows in that issuer's own history too.</small></label>
              <label class="field" id="entity-quest-badge-field" hidden><span>Quest badge (optional)</span><input name="questBadge" list="quest-badge-options" maxlength="24" placeholder="Hidden" /><datalist id="quest-badge-options"><option value="Hidden"></option><option value="World"></option><option value="Chain"></option><option value="Daily"></option><option value="Urgent"></option><option value="Punishment"></option></datalist><small class="field-note">A short word for a special quest, shown as a badge in the quest tab. Leave it blank for an ordinary quest.</small></label>
              <label class="field" id="entity-quest-reward-rank-field" hidden><span>Reward rank, if stated up front (optional)</span><input name="rewardRank" list="system-grade-options" maxlength="9" placeholder="SSS+" /><small class="field-note">Write it exactly as the story writes it — E through A+, S through SSS+, or a named rank such as Destiny, Divine, or Chaos. Most quests do not say until they are finished, so leave this blank and fill the rank in on the completion action instead.</small></label>
              <label class="field" id="entity-quest-time-limit-field" hidden><span>Time limit (optional)</span><input name="timeLimit" maxlength="80" placeholder="Three days" /><small class="field-note">Written however the story writes it — a count of days, a deadline, or nothing at all.</small></label>
              <label class="field" id="entity-quest-rewards-field" hidden><span>Rewards (optional)</span><input name="rewards" maxlength="240" placeholder="200 contribution points, Hearth token" /><small class="field-note">Separate them with commas. A sub-quest can carry its own rewards, and many quests carry none.</small></label>
              <label class="field" id="entity-quest-achievements-field" hidden><span>Achievements (optional)</span><input name="achievements" maxlength="240" placeholder="First Innkeeper" /><small class="field-note">Separate them with commas.</small></label>
              <label class="field" id="entity-quest-failure-field" hidden><span>On failure (optional)</span><input name="failure" maxlength="240" placeholder="Authority falls by one" /><small class="field-note">What the punishment is if the quest is failed.</small></label>
              <label class="field" id="entity-location-type-field" hidden><span>Place level / type</span><select name="locationType"><option value="Universe">Universe</option><option value="Realm">Realm</option><option value="World">World / planet</option><option value="Continent">Continent</option><option value="Country">Country / empire</option><option value="State">State / province</option><option value="City">City / settlement</option><option value="District">District</option><option value="Site" selected>Site / estate</option><option value="Building">Building</option><option value="Room">Room / area</option><option value="Other">Other</option></select></label>
              <label class="field" id="entity-mentioned-field"><span>First mentioned chapter (optional)</span><input name="mentioned" type="number" min="1" placeholder="Leave blank if they appear directly"></label>
              <label class="field" id="entity-appeared-field"><span id="entity-appeared-label">First appearance chapter (optional)</span><input name="appeared" type="number" min="1" placeholder="Leave blank if they have not appeared yet"></label>
              <label class="field" id="entity-initial-track-field"><span>Progression track</span><select name="initialTrack"></select></label><label class="field" id="entity-initial-cultivation-field"><span>Known rank when introduced (optional)</span><select name="initialLevel"><option value="">Unknown / not revealed</option>${CULTIVATION_LEVELS.map((name,index)=>`<option value="${index+1}">${name}</option>`).join("")}</select><small class="field-note">Unknown adds no cultivation ring. Choose Mortal only when the novel confirms it.</small></label>
              <label class="field" id="entity-initial-cultivation-alias-field"><span>Equivalent path title (optional)</span><input name="initialCultivationAlias" placeholder="E.g. Earthen Deity"><small class="field-note">Synchronized to the canonical tier selected above.</small></label>
              <label class="field span-2" id="entity-creation-source-field"><span>Introduction chapter source URL / citation (optional)</span><input name="creationSourceUrl" type="url" placeholder="https://www.webnovel.com/book/…"><small class="field-note">Applied to the appearance and initial-cultivation facts generated by this creation record.</small></label>
              <label class="field span-2" id="entity-creation-description-field" hidden><span>Selected creation-row wording</span><textarea name="creationEventDescription" rows="3"></textarea><small class="field-note">This changes only the creation row you clicked. Name, chapter, presence and initial cultivation remain controlled by the fields above.</small></label>
              <label class="field span-2"><span>Description</span><textarea name="description" rows="3" placeholder="Short spoiler-aware profile"></textarea></label>
            </div><p class="form-help" id="entity-help">Presence: enter First mentioned only when the character is named before appearing. Enter First appearance when they physically enter the story. Either field can be used by itself.</p><div class="form-actions"><button class="button danger" id="delete-entity" type="button" hidden>Delete identity</button><button class="button ghost" id="cancel-entity-edit" type="button" hidden>Cancel edit</button><button class="button primary" id="save-entity" type="submit">Create and add to graph</button></div></form>
            <form id="event-form" class="admin-card"><h2 id="event-form-title">Add chapter changes</h2><p id="event-edit-mode-note" class="event-edit-mode-note" hidden><strong>Editing this exact saved event.</strong> Saving replaces only the row you clicked; it does not create a new event or edit the identity form.</p><input name="editingId" type="hidden"><div class="form-grid">
              <label class="field"><span>Event type</span><select name="type"><option value="mention">Mentioned in this chapter</option><option value="appearance">Appears alive in this chapter</option><option value="corpse_appearance">Dead body / corpse appears</option><option value="display_name">Public/display name changes</option><option value="alias">Alias revealed</option><option value="identity_parent">Clone / avatar / identity hierarchy</option><option value="movement">Character travels / changes location</option><option value="residency">Character residence / long-term base</option><option value="location_parent">Location placed inside another location</option><option value="cultivation">Cultivation change</option><option value="status">Status becomes known or changes</option><option value="gender">Gender becomes known or changes</option><option value="age">Age stated or changes</option><option value="awareness">Awareness / mentioned by</option><option value="meeting">Meeting</option><option value="conversation">Conversation between characters</option><option value="relationship">Relationship change</option><option value="membership">Organization membership</option><option value="organization_location">Organization headquarters / branch</option><option value="system_host">System bonds to a host</option><option value="system_parent">Subsystem of another system</option><option value="system_location">System operates at a location</option><option value="system_rank">System authority / grade changes</option><option value="system_merge">System merges into another system</option><option value="system_end">System is destroyed</option><option value="quest_issue">Quest is issued</option><option value="quest_update">Quest update, hint, remark, or notification</option><option value="quest_progress">Quest progress changes</option><option value="quest_end">Quest completed, failed, or abandoned</option><option value="quest_part">Quest is part of a larger quest</option><option value="quest_contribution">Quest contribution and share of the reward</option><option value="note">Story event</option></select></label>
              <label class="field"><span>Chapter</span><input name="chapter" type="number" min="1" value="80" required></label>
              <label class="field" id="event-source-field"><span id="event-source-label">Character</span><input name="source" list="admin-entity-options" required placeholder="Type a name or alias"><datalist id="admin-entity-options"></datalist></label>
              <label class="field" id="event-location-field"><span id="event-location-label">Where this happened (optional)</span><input name="location" list="location-options" placeholder="Type a location"><datalist id="location-options"></datalist></label>
              <label class="field" id="event-target-field"><span id="event-target-label">Second character</span><input name="target" list="admin-entity-options"></label><label class="field" id="event-authority-field"><span>New authority</span><input name="authority" list="system-unknown-options" inputmode="numeric" maxlength="12" placeholder="8" /><small class="field-note">Leave blank to keep the authority it already has. Write unknown to take it away entirely.</small></label><label class="field" id="event-grade-field"><span>New grade</span><input name="grade" list="system-grade-options" maxlength="9" placeholder="S+" /><small class="field-note">Leave blank to keep the grade it already has. Write unknown to take it away entirely.</small></label><label class="field" id="event-progress-field"><span>Progress %</span><input name="progress" inputmode="numeric" maxlength="3" placeholder="40" /><small class="field-note">Nought to a hundred. A quest made of parts, with no figure of its own, takes the average of its parts.</small></label><label class="field" id="event-note-kind-field"><span>Kind of note</span><select name="noteKind"><option value="Update">Quest update</option><option value="Hint">Quest hint</option><option value="Remark">Remark</option><option value="Notification">New notification</option><option value="Objective">Added objective</option></select><small class="field-note">A quest's terms can grow as the story turns — new objectives, hints, and the system's own remarks all belong here rather than in a second quest.</small></label><label class="field" id="event-reward-rank-field"><span>Reward rank (optional)</span><input name="rewardRank" list="system-grade-options" maxlength="9" placeholder="SSS+" /><small class="field-note">Usually only stated once the quest is finished. Write it exactly as the story writes it.</small></label><label class="field" id="event-performance-field"><span>Performance grade (optional)</span><input name="performance" list="system-grade-options" maxlength="9" placeholder="A" /><small class="field-note">How the host performed, which is generally what the reward is scaled to.</small></label><label class="field checkbox-field" id="event-ghost-field"><input type="checkbox" name="ghost" /><span>Ghost action — change the world without appearing in the list</span></label><label class="field" id="event-characters-field"><span>Everyone in the conversation</span><input name="characters" list="admin-entity-options" placeholder="Lex, Mary, Gerald" /><small class="field-note">Separate names with commas. One action covers the whole conversation, however many are in it.</small></label>
              <label class="field" id="event-value-field"><span id="event-value-label">Value</span><input name="value"><datalist id="location-role-options"><option value="Headquarters"></option><option value="Branch"></option><option value="Base"></option><option value="Territory"></option><option value="Outpost"></option></datalist><datalist id="residence-role-options"><option value="Home"></option><option value="Permanent resident"></option><option value="Resident staff"></option><option value="Long-term guest"></option><option value="Camp"></option><option value="Domain"></option></datalist></label>
              <label class="field" id="event-track-field"><span>Progression track</span><select name="track"></select></label><label class="field" id="event-level-field"><span>Rank on that track</span><select name="level"><option value="">Choose a rank…</option></select><small class="field-note">The rank controls graph size and progression automatically.</small></label>
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
          <form id="track-form" class="admin-card"><div class="admin-card-heading"><h2>Progression tracks</h2></div>
            <p class="field-note">A track is just an ordered ladder of ranks — cultivation tiers, an authority grade from G to S, anything. Lowest first, one per line. Characters can be on different tracks.</p>
            <div id="track-rows" class="track-rows"></div>
            <div class="editor-actions"><button type="button" class="button ghost" id="add-track">Add a track</button><button class="button" type="submit">Save tracks</button></div>
          </form>
          <section class="admin-card data-card" id="order-card"><div class="summary-title"><div><h2>Chapter running order</h2><small>Order only matters inside a chapter, so this edits one chapter at a time — a thousand more chapters do not make this list longer.</small></div><span class="chip" id="order-count"></span></div>
            <div class="order-controls"><button type="button" class="button ghost" id="order-prev">◀ Earlier chapter</button><label class="field"><span>Chapter</span><input id="order-chapter" type="number" min="1" inputmode="numeric" /></label><button type="button" class="button ghost" id="order-next">Later chapter ▶</button></div>
            <p class="order-position" id="order-position"></p>
            <ol class="order-list" id="order-list"></ol>
            <p class="order-hint">Drag a row by its handle, or use the arrows. The slider plays a chapter's actions in exactly this order.</p>
          </section>
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
// Progression ladders are data, not code: a story can run cultivation tiers, an authority grade
// from G to S, or anything else, and each ladder is whatever list the author typed in.
const DEFAULT_TRACK_ID = "cultivation";
// Authority is a plain number with no ceiling, so it reads as size rather than as a tier.
function systemGlyphRadius(state){const authority=Number(state?.authority);return 26+Math.min(16,Math.max(0,Number.isFinite(authority)?authority:0)**.6*3.4);}
// A grade is a short rank — one to three characters for most systems — or one of the named
// gradings that sit outside the letters entirely.
// Named ranks sit above the letters, in pairs. The order is the story's business, not this
// app's — these are only the words that count as a rank rather than a typo.
const SPECIAL_GRADES = ["destiny","fate","divine","oblivion","death","spirit","life","chaos"];
function isSpecialGrade(grade){return SPECIAL_GRADES.includes(String(grade||"").trim().toLowerCase());}
// Neither number nor grade is compulsory. A system can be born without one, lose it when it is
// swallowed by something bigger, or simply never have had it revealed — so there has to be a way
// to say "not this" as well as a way to leave a field alone.
const UNKNOWN_WORDS = ["unknown","none","ungraded","no grade","-","—","–","?"];
function meansUnknown(text){return UNKNOWN_WORDS.includes(String(text??"").trim().toLowerCase());}
function gradeIsValid(grade){const text=String(grade||"").trim();return !text||meansUnknown(text)||isSpecialGrade(text)||/^[A-Za-z]{1,3}[+-]?$/.test(text);}
// A rank that is absent and a rank that is unknown read the same on the graph: there isn't one.
function rankWord(value){const text=String(value??"").trim();return text===""?"none":text;}
function authorityIsValid(authority){const text=String(authority??"").trim();return !text||meansUnknown(text)||Number.isFinite(Number(text));}
function progressionTracks(){
  const list=(Array.isArray(data.progressionTracks)?data.progressionTracks:[]).filter(track=>track&&track.id&&Array.isArray(track.levels)&&track.levels.length);
  return list.length?list:[{id:DEFAULT_TRACK_ID,name:"Cultivation",levels:deepClone(data.cultivationLevels?.length?data.cultivationLevels:CULTIVATION_LEVELS)}];
}
function trackFor(id){const tracks=progressionTracks();return tracks.find(track=>track.id===id)||tracks[0];}
function trackLevels(id){return trackFor(id).levels;}
function trackName(id){return trackFor(id).name||"Progression";}
function trackIdOf(record){return record?.track&&progressionTracks().some(track=>track.id===record.track)?record.track:progressionTracks()[0].id;}
function cultivationCanonical(event){const ladder=trackLevels(trackIdOf(event));return ladder[Math.max(0,(Number(event?.level)||1)-1)]||"Unknown tier";}
function cultivationDisplay(event){return String(event?.value||"").trim()||cultivationCanonical(event);}
function cultivationLabel(event){const shown=cultivationDisplay(event),canonical=cultivationCanonical(event);return shown.toLowerCase()===canonical.toLowerCase()?shown:`${shown} · equivalent to ${canonical}`;}

function loadLocalData() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
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
    const migrated=migrateCultivationData(stored);
    if((migrated.schemaVersion||1)<6){
      const isBundledDemo=migrated.novel===sampleData.novel&&migrated.entities.some(item=>item.id==="lex")&&migrated.entities.some(item=>item.id==="eclipse");
      if(isBundledDemo){const entityIds=new Set(migrated.entities.map(item=>item.id));sampleData.entities.filter(item=>["azure-realm","verdan","stonevale","garden-heart"].includes(item.id)&&!entityIds.has(item.id)).forEach(item=>migrated.entities.push(deepClone(item)));const eventIds=new Set((migrated.events||[]).map(event=>event.id));sampleData.events.filter(event=>["hier-2","hier-3","hier-4","hier-5","loc-9"].includes(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));}
      migrated.schemaVersion=6;
    }
    if((migrated.schemaVersion||1)<7){
      if(!Array.isArray(migrated.progressionTracks)||!migrated.progressionTracks.length)
        migrated.progressionTracks=[{id:DEFAULT_TRACK_ID,name:"Cultivation",levels:deepClone(migrated.cultivationLevels?.length?migrated.cultivationLevels:CULTIVATION_LEVELS)}];
      (migrated.events||[]).forEach(event=>{if(event.type==="cultivation"&&!event.track)event.track=DEFAULT_TRACK_ID;});
      migrated.schemaVersion=7;
    }
    if((migrated.schemaVersion||1)<8){
      // Identified by its cast rather than its title, so a demo whose novel has been renamed
      // still picks up new sample material.
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        const entityIds=new Set(migrated.entities.map(item=>item.id));
        sampleData.entities.filter(item=>["inn-system","inn-taverns","inn-resorts"].includes(item.id)&&!entityIds.has(item.id)).forEach(item=>migrated.entities.push(deepClone(item)));
        const eventIds=new Set((migrated.events||[]).map(event=>event.id));
        sampleData.events.filter(event=>/^(sys-|talk-)/.test(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
      }
      migrated.schemaVersion=8;
    }
    if((migrated.schemaVersion||1)<9){
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        const entityIds=new Set(migrated.entities.map(item=>item.id));
        sampleData.entities.filter(item=>["hearth-system","ash-system"].includes(item.id)&&!entityIds.has(item.id)).forEach(item=>migrated.entities.push(deepClone(item)));
        sampleData.entities.filter(item=>item.kind==="system").forEach(sample=>{const stored=migrated.entities.find(item=>item.id===sample.id);if(stored&&stored.grade===undefined){stored.grade=sample.grade;stored.authority=sample.authority;}});
        const eventIds=new Set((migrated.events||[]).map(event=>event.id));
        sampleData.events.filter(event=>["sys-7","sys-8","sys-9","sys-10"].includes(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
      }
      migrated.schemaVersion=9;
    }
    if((migrated.schemaVersion||1)<10){
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        const entityIds=new Set(migrated.entities.map(item=>item.id));
        sampleData.entities.filter(item=>["vane","halden","eclipse-veil","warden-system"].includes(item.id)&&!entityIds.has(item.id)).forEach(item=>migrated.entities.push(deepClone(item)));
        const eventIds=new Set((migrated.events||[]).map(event=>event.id));
        sampleData.events.filter(event=>/^(age-|note-|dn-|vane-|auth-|vsys-|corpse-|gender-|veil-|ip-)/.test(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
        const hierarchyFact=(migrated.events||[]).find(event=>event.id==="hier-4");
        if(hierarchyFact&&hierarchyFact.ghost===undefined)hierarchyFact.ghost=true;
      }
      migrated.schemaVersion=10;
    }
    if((migrated.schemaVersion||1)<11){
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        // Authority belongs to systems and is a number; the character-side ladder added in the
        // previous version was a misreading and is withdrawn here.
        migrated.progressionTracks=(migrated.progressionTracks||[]).filter(track=>track.id!=="authority");
        (migrated.events||[]).filter(event=>["auth-1","auth-2"].includes(event.id)).forEach(event=>{
          const replacement=sampleData.events.find(sample=>sample.id===event.id);
          if(replacement){delete event.track;event.level=replacement.level;event.value=replacement.value;event.description=replacement.description;}
        });
        const eventIds=new Set((migrated.events||[]).map(event=>event.id));
        sampleData.events.filter(event=>/^rank-/.test(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
      }
      migrated.schemaVersion=11;
    }
    if((migrated.schemaVersion||1)<12){
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        // Authority and grade are both optional now, so the demo shows a system that starts with
        // neither and one that has its grade taken away before it is swallowed.
        const taverns=migrated.entities.find(item=>item.id==="inn-taverns");
        if(taverns){delete taverns.authority;delete taverns.grade;}
        const eventIds=new Set((migrated.events||[]).map(event=>event.id));
        sampleData.events.filter(event=>["rank-5","rank-6"].includes(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
      }
      migrated.schemaVersion=12;
    }
    if((migrated.schemaVersion||1)<13){
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        const entityIds=new Set(migrated.entities.map(item=>item.id));
        sampleData.entities.filter(item=>item.kind==="quest"&&!entityIds.has(item.id)).forEach(item=>migrated.entities.push(deepClone(item)));
        const eventIds=new Set((migrated.events||[]).map(event=>event.id));
        sampleData.events.filter(event=>/^qa-/.test(event.id)&&!eventIds.has(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
      }
      migrated.schemaVersion=13;
    }
    if((migrated.schemaVersion||1)<14){
      // "Chain" said the wrong thing: grouping quests only means one quest is part of a bigger
      // one, and it has nothing to do with a joint quest, where two people work together.
      (migrated.events||[]).forEach(event=>{if(event.type==="quest_chain")event.type="quest_part";});
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo){
        // The demo's quests shipped in the previous version and their terms have since changed
        // shape, so the bundled copy is taken whole rather than patched field by field. Quests a
        // reader wrote themselves are left exactly as they are.
        migrated.entities=migrated.entities.filter(item=>item.kind!=="quest"||!sampleData.entities.some(sample=>sample.id===item.id));
        migrated.events=(migrated.events||[]).filter(event=>!/^(qa-|qn-|qj-)/.test(event.id));
        sampleData.entities.filter(item=>item.kind==="quest").forEach(item=>migrated.entities.push(deepClone(item)));
        sampleData.events.filter(event=>/^(qa-|qn-|qj-)/.test(event.id)).forEach(event=>migrated.events.push(deepClone(event)));
      }
      migrated.schemaVersion=14;
    }
    if((migrated.schemaVersion||1)<15){
      const isBundledDemo=["lex","eclipse","inn-lobby"].every(id=>migrated.entities.some(item=>item.id===id));
      if(isBundledDemo)
        // Quests now say who issued them, which is what puts them in that issuer's own history.
        sampleData.entities.filter(item=>item.kind==="quest").forEach(sample=>{
          const stored=migrated.entities.find(item=>item.id===sample.id);
          if(stored&&stored.issuer===undefined)stored.issuer=sample.issuer;
        });
      migrated.schemaVersion=15;
    }
    localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;
  }
  catch (error) { console.error("Story data could not be brought up to date; keeping it as it was.", error); return stored || deepClone(sampleData); }
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
function absorbedInto(id,derived){const result=new Set(),queue=[id];while(queue.length){const current=queue.shift();(derived.systemMerges||[]).filter(link=>link.into===current).forEach(link=>{if(result.has(link.absorbed))return;result.add(link.absorbed);queue.push(link.absorbed);});}return result;}
// A quest's actions belong to whoever issued it as much as to whoever carries it, so selecting
// the system that hands out quests shows what those quests did.
function eventInvolves(event,id) {
  if(event.source === id || event.target === id || event.location === id || (event.characters || []).includes(id)) return true;
  return String(event.type).startsWith("quest_") && entity(event.source)?.issuer === id;
}
function eventLocation(event){return event.location?entity(event.location):null;}
function eventsAtLocation(id,chapter=currentChapter){const source=chapter===currentChapter?appliedEvents():orderedEvents();return source.filter(event=>event.chapter===chapter&&event.location===id).sort((a,b)=>(a.order||0)-(b.order||0));}
function locationCharacterIds(event){return [...new Set([event.source,event.target,...(event.characters||[])].filter(id=>entity(id)?.kind==="character"))];}
function eventChapters(id, volume) { return [...new Set(data.events.filter(e => eventInvolves(e,id) && e.chapter >= volume.from && e.chapter <= volume.to).map(e => e.chapter))].sort((a,b)=>a-b); }
function timelineChaptersFor(chosen,volume){if(chosen?.kind==="location"&&locationPovId)return [...new Set(data.events.filter(event=>event.location===chosen.id&&event.chapter>=volume.from&&event.chapter<=volume.to&&locationCharacterIds(event).includes(locationPovId)).map(event=>event.chapter))].sort((a,b)=>a-b);return chosen?eventChapters(chosen.id,volume):[];}
function eventMatchesTimelineFocus(event,chosen){return !chosen||(chosen.kind==="location"&&locationPovId?event.location===chosen.id&&locationCharacterIds(event).includes(locationPovId):eventInvolves(event,chosen.id));}
function orderedEvents(){return data.events.map((event,index)=>({event,index})).sort((a,b)=>a.event.chapter-b.event.chapter||(a.event.order||0)-(b.event.order||0)||a.index-b.index).map(item=>item.event);}
function nextEventOrder(chapter,drafts=[]){const sameChapter=[...data.events,...drafts].filter(event=>event.chapter===chapter);return sameChapter.reduce((max,event,index)=>Math.max(max,Number(event.order)||index+1),0)+1;}
// A ghost action still changes the world but never takes a turn: it is not a stop on the slider
// and it is not listed, yet everything it does is in force from its chapter onward.
function volumeActions(volume=activeVol()){return orderedEvents().filter(event=>event.chapter>=volume.from&&event.chapter<=volume.to&&!event.ghost);}
function ghostActions(volume=activeVol(),chapter=currentChapter){return orderedEvents().filter(event=>event.ghost&&event.chapter>=volume.from&&event.chapter<=volume.to&&event.chapter<=chapter);}
// Ghost actions have to be folded back into story order, not appended: derivation is
// order-sensitive, so a ghost issued in chapter 26 must not be replayed after a chapter 34
// action that settles the same thing.
function revealedVolumeActions(){
  const chosen=new Set([...volumeActions().slice(0,currentActionIndex),...ghostActions()].map(event=>event.id));
  return orderedEvents().filter(event=>chosen.has(event.id));
}
function currentActionEvent(){return currentActionIndex>0?volumeActions()[currentActionIndex-1]||null:null;}
function appliedEvents(){const volume=activeVol(),selected=new Set(revealedVolumeActions().map(event=>event.id));return orderedEvents().filter(event=>event.chapter<volume.from||(event.chapter<=volume.to&&selected.has(event.id)));}
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
function locationLineage(id,derived){const chain=[],seen=new Set([id]);let cursor=id;while(true){const parent=locationParentOf(cursor,derived);if(!parent||seen.has(parent))break;chain.unshift(parent);seen.add(parent);cursor=parent;}return [...chain,id];}
function locationDescendants(id,derived){const result=[],queue=[id],seen=new Set([id]);while(queue.length){const parent=queue.shift();derived.locationParents.filter(link=>link.parent===parent).forEach(link=>{if(seen.has(link.child))return;seen.add(link.child);result.push(link.child);queue.push(link.child);});}return result;}

// ---- Location hierarchy model -------------------------------------------------
// The graph never draws anything above a Realm: a Realm is always a root, and
// everything nested inside a location stays hidden until that location is opened
// (or an action highlights it, which pops it out as a temporary pod).
const LOCATION_ROOT_TYPE="Realm";
const LOCATION_TIER_RADIUS={Universe:33,Realm:31,World:28,Continent:27,Country:26,State:25,City:24,District:23,Site:22,Building:21,Room:20,Other:22};
function isLocationRoot(id,derived){const item=entity(id);if(!item)return true;if(String(item.locationType||"")===LOCATION_ROOT_TYPE)return true;return !derived.locationParents.some(link=>link.child===id);}
function locationParentOf(id,derived){if(isLocationRoot(id,derived))return null;return derived.locationParents.find(link=>link.child===id)?.parent||null;}
function roundedSquarePath(r,corner){const c=Math.min(corner,r);return `M ${-r+c} ${-r} H ${r-c} Q ${r} ${-r} ${r} ${-r+c} V ${r-c} Q ${r} ${r} ${r-c} ${r} H ${-r+c} Q ${-r} ${r} ${-r} ${r-c} V ${-r+c} Q ${-r} ${-r} ${-r+c} ${-r} Z`;}
// Builds the drawable location tree for the ids the current action has revealed.
// `parentOf` skips ancestors that are not revealed yet, so a deep location still
// attaches to the closest place the reader can actually see.
function buildLocationView(derived,visibleIds){
  return buildDrillView([...visibleIds].filter(id=>entity(id)?.kind==="location"),id=>locationParentOf(id,derived),expandedLocations);
}
// Systems drill down exactly the way places do — collapsed to the outermost one, opened into a
// dot ringed by its subsystems — so both share one tree builder.
// `alsoExpanded` opens a branch for one beat without the reader having clicked: a subsystem that
// is doing something right now has to be visible for that action, then folds back on its own.
function buildSystemView(derived,systemIds,alsoExpanded=null){
  const parentOf=new Map(derived.systemParents.map(link=>[link.child,link.parent])),
    expanded=alsoExpanded&&alsoExpanded.size?new Set([...expandedSystems,...alsoExpanded]):expandedSystems;
  return buildDrillView([...systemIds],id=>parentOf.get(id)||null,expanded);
}
// `parentOfRaw` gives the structural parent, which may not be on screen; the walk skips those so
// a deep node still attaches to the closest ancestor the reader can actually see.
function buildDrillView(nodeIds,parentOfRaw,expandedSet){
  const present=new Set(nodeIds),parentOf=new Map(),children=new Map(nodeIds.map(id=>[id,[]]));
  nodeIds.forEach(id=>{const seen=new Set([id]);let cursor=id,found=null;while(true){const parent=parentOfRaw(cursor);if(!parent||seen.has(parent))break;seen.add(parent);if(present.has(parent)){found=parent;break;}cursor=parent;}parentOf.set(id,found);});
  nodeIds.forEach(id=>{const parent=parentOf.get(id);if(parent)children.get(parent).push(id);});
  const rendered=new Set(),expanded=new Set(),depth=new Map();
  const walk=(id,level)=>{if(rendered.has(id))return;rendered.add(id);depth.set(id,level);const kids=children.get(id)||[];if(kids.length&&expandedSet.has(id)){expanded.add(id);kids.forEach(kid=>walk(kid,level+1));}};
  nodeIds.filter(id=>!parentOf.get(id)).forEach(id=>walk(id,0));
  const anchorOf=new Map();
  nodeIds.forEach(id=>{let cursor=id;const guard=new Set();while(cursor&&!rendered.has(cursor)&&!guard.has(cursor)){guard.add(cursor);cursor=parentOf.get(cursor);}anchorOf.set(id,cursor||null);});
  return {locationIds:nodeIds,present,rendered,expanded,children,parentOf,anchorOf,depth};
}

function renderedSubtree(id,view){const result=[],stack=[...(view.children.get(id)||[])];while(stack.length){const current=stack.pop();if(!view.rendered.has(current))continue;result.push(current);(view.children.get(current)||[]).forEach(kid=>stack.push(kid));}return result;}
function locationGlyphRadius(id,view){const base=LOCATION_TIER_RADIUS[entity(id)?.locationType]||LOCATION_TIER_RADIUS.Other;return Math.max(17,base-(view.depth.get(id)||0)*2);}
// One definition of how much room a node takes, so the layout can reserve space for a node
// before it is drawn. Mirrors the shapes built in renderGraph.
function nodeRadiusFor(item,state,view,chapter,systemView){
  if(item.kind==="organization")return 42;
  if(item.kind==="system")return systemView?.expanded.has(item.id)?20:systemGlyphRadius(state);
  if(item.kind==="location")return view.expanded.has(item.id)?20:locationGlyphRadius(item.id,view)+8;
  const appeared=state?.appeared!==null&&state?.appeared<=chapter;
  return appeared?radius(state)+17:29;
}

function derive(chapter,eventSubset=null) {
  const states = new Map();
  const actionLimited=Array.isArray(eventSubset);
  data.entities.forEach(item => states.set(item.id,{...item,displayName:item.name,nameHistory:[],mentioned:actionLimited?null:firstMention(item),appeared:actionLimited?null:firstAppearance(item),aliases:[],level:0,track:DEFAULT_TRACK_ID,realm:"Unrevealed",canonicalRealm:"Unrevealed",status:"unknown",memberships:[]}));
  const memberships = new Map();
  const awareness = new Map();
  const meetings = new Map();
  const relations = new Map();
  const locations = new Map();
  const locationVisits = [];
  const conversations = [];
  const organizationLocations = new Map();
  const residences = new Map();
  const locationParents = new Map();
  const identityParents = new Map();
  const systemHosts = new Map();
  const systemParents = new Map();
  const systemLocations = new Map();
  const systemMerges = new Map();
  const systemEnds = new Map();
  const questRuns = new Map();
  const questChains = new Map();
  // A quest is a record with a life of its own: issued in one chapter, inched forward over
  // several more, and settled in another. Every one of those is an action, so the tab shows
  // exactly what the reader has read and nothing further.
  const questRun = id => {
    if(!questRuns.has(id))questRuns.set(id,{quest:id,status:"active",progress:0,explicitProgress:false,from:null,to:null,holders:[],updates:[],contributions:[],reward:"",rewardRank:"",performance:""});
    return questRuns.get(id);
  };
  (eventSubset||orderedEvents().filter(e=>e.chapter<=chapter)).forEach(event => {
    const source = states.get(event.source);
    if(event.type==="mention"&&source)source.mentioned=source.mentioned===null?event.chapter:Math.min(source.mentioned,event.chapter);
    if(["appearance","corpse_appearance"].includes(event.type)&&source)source.appeared=source.appeared===null?event.chapter:Math.min(source.appeared,event.chapter);
    if(event.type==="appearance"&&source&&source.status==="unknown")source.status="alive";
    if(event.type==="corpse_appearance"&&source)source.status="dead";
    if (event.type === "alias" && source) source.aliases.push({chapter:event.chapter,value:event.value});
    if (event.type === "display_name" && source && event.value) { source.displayName=event.value;source.nameHistory.push({chapter:event.chapter,value:event.value}); }
    if (event.type === "cultivation" && source) { source.track=trackIdOf(event); source.level = Number(event.level)||1; source.canonicalRealm=cultivationCanonical(event);source.realm=cultivationDisplay(event); }
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
    if(event.type==="system_host"&&source?.kind==="system"&&states.get(event.target)?.kind==="character"){
      const key=event.source+"|"+event.target;
      if(event.action==="remove")systemHosts.delete(key);else systemHosts.set(key,{system:event.source,host:event.target,role:event.value||"Host",from:event.chapter});
    }
    if(event.type==="system_parent"&&source?.kind==="system"&&states.get(event.target)?.kind==="system"){
      if(event.action==="remove"){if(systemParents.get(event.source)?.parent===event.target)systemParents.delete(event.source);}
      else systemParents.set(event.source,{child:event.source,parent:event.target,from:event.chapter});
    }
    if(event.type==="system_rank"&&source?.kind==="system"){
      source.previousAuthority=source.authority;source.previousGrade=source.grade;
      if(event.authority===null)source.authority=undefined;else if(event.authority!==undefined&&String(event.authority).trim()!=="")source.authority=Number(event.authority);
      if(event.grade===null)source.grade=undefined;else if(event.grade)source.grade=String(event.grade).trim();
      source.rankFrom=event.chapter;
    }
    if(event.type==="system_merge"&&source?.kind==="system"&&states.get(event.target)?.kind==="system"){
      if(event.action==="remove")systemMerges.delete(event.source);
      else systemMerges.set(event.source,{absorbed:event.source,into:event.target,from:event.chapter});
    }
    if(String(event.type).startsWith("quest_")&&source?.kind==="quest"){
      if(event.type==="quest_part"){
        if(event.action==="remove"){if(questChains.get(event.source)?.parent===event.target)questChains.delete(event.source);}
        else if(states.get(event.target)?.kind==="quest"&&event.target!==event.source)questChains.set(event.source,{child:event.source,parent:event.target,from:event.chapter});
      }else{
        const run=questRun(event.source);
        if(run.from===null)run.from=event.chapter;
        if(event.type==="quest_issue"){
          if(event.action==="withdraw"){questRuns.delete(event.source);}
          else{run.status="active";run.to=null;
            // More than one holder makes it a joint quest: the work is shared and so, later, is
            // the reward, in whatever proportion the story says each of them contributed.
            [event.target,...(event.characters||[])].filter(Boolean).forEach(id=>{if(states.get(id)?.kind==="character"&&!run.holders.includes(id))run.holders.push(id);});
            run.updates.push({chapter:event.chapter,order:event.order||0,kind:"issued",text:event.description||"",progress:run.progress});}
        }
        if(event.type==="quest_update")run.updates.push({chapter:event.chapter,order:event.order||0,kind:"note",noteKind:event.value||"Update",text:event.description||"",progress:run.progress});
        if(event.type==="quest_contribution"&&states.get(event.target)?.kind==="character"){
          const existing=run.contributions.find(item=>item.character===event.target);
          const record={character:event.target,share:event.value||"",rewardRank:event.rewardRank||"",performance:event.performance||"",chapter:event.chapter};
          if(existing)Object.assign(existing,record);else run.contributions.push(record);
          if(!run.holders.includes(event.target))run.holders.push(event.target);
        }
        if(event.type==="quest_progress"){
          const percent=Math.max(0,Math.min(100,Number(event.progress)));
          if(Number.isFinite(percent)){run.progress=percent;run.explicitProgress=true;}
          run.updates.push({chapter:event.chapter,order:event.order||0,kind:"progress",text:event.description||"",progress:run.progress});
        }
        if(event.type==="quest_end"){
          const outcome=event.action||"complete";
          if(outcome==="reopen"){run.status="active";run.to=null;}
          else{run.status=outcome==="fail"?"failed":outcome==="abandon"?"abandoned":"complete";run.to=event.chapter;if(run.status==="complete"){run.progress=100;run.explicitProgress=true;}}
          // What the quest actually paid, and how well it was done, are told at the end — that is
          // the point at which most quests name a reward at all.
          if(event.rewardRank)run.rewardRank=event.rewardRank;
          if(event.performance)run.performance=event.performance;
          if(event.value)run.reward=event.value;
          run.updates.push({chapter:event.chapter,order:event.order||0,kind:run.status,text:event.description||"",progress:run.progress});
        }
      }
    }
    if(event.type==="system_end"&&source?.kind==="system"){
      if(event.action==="remove")systemEnds.delete(event.source);
      else systemEnds.set(event.source,{system:event.source,from:event.chapter,reason:event.value||"Destroyed"});
    }
    if(event.type==="system_location"&&source?.kind==="system"&&states.get(event.location)?.kind==="location"){
      const key=event.source+"|"+event.location;
      if(event.action==="close")systemLocations.delete(key);else systemLocations.set(key,{system:event.source,location:event.location,role:event.value||"Branch",from:event.chapter});
    }
    // An identity link is not only one character standing in for another. A character can be
    // merged into a system and later separate from it again, which is the same fact changing its
    // wording chapter by chapter rather than a different kind of fact.
    if(event.type==="identity_parent"&&IDENTITY_KINDS.has(source?.kind)&&IDENTITY_KINDS.has(states.get(event.target)?.kind)){
      if(event.action==="remove"){if(identityParents.get(event.source)?.parent===event.target)identityParents.delete(event.source);}else identityParents.set(event.source,{child:event.source,parent:event.target,relation:event.value||"Clone",from:event.chapter});
    }
    if (event.type === "awareness" && source && states.has(event.target)) {
      const key = pairKey(event.source,event.target);
      if (!awareness.has(key)) awareness.set(key,{a:key.split("|")[0],b:key.split("|")[1],aToB:false,bToA:false,from:event.chapter});
      const pair = awareness.get(key); pair.from = event.chapter; if (event.source === pair.a) pair.aToB = true; else pair.bToA = true;
    }
    if (event.type === "meeting" && source && states.has(event.target)) meetings.set(pairKey(event.source,event.target),event);
    if (event.type === "conversation" && source) {
      const talkers=[...new Set([event.source,...(event.characters||[])])].filter(id=>states.get(id)?.kind==="character");
      talkers.forEach((a,index)=>talkers.slice(index+1).forEach(b=>{if(!meetings.has(pairKey(a,b)))meetings.set(pairKey(a,b),event);}));
      if(talkers.length>1)conversations.push({id:event.id,chapter:event.chapter,order:event.order||0,location:event.location||null,talkers,description:event.description||""});
    }
    if (event.type === "relationship" && source && states.has(event.target)) {
      const key = pairKey(event.source,event.target); if (!relations.has(key)) relations.set(key,[]); relations.get(key).push(event);
    }
    if(event.location&&states.get(event.location)?.kind==="location"&&!['mention','residency','location_parent','organization_location'].includes(event.type)){
      locationCharacterIds(event).forEach(character=>{const visit={character,location:event.location,chapter:event.chapter,order:event.order||0,eventId:event.id,type:event.type};locationVisits.push(visit);});
      if(event.type==="movement"&&source?.kind==="character")locations.set(event.source,{character:event.source,location:event.location,chapter:event.chapter,order:event.order||0,eventId:event.id,type:event.type});
    }
  });
  memberships.forEach(item => states.get(item.character)?.memberships.push(item));
  // A chain quest that carries no figure of its own reads as how far through its parts it is,
  // and a chain whose first part is issued gets a header even if the chain itself never was.
  const questChildren=new Map();
  questChains.forEach(link=>{if(!questChildren.has(link.parent))questChildren.set(link.parent,[]);questChildren.get(link.parent).push(link.child);});
  questChains.forEach(link=>{if(questRuns.has(link.child)&&!questRuns.has(link.parent))questRun(link.parent).from=questRuns.get(link.child).from;});
  const computedProgress=new Set(),rollUpQuest=id=>{
    const run=questRuns.get(id);if(!run)return 0;
    if(computedProgress.has(id))return run.progress;computedProgress.add(id);
    const kids=(questChildren.get(id)||[]).filter(child=>questRuns.has(child)),
      total=kids.reduce((sum,child)=>sum+rollUpQuest(child),0);
    if(!run.explicitProgress&&kids.length)run.progress=Math.round(total/kids.length);
    return run.progress;
  };
  [...questRuns.keys()].forEach(id=>rollUpQuest(id));
  return { states, quests:[...questRuns.values()], questChains:[...questChains.values()], memberships:[...memberships.values()], organizationLocations:[...organizationLocations.values()], residences:[...residences.values()], locationParents:[...locationParents.values()], identityParents:[...identityParents.values()], systemHosts:[...systemHosts.values()], systemParents:[...systemParents.values()], systemLocations:[...systemLocations.values()], systemMerges:[...systemMerges.values()], systemEnds:[...systemEnds.values()], awareness, meetings, relations, locations, locationVisits, conversations };
}
function currentDerived(){return derive(currentChapter,appliedEvents());}

// The ladders live in the data, so every control that offers a rank is filled from them.
function fillTrackSelect(select,selected){
  if(!select)return;
  const tracks=progressionTracks(),value=tracks.some(track=>track.id===selected)?selected:tracks[0].id;
  select.innerHTML=tracks.map(track=>`<option value="${escapeHtml(track.id)}">${escapeHtml(track.name||track.id)}</option>`).join("");
  select.value=value;
}
function fillLevelSelect(select,trackId,selected){
  if(!select)return;
  const ladder=trackLevels(trackId);
  select.innerHTML=`<option value="">Choose a rank…</option>`+ladder.map((name,index)=>`<option value="${index+1}">${index+1}. ${escapeHtml(name)}</option>`).join("");
  select.value=selected&&Number(selected)<=ladder.length?String(selected):"";
}
function refreshProgressionControls(){
  const eventForm=$("#event-form"),entityForm=$("#entity-form");
  if(eventForm){const keepLevel=eventForm.elements.level.value;fillTrackSelect(eventForm.elements.track,eventForm.elements.track.value);fillLevelSelect(eventForm.elements.level,eventForm.elements.track.value,keepLevel);}
  if(entityForm){const keepLevel=entityForm.elements.initialLevel.value;fillTrackSelect(entityForm.elements.initialTrack,entityForm.elements.initialTrack.value);fillLevelSelect(entityForm.elements.initialLevel,entityForm.elements.initialTrack.value,keepLevel);}
}
function configure() {
  $("#novel-name").textContent = data.novel;
  refreshProgressionControls();
  volumeSelect.innerHTML = data.volumes.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`).join("");
  volumeSelect.value = activeVolume;
  updateSuggestions();
  configureTimeline();
}
function updateSuggestions() {
  const d=currentDerived(),known=appliedEvents(),knownIds=new Set(known.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),publicOptions=[],adminOptions=[];
  // A quest is a record, not a node, so it is never offered by the graph search — only by the
// editor's own list, where it has to be pickable as an action's subject.
data.entities.forEach(item=>{const shown=stateName(d,item.id);if(knownIds.has(item.id)&&item.kind!=="quest"){publicOptions.push(`<option value="${escapeHtml(shown)}">${item.kind}</option>`);if(shown!==item.name)publicOptions.push(`<option value="${escapeHtml(item.name)}">Earlier name of ${escapeHtml(shown)}</option>`);known.filter(e=>["alias","display_name"].includes(e.type)&&e.source===item.id).forEach(e=>publicOptions.push(`<option value="${escapeHtml(e.value)}">Known name of ${escapeHtml(shown)}</option>`));}adminOptions.push(`<option value="${escapeHtml(item.name)}">${item.kind}</option>`);data.events.filter(e=>["alias","display_name"].includes(e.type)&&e.source===item.id).forEach(e=>adminOptions.push(`<option value="${escapeHtml(e.value)}">Name of ${escapeHtml(item.name)}</option>`));});
  $("#entity-options").innerHTML = publicOptions.join("");
  $("#admin-entity-options").innerHTML = adminOptions.join("");
  $("#location-options").innerHTML=data.entities.filter(item=>item.kind==="location").map(item=>`<option value="${escapeHtml(item.name)}"></option>`).join("");
}
// A marker is eight pixels across, so it can hold about three slices before it turns to mud.
// Where a chapter carries more kinds than that — and most chapters carry several — the three
// most common win and the rest are simply not shown.
const MARKER_SLICE_LIMIT = 3;
function eventMarkerFill(events,limit=MARKER_SLICE_LIMIT){
  const tally=new Map();
  events.forEach(event=>{const color=EVENT_TYPE_COLORS[event.type]||"#7f8da3";tally.set(color,(tally.get(color)||0)+1);});
  const colors=[...tally].sort((a,b)=>b[1]-a[1]).slice(0,Math.max(1,limit)).map(([color])=>color);
  if(colors.length<2)return colors[0]||"#7f8da3";
  const size=100/colors.length;
  return `conic-gradient(${colors.map((color,index)=>`${color} ${index*size}% ${(index+1)*size}%`).join(",")})`;
}
function volumeChapterGroups(){const groups=[],byChapter=new Map();volumeActions().forEach((event,index)=>{if(!byChapter.has(event.chapter)){const group={chapter:event.chapter,entries:[]};byChapter.set(event.chapter,group);groups.push(group);}byChapter.get(event.chapter).entries.push({event,index:index+1});});return groups;}
function chapterEventEntries(chapter){return volumeChapterGroups().find(group=>group.chapter===chapter)?.entries||[];}
// One dot per chapter stops being readable — and stops being cheap to draw — the moment a volume
// runs to hundreds of chapters. Past what the track can physically show, neighbouring chapters
// are gathered into a single tick: its height says how busy that stretch is, its colour mixes
// the kinds of action inside it, and clicking it drops the reader at the first chapter in it.
// Dots give way in two stages rather than one. They shrink first, which keeps every chapter
// individually aimable for a volume of ordinary length, and only when even a small dot cannot
// hold its ground do neighbouring chapters gather into a bar.
// Whatever is being shown along the bar — chapters or one person's turning points — the same
// answer applies when there are more of them than the track can hold: gather neighbours into a
// bar whose height is how much falls in that stretch, and let it lead where the first one does.
function binTimelineUnits(units,budget){
  const perBin=Math.ceil(units.length/Math.max(1,budget)),bins=[];
  for(let start=0;start<units.length;start+=perBin){
    const slice=units.slice(start,start+perBin);
    bins.push({start,end:start+slice.length-1,from:slice[0].from,to:slice.at(-1).to,units:slice.length,
      events:slice.flatMap(unit=>unit.events),index:slice[0].index});
  }
  return bins;
}
function timelineMarkLayout(count){
  const width=$("#timeline-marks")?.clientWidth||520,per=count?width/count:width;
  if(per>=7)return {mode:"dots",size:Math.max(5,Math.min(8,per-5))};
  return {mode:"bins",budget:Math.max(12,Math.min(64,Math.floor(width/13)))};
}
function renderTimelineMarkers(){
  const marks=[],chapterGroups=volumeChapterGroups(),track=$("#timeline-marks");
  track.classList.remove("tight-marks");track.style.removeProperty("--mark-size");
  if(expandedChapter!==null){const entries=chapterEventEntries(expandedChapter),denominator=entries.length+1;marks.push(`<span class="expanded-boundary-mark previous-boundary" style="left:0" title="Drag here to close and go to the previous chapter">‹</span>`);entries.forEach((entry,index)=>{marks.push(`<button type="button" class="main-timeline-mark expanded-event-mark selectable" style="left:${(index+1)/denominator*100}%;--marker-fill:${EVENT_TYPE_COLORS[entry.event.type]||"#7f8da3"}" title="Event ${index+1} · ${escapeHtml(entry.event.type.replaceAll("_"," "))}" data-event-action="${entry.index}" aria-label="Show event ${index+1} of chapter ${expandedChapter}"></button>`);});marks.push(`<span class="expanded-boundary-mark next-boundary" style="left:100%" title="Drag here to close and go to the next chapter">›</span>`);}
  else{
    // The bar is not a list of chapters. Nearly every chapter carries several events, so marking
    // them all says nothing and crowds everything. What is marked is where the reader is — which
    // opens into that chapter's events — and, when someone is selected, that one's turning points
    // and nobody else's.
    if(selectedId&&chapterGroups.length){
      const chosen=entity(selectedId),
        milestones=volumeActions().slice(0,currentActionIndex).map((event,index)=>({event,index:index+1}))
          .filter(entry=>MAJOR_EVENT_TYPES.has(entry.event.type)&&eventInvolves(entry.event,selectedId)),
        // A chapter where four things turned is still one place on the bar.
        byChapter=new Map(),chapterAt=new Map(chapterGroups.map((group,index)=>[group.chapter,index]));
      milestones.forEach(entry=>{
        if(!chapterAt.has(entry.event.chapter))return;
        if(!byChapter.has(entry.event.chapter))byChapter.set(entry.event.chapter,{from:entry.event.chapter,to:entry.event.chapter,at:chapterAt.get(entry.event.chapter),events:[],index:entry.index});
        byChapter.get(entry.event.chapter).events.push(entry.event);
      });
      const units=[...byChapter.values()],fit=timelineMarkLayout(units.length),
        place=at=>(at+1)/chapterGroups.length*100;
      if(fit.mode==="dots"){
        track.style.setProperty("--mark-size",`${fit.size}px`);
        track.classList.toggle("tight-marks",fit.size<7);
        units.forEach(unit=>{
          const kinds=[...new Set(unit.events.map(event=>String(event.type).replaceAll("_"," ")))].join(", ");
          marks.push(`<button type="button" class="main-timeline-mark milestone-mark selectable" style="left:${place(unit.at)}%;--marker-fill:${eventMarkerFill(unit.events,fit.size<7?1:MARKER_SLICE_LIMIT)}" title="Chapter ${unit.from} · ${escapeHtml(kinds)}" data-event-action="${unit.index}" aria-label="Go to chapter ${unit.from}"></button>`);
        });
      }else{
        // Even one person can turn more often than the track can hold, so their marks gather the
        // same way anything else would.
        const bins=binTimelineUnits(units,fit.budget),busiest=Math.max(1,...bins.map(bin=>bin.events.length));
        bins.forEach(bin=>{
          const span=bin.from===bin.to?`Chapter ${bin.from}`:`Chapters ${bin.from}–${bin.to}`;
          marks.push(`<button type="button" class="main-timeline-mark binned-mark milestone-bin selectable" style="left:${place((units[bin.start].at+units[bin.end].at)/2)}%;--marker-fill:${eventMarkerFill(bin.events)};--mark-weight:${Math.sqrt(bin.events.length/busiest).toFixed(2)}" title="${span} · ${bin.events.length} turning point${bin.events.length===1?"":"s"} · click to go there" data-event-action="${bin.index}" aria-label="Go to ${span}"></button>`);
        });
      }
      $("#event-position").textContent=`${stateName(currentDerived(),selectedId)||chosen?.name||"Selected"} · ${milestones.length} turning point${milestones.length===1?"":"s"}`;
    }
    // Where the reader is, always, on top of anything else.
    const hereIndex=chapterGroups.findIndex(group=>group.chapter===currentChapter),here=chapterGroups[hereIndex];
    if(here){
      const position=(hereIndex+1)/chapterGroups.length*100,several=here.entries.length>1;
      marks.push(several
        ?`<button type="button" class="main-timeline-mark here-mark expandable" style="left:${position}%;--marker-fill:${eventMarkerFill(here.entries.map(entry=>entry.event))}" title="Chapter ${here.chapter} · ${here.entries.length} events · click to expand" data-expand-chapter="${here.chapter}" aria-label="Expand chapter ${here.chapter} events"></button>`
        :`<span class="main-timeline-mark here-mark" style="left:${position}%;--marker-fill:${eventMarkerFill(here.entries.map(entry=>entry.event))}" title="Chapter ${here.chapter}"></span>`);
    }
  }
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
function scheduleChapterSequence(){cancelChapterSequence();if(expandedChapter!==null||eventScrollHold)return;const current=currentActionEvent(),next=volumeActions()[currentActionIndex];if(!current||!next||next.chapter!==current.chapter)return;chapterAutoplayTimer=setTimeout(()=>{chapterAutoplayTimer=null;currentActionIndex+=1;currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();scheduleChapterSequence();},1150);}
function applyTimeline() {
  const previous=currentActionIndex,value=Number(timeline.value);cancelChapterSequence();if(timeline.dataset.mode==="chapter-events"){const groups=volumeChapterGroups(),groupIndex=groups.findIndex(group=>group.chapter===expandedChapter),entries=groups[groupIndex]?.entries||[];if(value<=0){expandedChapter=null;currentActionIndex=groupIndex>0?groups[groupIndex-1].entries.at(-1).index:0;currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();return;}if(value>=entries.length+1){expandedChapter=null;const nextGroup=groups[groupIndex+1];currentActionIndex=nextGroup?nextGroup.entries[0].index:entries.at(-1)?.index||0;currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();if(nextGroup)scheduleChapterSequence();return;}currentActionIndex=entries[value-1].index;currentChapter=expandedChapter;renderAll();return;}const groups=volumeChapterGroups();if(value<=0){currentActionIndex=0;currentChapter=activeVol().from;renderAll();return;}const group=groups[value-1];if(!group)return;currentActionIndex=group.entries[0].index;currentChapter=group.chapter;renderAll();if(currentActionIndex>previous)scheduleChapterSequence();
}
function stepTimeline(direction) { const next=Math.max(Number(timeline.min),Math.min(Number(timeline.max),Number(timeline.value)+direction));if(next===Number(timeline.value))return;timeline.value=next;applyTimeline(); }

function svgEl(name,attrs={}) { const element=document.createElementNS(SVG_NS,name); Object.entries(attrs).forEach(([key,value])=>element.setAttribute(key,String(value))); return element; }
function arcPath(cx,cy,r,startDeg,endDeg){const a=startDeg*Math.PI/180,b=endDeg*Math.PI/180;return `M ${cx+Math.cos(a)*r} ${cy+Math.sin(a)*r} A ${r} ${r} 0 0 1 ${cx+Math.cos(b)*r} ${cy+Math.sin(b)*r}`;}
function diamondPoints(cx,cy,s){return `${cx},${cy-s} ${cx+s},${cy} ${cx},${cy+s} ${cx-s},${cy}`;}
function seedPosition(item,index,total) {
  const fixed={lex:[125,90],eclipse:[585,80],inn:[355,165],mary:[595,225],luthor:[110,270],gerald:[350,305],jotun:[70,435],garden:[650,435],"inn-estate":[205,435],"inn-lobby":[365,435],"garden-realm":[525,435]};
  if(fixed[item.id]) return fixed[item.id];
  // The ring below is in world space, so once the view has moved to follow the story a newcomer
  // could be seeded outside what the reader can see. Spiral out from the middle of the visible
  // rectangle instead, and keep well inside its edges.
  const angle=index*2.3999632297,reach=58+27*Math.sqrt(index+1),
    left=(0-view.x)/view.scale,right=(720-view.x)/view.scale,
    top=(0-view.y)/view.scale,bottom=(520-view.y)/view.scale,
    cx=(left+right)/2,cy=(top+bottom)/2,
    limitX=Math.max(60,(right-left)/2-70),limitY=Math.max(50,(bottom-top)/2-60),
    r=Math.min(reach,limitX,limitY/.78);
  return [cx+Math.cos(angle)*r,cy+Math.sin(angle)*r*.78];
}
function visibleFrom(item){return item.kind!=="character"?(validChapter(item.intro)??Infinity):(firstMention(item)??firstAppearance(item)??Infinity);}
function radius(state){const ladder=trackLevels(state?.track);return 19+Math.min(1,Math.max(0,Number(state.level)||0)/ladder.length)*17;}

function createGradient(defs,id,history,chapter){
  if(!history.length)return {url:COLORS.neutral,el:null}; const gradient=svgEl("linearGradient",{id,gradientUnits:"userSpaceOnUse"}); const startChapter=history[0].chapter;
  history.forEach((event,i)=>{const denominator=Math.max(1,chapter-startChapter),instant=chapter===startChapter&&history.length===1,start=instant?0:Math.max(0,(event.chapter-startChapter)/denominator),next=i+1<history.length?history[i+1].chapter:chapter,end=instant?1:Math.min(1,(next-startChapter)/denominator),color=COLORS[event.value]||COLORS.neutral;gradient.append(svgEl("stop",{offset:start*100+"%","stop-color":color}),svgEl("stop",{offset:end*100+"%","stop-color":color}));}); defs.appendChild(gradient); return {url:`url(#${id})`,el:gradient};
}

// --- Flowy force-directed layout engine (Obsidian-style): positions persist across
// renders and drift continuously under simple physics, so the graph never "snaps" —
// it drags, settles, and re-flows smoothly whenever the underlying data changes.
const SEPARATION_GAP = 22;
const POD_TRAVEL_MS = 520;
const physics = { pos: new Map(), vel: new Map(), bounds: new Map(), radii: new Map(), degree: new Map(), podPos: new Map(), hubPos: new Map(), calm: new Map(), edges: [], dragId: null, alpha: 0 };
const view = { x: 0, y: 0, scale: 1 };
let lastAutoFitSignature="";
let viewportGroup = null;
let dragMoved = false, dragOffset = { x: 0, y: 0 }, dragStartClient = { x: 0, y: 0 };
let panStart = null;
let autoFitTimers = [], viewPinnedByUser = false, viewTween = null;

function pointFor(id){return physics.pos.get(id)||physics.podPos.get(id)||physics.hubPos.get(id)||null;}
function ensurePos(id, seedFn) {
  if (!physics.pos.has(id)) { const [x, y] = seedFn(); physics.pos.set(id, { x, y }); physics.vel.set(id, { x: 0, y: 0 }); }
  return physics.pos.get(id);
}
// The layout used to run until it happened to go quiet, which after a busy action meant seconds
// of drifting — and with an action a second, it never stopped. It now runs on a budget: a change
// heats it, every frame cools it, and below a floor it stops dead. Motion is bounded to about
// half a second whatever happens.
const ALPHA_DECAY = 0.9, ALPHA_FLOOR = 0.02, ALPHA_CONTACT = 0.3;
function stepPhysics() {
  const ids = [...physics.pos.keys()]; if (!ids.length) return;
  if (physics.alpha < ALPHA_FLOOR && !physics.dragId) return;
  const force = new Map(ids.map(id => [id, { x: 0, y: 0 }]));
  // Both constants used to move with every single node, which changed the balance the whole
  // layout was resting in and slid everything across the screen each time one thing arrived.
  // Rounding the count to a step of eight means they change rarely instead of constantly.
  const scaleCount = Math.round(ids.length/8)*8;
  const REPEL = 2600+Math.min(6200,Math.max(0,scaleCount-10)*115), CENTER = Math.max(.00032,.00115-Math.max(0,scaleCount-12)*.000015), cx = 360, cy = 260;
  // A node that has been sitting still has earned the right to stay put: it takes a fraction of
  // the force until something actually touches it. New arrivals are fully mobile and find their
  // own place around a layout that no longer swims away from them.
  const disturbed = new Set(), overlapping = new Set();
  // Keeps one node's name from settling on top of another node's shape — label-versus-label
  // separation alone still let a long place name sit across a neighbouring character.
  const clearLabelOfShape=(labelPos,labelBox,shapePos,shapeRadius,labelForce,shapeForce)=>{
    if(!labelBox||!labelForce||!shapeForce)return;
    const dx=(labelPos.x+labelBox.ox)-shapePos.x,dy=(labelPos.y+labelBox.oy)-shapePos.y,
      overlapX=labelBox.hw+shapeRadius+14-Math.abs(dx),overlapY=labelBox.hh+shapeRadius+12-Math.abs(dy);
    if(overlapX<=0||overlapY<=0)return;
    if(overlapX<overlapY){const direction=dx>=0?1:-1,push=Math.min(3.5,.085*overlapX);labelForce.x+=direction*push;shapeForce.x-=direction*push;}
    else{const direction=dy>=0?1:-1,push=Math.min(3.5,.11*overlapY);labelForce.y+=direction*push;shapeForce.y-=direction*push;}
  };
  for (let i = 0; i < ids.length; i++) {
    const a = physics.pos.get(ids[i]), fa = force.get(ids[i]);
    for (let j = i + 1; j < ids.length; j++) {
      const b = physics.pos.get(ids[j]), fb = force.get(ids[j]);
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 9) { dx = (Math.random() - 0.5) * 3; dy = (Math.random() - 0.5) * 3; d2 = dx * dx + dy * dy || 1; }
      const d = Math.sqrt(d2), f = REPEL / d2, fx = dx / d * f, fy = dy / d * f;
      fa.x += fx; fa.y += fy; fb.x -= fx; fb.y -= fy;
      // Hard separation: inverse-square repulsion alone still lets two shapes sit on top of
      // each other once springs pull them together.
      const ra=physics.radii.get(ids[i])||24,rb=physics.radii.get(ids[j])||24,clearance=ra+rb+SEPARATION_GAP;
      if(d<clearance){const push=Math.min(6,(clearance-d)*.24);fa.x+=dx/d*push;fa.y+=dy/d*push;fb.x-=dx/d*push;fb.y-=dy/d*push;disturbed.add(ids[i]);disturbed.add(ids[j]);
        // Only shapes genuinely on top of each other keep the run alive. Reheating merely
        // because two nodes are inside the comfort gap kept it awake for ever.
        if(d<ra+rb){overlapping.add(ids[i]);overlapping.add(ids[j]);}}
      const ab=physics.bounds.get(ids[i]),bb=physics.bounds.get(ids[j]);
      if(ab&&bb){const labelDx=(a.x+ab.ox)-(b.x+bb.ox),labelDy=(a.y+ab.oy)-(b.y+bb.oy),overlapX=ab.hw+bb.hw+16-Math.abs(labelDx),overlapY=ab.hh+bb.hh+10-Math.abs(labelDy);if(overlapX>0&&overlapY>0){const opposed=(a.y-b.y)*labelDy<0;if(opposed||overlapX<overlapY){const direction=labelDx>=0?1:-1,push=Math.min(5,.14*overlapX);fa.x+=direction*push;fb.x-=direction*push;}else{const direction=labelDy>=0?1:-1,push=Math.min(5,.18*overlapY);fa.y+=direction*push;fb.y-=direction*push;}}}
      clearLabelOfShape(a,ab,b,rb,fa,fb);clearLabelOfShape(b,bb,a,ra,fb,fa);
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
  // Shapes actually sitting on top of each other re-heat the run, so a crowded arrival still
  // gets pushed apart however late it happens.
  if (overlapping.size) physics.alpha = Math.max(physics.alpha, ALPHA_CONTACT);
  const heat = physics.dragId ? 1 : Math.min(1, physics.alpha);
  physics.alpha = physics.dragId ? 1 : physics.alpha * ALPHA_DECAY;
  const DAMP = 0.82, MAXV = 13, REST_SPEED = 0.12;
  ids.forEach(id => {
    if (id === physics.dragId || physics.pos.get(id)?.pinned) { physics.calm.set(id,0); return; }
    const v = physics.vel.get(id), f = force.get(id), p = physics.pos.get(id);
    // Two shapes actually touching always get their full push, so nothing settles overlapping.
    const touching = disturbed.has(id), speed = Math.hypot(v.x,v.y),
      calm = touching ? 0 : Math.max(0, Math.min(1, (physics.calm.get(id)||0) + (speed < 1.2 ? .04 : -.3))),
      mobility = (1 - .78*calm) * heat;
    physics.calm.set(id,calm);
    v.x = Math.max(-MAXV, Math.min(MAXV, (v.x + f.x*mobility) * DAMP));
    v.y = Math.max(-MAXV, Math.min(MAXV, (v.y + f.y*mobility) * DAMP));
    if (Math.abs(v.x) < REST_SPEED && Math.abs(v.y) < REST_SPEED) { v.x = 0; v.y = 0; return; }
    p.x += v.x; p.y += v.y;
  });
}
let nodeEls = new Map(), labelEls = new Map(), edgeUpdaters = [];
let hoverId = null, labelCullFrame = 0;
function applyViewTransform() { if (viewportGroup) viewportGroup.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.scale})`); graph.style.setProperty("--label-scale", labelScale().toFixed(3)); }
// The fit used to jump straight to its new framing, which read as the graph lurching. Ease
// into it instead, and drop the tween the moment the reader takes hold of the view.
function glideViewTo(target,duration=700){
  if(!viewportGroup||!nodeEls.size){Object.assign(view,target);applyViewTransform();return;}
  viewTween={from:{x:view.x,y:view.y,scale:view.scale},to:target,start:performance.now(),duration};
}
function stepViewTween(){
  if(!viewTween)return;
  const progress=Math.min(1,(performance.now()-viewTween.start)/viewTween.duration),
    eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2,{from,to}=viewTween;
  view.x=from.x+(to.x-from.x)*eased;view.y=from.y+(to.y-from.y)*eased;view.scale=from.scale+(to.scale-from.scale)*eased;
  applyViewTransform();
  if(progress>=1)viewTween=null;
}
function labelScale() { return Math.min(1.25, Math.max(.8, 1 / view.scale)); }
// How many quiet nodes may keep a name. A handful of nodes keep all of them; a crowded graph
// hands names to the few that rank highest and lets hover reveal the rest.
function labelBudget(count) { return Math.max(9, Math.round(900 / Math.max(1, count))); }
function toSvgPoint(clientX, clientY) {
  const pt = graph.createSVGPoint(); pt.x = clientX; pt.y = clientY;
  const ctm = graph.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse()); return { x: p.x, y: p.y };
}
function toContentPoint(clientX, clientY) { const u = toSvgPoint(clientX, clientY); return { x: (u.x - view.x) / view.scale, y: (u.y - view.y) / view.scale }; }
function zoomBy(factor, atX = 360, atY = 260) {
  viewPinnedByUser = true; viewTween = null;
  const contentX = (atX - view.x) / view.scale, contentY = (atY - view.y) / view.scale;
  view.scale = Math.max(0.35, Math.min(3, view.scale * factor));
  view.x = atX - contentX * view.scale; view.y = atY - contentY * view.scale;
  applyViewTransform();
}
// Seeded once per volume, not once per node. Re-guessing a scale from the node count on every
// action fought the real fit that follows a moment later, and the graph was seen lurching in and
// out on every step.
function fitGraphToCount(count,force=false){
  // The real fit, against the settled layout, gets its chance after every render. What happens
  // only once per volume is the crude guess below, made before the simulation has run at all —
  // re-guessing that on every action was what set the view lurching.
  scheduleAutoFit();
  const signature=`${activeVolume}`;if(!force&&signature===lastAutoFitSignature)return;lastAutoFitSignature=signature;const scale=Math.max(.38,Math.min(1,Math.sqrt(18/Math.max(18,count))));glideViewTo({scale,x:360*(1-scale),y:260*(1-scale)});viewPinnedByUser=false;}
// The seeded scale above is a guess made before the simulation has run. Once the layout
// settles, fit the real bounding box to the canvas so the graph fills the space instead of
// huddling in the middle — and so a big graph zooms out far enough for the declutter to work.
function scheduleAutoFit(){autoFitTimers.forEach(clearTimeout);autoFitTimers=[220,850,1900].map(delay=>setTimeout(()=>{if(!viewPinnedByUser&&!physics.dragId)fitGraphToContent();},delay));}
function fitGraphToContent(){
  const entries=[...physics.pos.entries()].filter(([id])=>nodeEls.has(id));
  if(entries.length<2)return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  entries.forEach(([id,point])=>{const reach=(physics.radii.get(id)||24)+10,label=labelEls.get(id),top=label?Math.min(0,label.offset)-15:0,bottom=label?Math.max(0,label.offset)+15:0;
    minX=Math.min(minX,point.x-reach);maxX=Math.max(maxX,point.x+reach);minY=Math.min(minY,point.y-reach+top);maxY=Math.max(maxY,point.y+reach+bottom);});
  const width=Math.max(1,maxX-minX),height=Math.max(1,maxY-minY),padding=54,
    scale=Math.max(.3,Math.min(1.3,Math.min((720-padding*2)/width,(520-padding*2)/height))),
    target={scale,x:360-(minX+maxX)/2*scale,y:260-(minY+maxY)/2*scale};
  // The graph must still make room as the story grows — but a single threshold let it pull out
  // and straight back in, over and over. Pulling out and easing in therefore answer to different
  // thresholds: the moment the content needs more room the view gives it, while it only closes
  // back in once there is a great deal of empty space, which is what stops the two chasing each
  // other. A short cooldown keeps a busy chapter from refitting several times over.
  // Anything actually outside the canvas is a different case from a framing that has drifted:
  // it cannot wait for the cooldown or for the thresholds below, because the reader is looking
  // at a graph with something missing from it.
  const outside=entries.some(([id,point])=>{
    const reach=(physics.radii.get(id)||24)+10,
      sx=point.x*view.scale+view.x,sy=point.y*view.scale+view.y,pad=reach*view.scale;
    return sx-pad<0||sx+pad>720||sy-pad<0||sy+pad>520;
  });
  const now=performance.now(),needsRoom=target.scale<view.scale*.97,
    tooMuchRoom=target.scale>view.scale*1.5,
    offCentre=Math.hypot(target.x-view.x,target.y-view.y)>120;
  if(!outside&&now-lastContentFit<900)return;
  if(!outside&&!needsRoom&&!tooMuchRoom&&!offCentre)return;
  // When only the framing drifted, keep the scale rather than nudging it as well.
  lastContentFit=now;
  // Rescuing something off-frame may pan, and may pull back to make room, but must never close
  // in — that is the direction that sets the view chasing itself.
  glideViewTo(outside?{...target,scale:Math.min(view.scale,target.scale)}
    :needsRoom||tooMuchRoom?target:{...target,scale:view.scale});
  updateLabelVisibility();
}
// Follows the anchor as it settles, so the ghost arrives where the parent actually is rather
// than where it stood when the journey began.
function stepDepartingGhosts(){
  if(!departingGhosts.length)return;
  const now=performance.now();
  departingGhosts=departingGhosts.filter(ghost=>{
    const target=physics.pos.get(ghost.into),progress=Math.min(1,(now-ghost.start)/ghost.duration);
    if(!target||progress>=1){ghost.el.remove();return false;}
    const ease=1-Math.pow(1-progress,3),
      x=ghost.from.x+(target.x-ghost.from.x)*ease,y=ghost.from.y+(target.y-ghost.from.y)*ease;
    ghost.el.style.transform=`translate(${x}px,${y}px) scale(${(1-.74*ease).toFixed(3)})`;
    ghost.el.style.opacity=String((1-ease*ease).toFixed(3));
    return true;
  });
}
// Runs the mote down the line, following both ends as the layout settles, and flares as it
// lands. One beat only — the next action clears it.
function stepQuestPulses(){
  if(!questPulses.length)return;
  const now=performance.now();
  questPulses=questPulses.filter(pulse=>{
    const a=physics.pos.get(pulse.from),b=physics.pos.get(pulse.to),
      progress=Math.min(1,(now-pulse.start)/pulse.duration);
    if(!a||!b||progress>=1){pulse.el.remove();return false;}
    const ease=progress<.5?2*progress*progress:1-(-2*progress+2)**2/2,
      x=a.x+(b.x-a.x)*ease,y=a.y+(b.y-a.y)*ease,
      arrival=Math.max(0,(progress-.72)/.28);
    pulse.el.style.transform=`translate(${x}px,${y}px) scale(${(1+arrival*2.1).toFixed(2)})`;
    pulse.el.style.opacity=String((arrival?1-arrival:1).toFixed(3));
    return true;
  });
}
function tickGraph() {
  stepViewTween();
  stepDepartingGhosts();
  stepQuestPulses();
  if (activeView === "graph" && physics.pos.size) {
    stepPhysics();
    nodeEls.forEach((el, id) => { const p = physics.pos.get(id); if (p) el.setAttribute("transform", `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`); });
    labelEls.forEach((entry, id) => { const p = physics.pos.get(id); if (p) entry.group.setAttribute("transform", `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`); });
    edgeUpdaters.forEach(update => update());
    if ((labelCullFrame = (labelCullFrame + 1) % 6) === 0) updateLabelVisibility();
  }
  requestAnimationFrame(tickGraph);
}
function renderGraph() {
  const awaitingAction=currentActionIndex===0,layout=$("#graph-layout"),onboarding=$("#slider-onboarding");layout.classList.toggle("awaiting-action",awaitingAction);onboarding.hidden=!awaitingAction;
  if(awaitingAction){nodeEls=new Map();edgeUpdaters=[];physics.edges=[];graph.replaceChildren();requestAnimationFrame(positionSliderOnboarding);return;}
  const volumeApplied=revealedVolumeActions(),previousApplied=volumeActions().slice(0,Math.max(0,currentActionIndex-1)),currentEvent=currentActionEvent(),appliedNow=appliedEvents(),fullDerived=derive(currentChapter,appliedNow),priorCultivationDerived=currentEvent?.type==="cultivation"?derive(currentChapter,appliedNow.filter(event=>event.id!==currentEvent.id)):null,volumeDerived=derive(currentChapter,volumeApplied),derived={...volumeDerived,states:fullDerived.states,locationParents:fullDerived.locationParents},visibleIds=new Set(volumeApplied.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),previousVisibleIds=new Set(previousApplied.flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean))),chapterChangedIds=new Set(volumeApplied.filter(event=>event.chapter===currentChapter).flatMap(event=>[event.source,event.target,event.location,...(event.characters||[])].filter(Boolean)));
  // A system stands on the graph as soon as the story has touched it, the same as anyone else.
  // What stays folded away until you pick out the system or its host is the rest of its reach:
  // the places it runs at. That is the difference from places, whose links are drawn whenever
  // someone connected to them is on screen.
  const revealedSystems=new Set(),systemSatellites=[],focusSystems=new Set(),autoOpenSystems=new Set();
  const actionSystem=currentEvent&&String(currentEvent.type).startsWith("system_")?[currentEvent.source,currentEvent.target].find(id=>entity(id)?.kind==="system"):null;
  {
    const retired=new Set([...derived.systemMerges.map(link=>link.absorbed),...derived.systemEnds.map(link=>link.system)]),
      queue=[...visibleIds].filter(id=>entity(id)?.kind==="system");
    derived.systemHosts.forEach(link=>{if(visibleIds.has(link.host))queue.push(link.system);});
    if(actionSystem){queue.push(actionSystem);focusSystems.add(actionSystem);}
    if(selectedId){
      // Picking the host is what opens the system out: its subsystems come up as nodes of their
      // own and the places they run at come with them, the way a place opens into its children.
      derived.systemHosts.filter(link=>link.host===selectedId).forEach(link=>{queue.push(link.system);focusSystems.add(link.system);autoOpenSystems.add(link.system);});
      if(entity(selectedId)?.kind==="system"){
        focusSystems.add(selectedId);
        // Selecting a system that was swallowed should still bring up whatever swallowed it, so the
        // marker has something to sit on.
        let cursor=selectedId;const guard=new Set();
        while(cursor&&retired.has(cursor)&&!guard.has(cursor)){guard.add(cursor);cursor=derived.systemMerges.find(link=>link.absorbed===cursor)?.into||derived.systemParents.find(link=>link.child===cursor)?.parent||null;}
        if(cursor&&entity(cursor)?.kind==="system"){queue.push(cursor);focusSystems.add(cursor);}
      }
    }
    while(queue.length){const id=queue.shift();if(!id||revealedSystems.has(id)||entity(id)?.kind!=="system"||(retired.has(id)&&id!==actionSystem))continue;revealedSystems.add(id);
      derived.systemParents.filter(link=>link.parent===id).forEach(link=>{queue.push(link.child);if(focusSystems.has(id))focusSystems.add(link.child);});}
    focusSystems.forEach(id=>{if(revealedSystems.has(id))derived.systemLocations.filter(link=>link.system===id).forEach(link=>visibleIds.add(link.location));});
    // A system that was swallowed or destroyed keeps its history but stops taking up room: it
    // rides whatever succeeded it as a small marker instead of being a node of its own.
    derived.systemMerges.forEach(link=>{
      if(revealedSystems.has(link.into)||selectedId===link.absorbed)
        systemSatellites.push({id:link.absorbed,anchor:link.into,mode:"merged",from:link.from});
    });
    derived.systemEnds.forEach(link=>{
      if(systemSatellites.some(item=>item.id===link.system))return;
      const parent=derived.systemParents.find(edge=>edge.child===link.system)?.parent,
        host=derived.systemHosts.find(edge=>edge.system===link.system)?.host,
        anchor=parent&&revealedSystems.has(parent)?parent:(host&&visibleIds.has(host)?host:null);
      if(anchor)
        systemSatellites.push({id:link.system,anchor,mode:"ended",from:link.from,reason:link.reason});
    });
  }
  // Quests are records rather than actors, so they never become nodes — but who is carrying one
  // is a fact about that character, and the moment one is handed over is worth seeing.
  const questHolders=new Map();
  derived.quests.filter(run=>run.status==="active").forEach(run=>run.holders.forEach(id=>{
    if(!questHolders.has(id))questHolders.set(id,[]);
    questHolders.get(id).push(stateName(derived,run.quest)||entity(run.quest)?.name||run.quest);
  }));
  // Only an issue names who it is going to. Everything after that — progress, completion, a
  // failure — belongs to whoever is already carrying the quest, so the beat is marked on them.
  const questBeat=currentEvent&&String(currentEvent.type).startsWith("quest_")&&currentEvent.type!=="quest_part"
    ?{quest:currentEvent.source,name:entity(currentEvent.source)?.name||"",type:currentEvent.type,action:currentEvent.action||"",
      who:new Set([currentEvent.target,...(currentEvent.characters||[]),
        ...(derived.quests.find(run=>run.quest===currentEvent.source)?.holders||[])].filter(Boolean))}
    :null;
  const locView=buildLocationView(derived,visibleIds);lastLocationView=locView;
  // A system acting this beat has to be on screen for it, even when it normally sits folded
  // inside a bigger one.
  const actionAncestors=new Set();
  if(actionSystem){let cursor=derived.systemParents.find(link=>link.child===actionSystem)?.parent;while(cursor&&!actionAncestors.has(cursor)){actionAncestors.add(cursor);cursor=derived.systemParents.find(link=>link.child===cursor)?.parent;}}
  actionAncestors.forEach(id=>autoOpenSystems.add(id));
  const sysView=buildSystemView(derived,revealedSystems,autoOpenSystems);lastSystemView=sysView;
  [...expandedSystems].forEach(id=>{if(!sysView.expanded.has(id))expandedSystems.delete(id);});
  [...expandedLocations].forEach(id=>{if(!locView.expanded.has(id))expandedLocations.delete(id);});
  if(collapsingLocationId&&!locView.expanded.has(collapsingLocationId))collapsingLocationId=null;
  const renderIds=new Set([...visibleIds].filter(id=>{const kind=entity(id)?.kind;if(kind==="system"||kind==="quest")return false;return kind!=="location"||locView.rendered.has(id);}));
  sysView.rendered.forEach(id=>renderIds.add(id));
  const visible=data.entities.filter(item=>renderIds.has(item.id));
  const resolveLocationId=id=>entity(id)?.kind==="location"?(locView.anchorOf.get(id)||id):id;
  if(selectedId&&!renderIds.has(selectedId)&&!systemSatellites.some(item=>item.id===selectedId))selectedId=null;
  // A place that is folded into its parent, or a system swallowed by another, used to blink out
  // of existence while the new connection appeared somewhere else. Before its position is
  // forgotten, note where it was and what it went into, so it can be seen going there.
  // The pods for this action are worked out the same way the pod pass will work them out, so a
  // place that is about to become one is known before its old position is forgotten.
  const podsComing=new Set(eventPodIds(locView,currentEvent)),departing=[];
  [...physics.pos.keys()].filter(id=>!renderIds.has(id)).forEach(id=>{
    const kind=entity(id)?.kind,
      into=kind==="location"?locView.anchorOf.get(id)
        :kind==="system"?(sysView.anchorOf.get(id)||systemSatellites.find(item=>item.id===id)?.anchor)
        :null;
    if(into&&into!==id&&renderIds.has(into)){
      // If the place is about to be shown as a pod anyway, the pod itself travels from here —
      // one continuous move — instead of a ghost going in and a pod coming straight back out.
      if(kind==="location"&&podsComing.has(id))podOrigins.set(id,{...physics.pos.get(id)});
      else departing.push({id,kind,from:{...physics.pos.get(id)},into,radius:physics.radii.get(id)||20});
    }
    physics.pos.delete(id);physics.vel.delete(id);physics.bounds.delete(id);physics.calm.delete(id);
  });
  visible.forEach((item,index)=>ensurePos(item.id,()=>seedPosition(item,index,visible.length)));
  fitGraphToCount(visible.length);
  const positions=physics.pos;
  const glyphRadius=id=>locView.expanded.has(id)?9:locationGlyphRadius(id,locView),locationDistance=id=>locView.expanded.has(id)?74:glyphRadius(id)+58;
  physics.bounds.clear();physics.radii.clear();
  visible.forEach(item=>physics.radii.set(item.id,nodeRadiusFor(item,derived.states.get(item.id),locView,currentChapter,sysView)));
  // A spring shorter than the two nodes need to sit apart fights the separation force forever,
  // which is what made the whole graph shiver. Every rest length clears both shapes.
  const restLength=(a,b,desired)=>Math.max(desired,(physics.radii.get(a)||24)+(physics.radii.get(b)||24)+SEPARATION_GAP+8);
  const springs=new Map(),addSpring=(a,b,desired,strength)=>{if(!a||!b||a===b||!renderIds.has(a)||!renderIds.has(b))return;const length=restLength(a,b,desired),key=a<b?`${a}|${b}`:`${b}|${a}`,existing=springs.get(key);if(existing){existing.length=Math.min(existing.length,length);existing.strength=Math.max(existing.strength,strength);return;}springs.set(key,{a,b,length,strength});};
  // Everything that orbits a hub — members of an organisation, everyone standing in a place, the
  // children of an opened place — is collected first so the ring can be widened to fit the crowd.
  // Eighteen people cannot all sit 90 units from one place: they end up pressed together, and the
  // contact solver shoves them apart again every frame, which never stops moving.
  const hubLinks=[],hubMembers=new Map();
  const queueHubLink=(member,hub,desired,strength)=>{
    if(!member||!hub||member===hub||!renderIds.has(member)||!renderIds.has(hub))return;
    hubLinks.push({member,hub,desired,strength});
    if(!hubMembers.has(hub))hubMembers.set(hub,new Set());
    hubMembers.get(hub).add(member);
  };
  derived.memberships.forEach(m=>queueHubLink(m.character,m.organization,105,.022));
  derived.organizationLocations.forEach(link=>queueHubLink(link.organization,resolveLocationId(link.location),locationDistance(resolveLocationId(link.location)),.032));
  derived.residences.forEach(link=>queueHubLink(link.character,resolveLocationId(link.location),locationDistance(resolveLocationId(link.location)),.04));
  [...derived.locations.values()].forEach(visit=>queueHubLink(visit.character,resolveLocationId(visit.location),locationDistance(resolveLocationId(visit.location)),.047));
  locView.rendered.forEach(id=>{if(!locView.expanded.has(id))return;(locView.children.get(id)||[]).forEach(kid=>queueHubLink(kid,id,86+glyphRadius(kid),.14));});
  const hubRing=new Map();
  hubMembers.forEach((members,hub)=>{
    if(members.size<2)return hubRing.set(hub,0);
    let circumference=0;members.forEach(id=>{circumference+=2*(physics.radii.get(id)||24)+SEPARATION_GAP;});
    hubRing.set(hub,circumference/(2*Math.PI));
  });
  hubLinks.forEach(link=>addSpring(link.member,link.hub,Math.max(link.desired,hubRing.get(link.hub)||0),link.strength));
  derived.systemHosts.forEach(link=>addSpring(link.system,link.host,120,.05));
  derived.systemLocations.forEach(link=>{if(focusSystems.has(link.system))addSpring(link.system,resolveLocationId(link.location),120,.03);});
  sysView.rendered.forEach(id=>{if(!sysView.expanded.has(id))return;(sysView.children.get(id)||[]).forEach(kid=>addSpring(kid,id,104,.12));});
  derived.identityParents.forEach(link=>addSpring(link.child,link.parent,68,.09));
  [...derived.relations.keys(),...derived.awareness.keys()].forEach(key=>{const [a,b]=key.split("|");addSpring(a,b,150,.02);});
  physics.edges=[...springs.values()];
  nodeEls=new Map(); labelEls=new Map(); edgeUpdaters=[]; hoverId=null; departingGhosts=[]; questPulses=[]; physics.alpha=1;
  physics.degree.clear();physics.edges.forEach(edge=>{physics.degree.set(edge.a,(physics.degree.get(edge.a)||0)+1);physics.degree.set(edge.b,(physics.degree.get(edge.b)||0)+1);});
  graph.replaceChildren(); const defs=svgEl("defs"); Object.entries(COLORS).forEach(([type,color])=>{const marker=svgEl("marker",{id:`arrow-${type}`,viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:6,markerHeight:6,orient:"auto-start-reverse"});marker.appendChild(svgEl("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:color}));defs.appendChild(marker);});graph.appendChild(defs);
  viewportGroup=svgEl("g",{class:`graph-viewport${currentEvent?" has-action-focus":""}${selectedId?" has-selection-focus":""}`});
  const edgeLayer=svgEl("g"),departLayer=svgEl("g",{class:"node-depart-layer"}),satelliteLayer=svgEl("g",{class:"system-satellite-layer"}),conversationLayer=svgEl("g",{class:"conversation-layer"}),nodeLayer=svgEl("g"),labelLayer=svgEl("g",{class:"node-label-layer"}),podLayer=svgEl("g",{class:"location-pod-layer"});viewportGroup.append(edgeLayer,departLayer,nodeLayer,satelliteLayer,conversationLayer,labelLayer,podLayer);graph.appendChild(viewportGroup);applyViewTransform();
  // While an action pops a hidden place out of its parent, links point at the pod itself, so the
  // line sits on the place the reader is actually being shown and rides back in as it retracts.
  const podIds=syncPodTransitions(locView,currentEvent),podSet=new Set([...podIds,...retiringPodIds]);
  physics.podPos.clear();
  podSet.forEach(id=>{const base=positions.get(locView.anchorOf.get(id));if(base)physics.podPos.set(id,{x:base.x,y:base.y});});
  const edgeLocationId=id=>entity(id)?.kind!=="location"?id:(podSet.has(id)?id:(locView.anchorOf.get(id)||id));
  edgeIndex=[];
  const noteEdge=(a,b,chapter,note)=>{if(a&&b&&a!==b&&chapter)edgeIndex.push({a,b,chapter:Number(chapter),note});};
  const straightEdge=(a,b,className,dataA,dataB)=>{if(!a||!b||a===b)return null;const aPos=pointFor(a),bPos=pointFor(b);if(!aPos||!bPos)return null;const muted=locView.expanded.has(a)||locView.expanded.has(b),element=svgEl("line",{x1:aPos.x,y1:aPos.y,x2:bPos.x,y2:bPos.y,class:`${className}${muted?" opened-location-edge":""}`,"data-a":dataA,"data-b":dataB});edgeLayer.appendChild(element);edgeUpdaters.push(()=>{const p1=pointFor(a),p2=pointFor(b);if(!p1||!p2)return;element.setAttribute("x1",p1.x);element.setAttribute("y1",p1.y);element.setAttribute("x2",p2.x);element.setAttribute("y2",p2.y);});return element;};
  const pairKeys=new Set([...derived.relations.keys(),...derived.awareness.keys()]);
  pairKeys.forEach((key,index)=>{const [aId,bId]=key.split("|"),aPos=positions.get(aId),bPos=positions.get(bId);if(!aPos||!bPos)return;const history=derived.relations.get(key)||[],met=derived.meetings.get(key),aware=derived.awareness.get(key),type=history.length?String(history.at(-1).value).toLowerCase():"neutral";let element;
    const newPair=Boolean(currentEvent&&["awareness","relationship"].includes(currentEvent.type)&&pairKey(currentEvent.source,currentEvent.target)===key),edgeClass=`edge relation-edge${newPair?" newly-revealed-edge":""}`;
    if(aware&&!met){const ar=radius(derived.states.get(aId))+12,br=radius(derived.states.get(bId))+12,grad=createGradient(defs,`grad-a-${index}`,history,currentChapter),curve=(p1,p2)=>{const dx=p2.x-p1.x,dy=p2.y-p1.y,d=Math.max(1,Math.hypot(dx,dy)),x1=p1.x+dx/d*ar,y1=p1.y+dy/d*ar,x2=p2.x-dx/d*br,y2=p2.y-dy/d*br,cx=(x1+x2)/2-dy/d*16,cy=(y1+y2)/2+dx/d*16;return {x1,y1,x2,y2,cx,cy};},start=curve(aPos,bPos);
      element=svgEl("path",{d:`M ${start.x1} ${start.y1} Q ${start.cx} ${start.cy} ${start.x2} ${start.y2}`,class:edgeClass,stroke:grad.url,"data-a":aId,"data-b":bId});if(aware.aToB)element.setAttribute("marker-end",`url(#arrow-${type in COLORS?type:"neutral"})`);if(aware.bToA)element.setAttribute("marker-start",`url(#arrow-${type in COLORS?type:"neutral"})`);
      edgeUpdaters.push(()=>{const p1=positions.get(aId),p2=positions.get(bId);if(!p1||!p2)return;const c=curve(p1,p2);element.setAttribute("d",`M ${c.x1} ${c.y1} Q ${c.cx} ${c.cy} ${c.x2} ${c.y2}`);if(grad.el){grad.el.setAttribute("x1",c.x1);grad.el.setAttribute("y1",c.y1);grad.el.setAttribute("x2",c.x2);grad.el.setAttribute("y2",c.y2);}});
    } else if(history.length){const grad=createGradient(defs,`grad-r-${index}`,history,currentChapter);element=svgEl("line",{x1:aPos.x,y1:aPos.y,x2:bPos.x,y2:bPos.y,class:edgeClass,stroke:grad.url,"data-a":aId,"data-b":bId});
      edgeUpdaters.push(()=>{const p1=positions.get(aId),p2=positions.get(bId);if(!p1||!p2)return;element.setAttribute("x1",p1.x);element.setAttribute("y1",p1.y);element.setAttribute("x2",p2.x);element.setAttribute("y2",p2.y);if(grad.el){grad.el.setAttribute("x1",p1.x);grad.el.setAttribute("y1",p1.y);grad.el.setAttribute("x2",p2.x);grad.el.setAttribute("y2",p2.y);}});
    }
    const lastRelation=history.at(-1);
    noteEdge(aId,bId,lastRelation?.chapter??met?.chapter??aware?.from,lastRelation?`Relationship became ${String(lastRelation.value).toLowerCase()}`:met?"Met":"Became aware of each other");
    if(element)edgeLayer.appendChild(element);
  });
  derived.memberships.forEach(m=>{noteEdge(m.character,m.organization,m.from,`${m.role}`);return straightEdge(m.character,m.organization,`edge membership-edge${currentEvent?.type==="membership"&&currentEvent.source===m.character&&currentEvent.target===m.organization?" newly-revealed-edge":""}`,m.character,m.organization);});
  // Location links are re-pointed at the deepest place the reader can currently see, so a
  // collapsed realm inherits every connection of the places folded inside it.
  const locationEdgeSeen=new Set(),locationEdge=(from,to,baseClass,active,chapter,note)=>{const target=edgeLocationId(to);if(!target||from===target)return;noteEdge(from,target,chapter,note);const key=`${baseClass}|${from}|${target}`;if(locationEdgeSeen.has(key)&&!active)return;locationEdgeSeen.add(key);straightEdge(from,target,`edge ${baseClass}${active?" newly-revealed-edge":""}`,from,target);};
  derived.organizationLocations.forEach(link=>locationEdge(link.organization,link.location,"organization-location-edge",currentEvent?.type==="organization_location"&&currentEvent.source===link.organization&&currentEvent.location===link.location,link.from,`${link.role} based here`));
  derived.residences.forEach(link=>locationEdge(link.character,link.location,"residence-edge",currentEvent?.type==="residency"&&currentEvent.source===link.character&&currentEvent.location===link.location,link.from,`${link.role} here`));
  derived.locations.forEach((visit,character)=>locationEdge(character,visit.location,"location-edge",currentEvent?.type==="movement"&&currentEvent.source===character&&currentEvent.location===visit.location,visit.chapter,"Travelled here"));
  derived.locationParents.forEach(link=>{const child=edgeLocationId(link.child),parent=edgeLocationId(link.parent);if(!child||!parent||child===parent)return;noteEdge(child,parent,link.from,"Sits inside");straightEdge(child,parent,`edge hierarchy-edge${currentEvent?.type==="location_parent"&&currentEvent.source===link.child&&currentEvent.location===link.parent?" newly-revealed-edge":""}`,child,parent);});
  // A conversation is one thing that happened between several people, so three or more of them
  // meet at a marker joined to each — six lines between four people says nothing about them
  // being in the same room. It shows while its action plays, and whenever anyone who was in it
  // is selected, so it can still be found once the slider has moved on.
  physics.hubPos.clear();
  derived.conversations.filter(convo=>currentEvent?.id===convo.id||(selectedId&&convo.talkers.includes(selectedId))).forEach(convo=>{
    const talkers=convo.talkers.filter(id=>renderIds.has(id));if(talkers.length<2)return;
    const live=currentEvent?.id===convo.id,edgeClass=`edge conversation-edge${live?" newly-revealed-edge":""}`;
    if(talkers.length===2){noteEdge(talkers[0],talkers[1],convo.chapter,"In conversation");straightEdge(talkers[0],talkers[1],edgeClass,talkers[0],talkers[1]);return;}
    const hubId=`conversation:${convo.id}`,centre=()=>{const points=talkers.map(pointFor).filter(Boolean);return points.length?{x:points.reduce((sum,point)=>sum+point.x,0)/points.length,y:points.reduce((sum,point)=>sum+point.y,0)/points.length}:null;};
    const start=centre();if(!start)return;
    physics.hubPos.set(hubId,start);
    const hub=svgEl("g",{class:`conversation-hub${live?" conversation-hub-live":""}`,"data-id":hubId});
    hub.append(svgEl("circle",{cx:0,cy:0,r:14,class:"conversation-hub-ring"}));
    const count=svgEl("text",{x:0,y:3.8,class:"conversation-hub-count"});count.textContent=String(talkers.length);hub.appendChild(count);
    conversationLayer.appendChild(hub);
    const place=()=>{const point=centre();if(!point)return;physics.hubPos.set(hubId,point);hub.setAttribute("transform",`translate(${point.x.toFixed(2)},${point.y.toFixed(2)})`);};
    place();edgeUpdaters.push(place);
    talkers.forEach(id=>{noteEdge(id,hubId,convo.chapter,convo.description||"In this conversation");straightEdge(id,hubId,edgeClass,id,hubId);});
  });
  // Plenty of actions name a place without being a movement — a meeting, a fight, a note. While
  // such an action is showing, tie everyone it involves to the place it names.
  if(currentEvent?.location&&entity(currentEvent.location)?.kind==="location"&&!["movement","residency","organization_location","location_parent"].includes(currentEvent.type)){
    const place=edgeLocationId(currentEvent.location);
    locationCharacterIds(currentEvent).forEach(who=>{noteEdge(who,place,currentEvent.chapter,"Here for this action");straightEdge(who,place,"edge location-edge event-place-edge newly-revealed-edge",who,place);});
  }
  // On the beat a quest is handed over, draw the handing over: from whoever issued it to whoever
  // took it. It lasts only for that action, like the quest notice itself.
  if(questBeat&&questBeat.type==="quest_issue"&&questBeat.action!=="withdraw"){
    const issuer=entity(questBeat.quest)?.issuer;
    if(issuer)questBeat.who.forEach(holder=>{
      if(!positions.get(issuer)||!positions.get(holder))return;
      straightEdge(issuer,holder,"edge quest-issue-edge newly-revealed-edge",issuer,holder);
      // A mote runs down the line from the system that set the quest to whoever took it, so the
      // issuing is something seen happening rather than a mark left behind.
      const pulse=svgEl("g",{class:"quest-pulse","aria-hidden":"true"});
      pulse.append(svgEl("circle",{cx:0,cy:0,r:7,class:"quest-pulse-halo"}),svgEl("circle",{cx:0,cy:0,r:3.4,class:"quest-pulse-core"}));
      conversationLayer.appendChild(pulse);
      questPulses.push({el:pulse,from:issuer,to:holder,start:performance.now(),duration:820});
    });
  }
  derived.systemHosts.forEach(link=>{noteEdge(link.system,link.host,link.from,`${link.role} of this system`);straightEdge(link.system,link.host,`edge system-host-edge${currentEvent?.type==="system_host"&&currentEvent.source===link.system&&currentEvent.target===link.host?" newly-revealed-edge":""}`,link.system,link.host);});
  derived.systemLocations.forEach(link=>{if(!focusSystems.has(link.system))return;const place=edgeLocationId(link.location);noteEdge(link.system,place,link.from,`${link.role} here`);straightEdge(link.system,place,`edge system-location-edge${currentEvent?.type==="system_location"&&currentEvent.source===link.system&&currentEvent.location===link.location?" newly-revealed-edge":""}`,link.system,place);});
  derived.systemParents.forEach(link=>{noteEdge(link.child,link.parent,link.from,"Subsystem of");straightEdge(link.child,link.parent,`edge system-parent-edge${currentEvent?.type==="system_parent"&&currentEvent.source===link.child&&currentEvent.target===link.parent?" newly-revealed-edge":""}`,link.child,link.parent);});
  derived.identityParents.forEach(link=>{noteEdge(link.child,link.parent,link.from,link.relation);return straightEdge(link.child,link.parent,`edge identity-edge${currentEvent?.type==="identity_parent"&&currentEvent.source===link.child&&currentEvent.target===link.parent?" newly-revealed-edge":""}`,link.child,link.parent);});
  const activeIds=new Set(currentEvent?[currentEvent.source,currentEvent.target,currentEvent.location,...(currentEvent.characters||[])].filter(Boolean).map(edgeLocationId):[]);
  const retractingIds=collapsingLocationId?new Set([...renderedSubtree(collapsingLocationId,locView)]):new Set();
  visible.forEach(item=>{const state=derived.states.get(item.id),shownName=state.displayName||item.name,pos=positions.get(item.id),mentionedOnly=item.kind==="character"&&state.mentioned!==null&&(state.appeared===null||state.appeared>currentChapter),newlyRevealed=!previousVisibleIds.has(item.id),eventActive=activeIds.has(item.id),chapterChanged=chapterChangedIds.has(item.id),cultivationReveal=currentEvent?.type==="cultivation"&&currentEvent.source===item.id,priorCultivationState=cultivationReveal?priorCultivationDerived?.states.get(item.id):null,priorCultivationLevel=cultivationReveal?(priorCultivationState?.level||0):(state.level||0),openedLocation=(item.kind==="location"&&locView.expanded.has(item.id))||(item.kind==="system"&&sysView.expanded.has(item.id)),emerging=(item.kind==="location"||item.kind==="system")&&emergingLocations.has(item.id),retracting=retractingIds.has(item.id)||item.id===collapsingLocationId,group=svgEl("g",{class:`node ${item.kind}${item.kind==="system"&&isSpecialGrade(state.grade)?` system-${String(state.grade).trim().toLowerCase()}`:""}${mentionedOnly?" mentioned-only":""}${newlyRevealed?" newly-revealed-node":""}${chapterChanged?" chapter-changed-node":""}${eventActive?" event-active-node":""}${cultivationReveal?" cultivation-reveal":""}${openedLocation?" location-opened":""}${emerging?" location-emerging":""}${retracting?" location-retracting":""}`,"data-id":item.id,role:"button",tabindex:0,"aria-label":mentionedOnly?`${shownName}, mentioned but not appeared`:shownName,transform:`translate(${pos.x},${pos.y})`});let labelY=item.kind==="character"?5:58,locationShell=null,rankLabel=null,questNotice=null;
    if(item.kind==="organization"){const points=Array.from({length:6},(_,i)=>{const angle=Math.PI/3*i-Math.PI/6;return `${39*Math.cos(angle)},${39*Math.sin(angle)}`}).join(" ");group.append(svgEl("circle",{cx:0,cy:0,r:46,class:"node-hit-target"}),svgEl("polygon",{points,class:"org-shape"}));
    }else if(item.kind==="system"){const opened=sysView.expanded.has(item.id),childCount=(sysView.children.get(item.id)||[]).length,r=systemGlyphRadius(state),
        rankMoved=currentEvent?.type==="system_rank"&&currentEvent.source===item.id;
      group.appendChild(svgEl("circle",{cx:0,cy:0,r:46,class:"node-hit-target"}));
      locationShell=svgEl("g",{class:"location-shell"});
      if(opened){labelY=-28;locationShell.append(svgEl("circle",{cx:0,cy:0,r:18,class:"system-open-halo"}),svgEl("circle",{cx:0,cy:0,r:6.5,class:"system-open-dot"}));
      }else{labelY=-r-14;
        const points=(size,rot=0)=>Array.from({length:4},(_,i)=>{const angle=Math.PI/2*i+rot;return `${size*Math.cos(angle)},${size*Math.sin(angle)}`}).join(" ");
        locationShell.append(svgEl("polygon",{points:points(r),class:"system-shape"}),svgEl("polygon",{points:points(r*.62),class:"system-shape-inner"}));
        // A grade is one to three characters, which is exactly what fits in the middle of the
        // diamond; the named grades get their own colour instead of a letter treatment.
        if(state.grade){const grade=svgEl("text",{x:0,y:isSpecialGrade(state.grade)?3:5,class:`system-grade${isSpecialGrade(state.grade)?` system-grade-special grade-len-${String(state.grade).trim().length}`:""}`});grade.textContent=String(state.grade).trim().toUpperCase();locationShell.appendChild(grade);}
        else locationShell.appendChild(svgEl("circle",{cx:0,cy:0,r:r*.17,class:"system-core"}));
        // The number gets its own pip under the diamond; the two move independently.
        if(Number.isFinite(Number(state.authority))){locationShell.append(svgEl("circle",{cx:0,cy:r-2,r:10,class:"system-authority-pip"}));const authority=svgEl("text",{x:0,y:r+1.6,class:"system-authority-text"});authority.textContent=String(state.authority);locationShell.appendChild(authority);}
        if(rankMoved){
          locationShell.appendChild(svgEl("polygon",{points:points(r+9),class:"system-rank-pulse"}));
          const moves=[];
          if(String(state.previousGrade??"")!==String(state.grade??""))moves.push(`${rankWord(state.previousGrade)} → ${rankWord(state.grade)}`);
          if(String(state.previousAuthority??"")!==String(state.authority??""))moves.push(`authority ${rankWord(state.previousAuthority)} → ${rankWord(state.authority)}`);
          // Losing a number counts as falling, the same as a smaller one would.
          const before=Number(state.previousAuthority),now=Number(state.authority),
            fell=Number.isFinite(before)&&(!Number.isFinite(now)||now<before);
          // The movement is written under the diamond, clear of the system's own name above it,
          // and it goes in the label layer so no other node can be drawn over it.
          if(moves.length)rankLabel={text:moves.join(" · "),y:r+(Number.isFinite(now)?26:19),tone:fell?"rank-fell":"rank-rose"};
        }
        if(childCount){locationShell.append(svgEl("circle",{cx:r-6,cy:-r+6,r:9.5,class:"system-child-badge"}));const badge=svgEl("text",{x:r-6,y:-r+9.4,class:"location-child-badge-text system-child-badge-text"});badge.textContent=String(childCount);locationShell.appendChild(badge);}
      }
      group.appendChild(locationShell);
    }else if(item.kind==="location"){const r=locationGlyphRadius(item.id,locView),childCount=(locView.children.get(item.id)||[]).length;group.appendChild(svgEl("circle",{cx:0,cy:0,r:Math.max(38,r+16),class:"node-hit-target"}));
      locationShell=svgEl("g",{class:"location-shell"});
      if(openedLocation){labelY=-26;locationShell.append(svgEl("circle",{cx:0,cy:0,r:17,class:"location-open-halo"}),svgEl("circle",{cx:0,cy:0,r:6.5,class:"location-open-dot"}));group.setAttribute("aria-label",`${shownName}, opened — ${childCount} place${childCount===1?"":"s"} shown, activate to close`);
      }else{labelY=-r-13;locationShell.append(svgEl("path",{d:roundedSquarePath(r,r*.42),class:"location-glyph"}),svgEl("path",{d:roundedSquarePath(r*.44,r*.22),class:"location-glyph-core"}));
        if(childCount){locationShell.append(svgEl("circle",{cx:r-1,cy:-r+1,r:9.5,class:"location-child-badge"}));const badge=svgEl("text",{x:r-1,y:-r+4.4,class:"location-child-badge-text"});badge.textContent=String(childCount);locationShell.appendChild(badge);group.setAttribute("aria-label",`${shownName}, contains ${childCount} place${childCount===1?"":"s"}`);}
      }
      group.appendChild(locationShell);
    }else{const appeared=state.appeared!==null&&state.appeared<=currentChapter,r=appeared?radius(state):20;group.appendChild(svgEl("circle",{cx:0,cy:0,r:Math.max(44,r+22),class:"node-hit-target"}));
      // What this character is carrying, and — for one beat — what just changed hands.
      const held=questHolders.get(item.id)||[];
      if(questBeat?.who.has(item.id)){
        const settled=questBeat.type==="quest_end",
          outcome=questBeat.action==="fail"?"failed":questBeat.action==="abandon"?"abandoned":questBeat.action==="reopen"?"reopened":"complete";
        questNotice={y:r+27,tone:settled?(outcome==="failed"?"quest-failed":outcome==="complete"?"quest-done":"quest-taken"):"quest-taken",
          text:questBeat.type==="quest_issue"?(questBeat.action==="withdraw"?`✕ ${questBeat.name}`:`⊕ ${questBeat.name}`)
            :settled?`${outcome==="failed"?"✕":outcome==="complete"?"✓":"⟲"} ${questBeat.name}`
            :`· ${questBeat.name}`};
      }if(!appeared){group.append(svgEl("circle",{cx:0,cy:0,r:r+7,class:"ghost-ring"}),svgEl("circle",{cx:0,cy:0,r,class:`ghost-core ${state.gender==="female"?"core-female":"core-male"}`}));}else{const lifeClass=state.status==="dead"?"life-dead":state.status==="alive"?"life-alive":"life-unknown";group.append(svgEl("circle",{cx:0,cy:0,r:r+7,class:lifeClass}),svgEl("circle",{cx:0,cy:0,r,class:state.gender==="female"?"core-female":"core-male"}));if(cultivationReveal)group.appendChild(svgEl("circle",{cx:0,cy:0,r:r+11,class:"cultivation-reveal-pulse"}));const ladder=trackLevels(state.track),segmentAngle=360/ladder.length;for(let seg=0;seg<ladder.length;seg++){const start=-88+seg*segmentAngle,isOn=state.level>seg,wasOn=priorCultivationLevel>seg,isChanged=cultivationReveal&&isOn!==wasOn,isGain=isChanged&&isOn;group.appendChild(svgEl("path",{d:arcPath(0,0,r+(isChanged?21:15),start,start+segmentAngle*.76),class:`${isOn?"corona-on":"corona-off"}${isChanged?` cultivation-change-segment ${isGain?"cultivation-gain":"cultivation-loss"}`:""}`,...(isChanged?{pathLength:1,style:`--cultivation-delay:${Math.abs(seg-priorCultivationLevel)*55}ms`}:{})}));}if(cultivationReveal){const before=priorCultivationLevel?(priorCultivationState?.realm||priorCultivationState?.canonicalRealm||trackLevels(state.track)[priorCultivationLevel-1]):"Unrevealed",after=state.realm||state.canonicalRealm,changeLabel=svgEl("text",{x:0,y:-r-35,class:"cultivation-change-label"});changeLabel.textContent=currentEvent.initial===true&&!priorCultivationLevel?`Cultivation revealed: ${after}`:before===after?after:`${before} → ${after}`;group.appendChild(changeLabel);}const gems=Math.min(7,state.aliases.length),gemR=r+27;for(let i=0;i<gems;i++){const angle=Math.PI+(i+1)*Math.PI/(gems+1);group.appendChild(svgEl("polygon",{points:diamondPoints(Math.cos(angle)*gemR,Math.sin(angle)*gemR,4),class:"alias-gem"}));}}}
    // Labels live in their own layer above every shape, so a node can never be drawn over
    // another node's name, and so they can be culled independently when the graph gets dense.
    const labelGroup=svgEl("g",{class:`${group.getAttribute("class")} node-labels`,"data-id":item.id}),label=svgEl("text",{x:0,y:labelY,class:`node-label${item.kind==="location"?" location-region-label":""}`});label.textContent=shownName;labelGroup.appendChild(label);
    if(item.kind==="location"||item.kind==="system"){const tier=svgEl("text",{x:0,y:labelY-13,class:`location-tier-label${item.kind==="system"?" system-tier-label":""}`});tier.textContent=item.kind==="system"?"SYSTEM":String(item.locationType||"Place").toUpperCase();labelGroup.appendChild(tier);}
    if(rankLabel){const moved=svgEl("text",{x:0,y:rankLabel.y,class:`system-rank-label ${rankLabel.tone}`});moved.textContent=rankLabel.text;labelGroup.appendChild(moved);}
    if(questNotice){const notice=svgEl("text",{x:0,y:questNotice.y,class:`quest-notice ${questNotice.tone}`});notice.textContent=questNotice.text;labelGroup.appendChild(notice);}
    if(item.kind==="character"){
      // How many quests someone is carrying is worth knowing, but not worth painting on every
      // character for ever — with a dozen quests running that is all the graph becomes. It shows
      // on the one being looked at, and the tab carries the running total.
      const held=questHolders.get(item.id)||[];
      if(held.length&&selectedId===item.id){const r=state.appeared!==null&&state.appeared<=currentChapter?radius(state):20,
          x=r*.74,y=r*.74,mark=svgEl("g",{class:`quest-held${questBeat?.who.has(item.id)?" quest-held-active":""}`});
        mark.append(svgEl("circle",{cx:x,cy:y,r:9.5,class:"quest-held-pip"}));
        const count=svgEl("text",{x,y:y+3.4,class:"quest-held-count"});count.textContent=String(held.length);
        mark.appendChild(count);
        const hint=svgEl("title");hint.textContent=held.length===1?held[0]:`${held.length} quests: ${held.join(", ")}`;mark.appendChild(hint);
        group.appendChild(mark);}
    }
    if(mentionedOnly){const stateLabel=svgEl("text",{x:0,y:39,class:"node-state-label"});stateLabel.textContent="MENTIONED";labelGroup.appendChild(stateLabel);}
    labelLayer.appendChild(labelGroup);labelEls.set(item.id,{group:labelGroup,text:label,offset:labelY,kind:item.kind,tall:Boolean(rankLabel||questNotice),halfWidth:Math.min(150,Math.max(28,String(shownName).length*4.2)),halfHeight:9});
    const selectNode=()=>{cancelChapterSequence();if(item.kind==="location"){activateLocation(item.id);return;}if(item.kind==="system"){activateSystem(item.id);return;}locationPovId=null;selectedId=selectedId===item.id?null:item.id;setMobilePanel("info");renderAll();};
    // A character's name is drawn across the middle of its circle and lives in the layer above,
    // so the same gestures have to work from the label as from the shape — otherwise a press in
    // the middle of a node lands on the text and only the outer ring can start a drag.
    const bindGestures=target=>{
      target.addEventListener("pointerdown",event=>{if(event.button!==undefined&&event.button!==0)return;event.stopPropagation();physics.dragId=item.id;dragMoved=false;dragStartClient={x:event.clientX,y:event.clientY};const c=toContentPoint(event.clientX,event.clientY),p=positions.get(item.id);dragOffset={x:p.x-c.x,y:p.y-c.y};physics.vel.set(item.id,{x:0,y:0});group.classList.add("dragging");target.setPointerCapture(event.pointerId);});
      target.addEventListener("pointermove",event=>{if(physics.dragId!==item.id)return;const c=toContentPoint(event.clientX,event.clientY),p=positions.get(item.id);p.x=c.x+dragOffset.x;p.y=c.y+dragOffset.y;if(!dragMoved&&Math.hypot(event.clientX-dragStartClient.x,event.clientY-dragStartClient.y)>4)dragMoved=true;});
      const endDrag=event=>{if(physics.dragId!==item.id)return;physics.dragId=null;group.classList.remove("dragging");if(event.type==="pointerup"){if(dragMoved){const p=physics.pos.get(item.id);if(p)p.pinned=true;}else selectNode();}};
      target.addEventListener("pointerup",endDrag);target.addEventListener("pointercancel",endDrag);
      target.addEventListener("dblclick",event=>{event.stopPropagation();const p=physics.pos.get(item.id);if(p?.pinned){p.pinned=false;toast(`${item.name} released back into the layout`);}openProfile(item.id);});
      target.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();selectNode();});
      target.addEventListener("pointerenter",()=>setHoverNode(item.id));
      target.addEventListener("pointerleave",()=>setHoverNode(null));
    };
    bindGestures(group);bindGestures(labelGroup);
    nodeLayer.appendChild(group);nodeEls.set(item.id,group);
  });
  // Measure the names once they are all in the document. Guessing width from character count
  // under-read real text by about a third, which left the separation forces satisfied while
  // names still overlapped on screen. One pass after the loop keeps the layout thrash to one.
  // A system announcing a rank change reserves the whole strip — name above, movement below —
  // so nothing else is placed across it for that beat.
  labelEls.forEach((entry,id)=>{const box=(entry.tall?entry.group:entry.text).getBBox();if(!box.width)return;entry.halfWidth=box.width/2;entry.halfHeight=box.height/2;entry.offset=box.y+box.height/2;entry.box={ox:box.x+box.width/2,oy:entry.offset,hw:entry.halfWidth,hh:entry.halfHeight};physics.bounds.set(id,entry.box);});
  // Small, name-free markers unless the system they belong to is the one selected — a swallowed
  // system should be findable without competing with the systems still running.
  systemSatellites.forEach((satellite,index)=>{
    const anchorPoint=positions.get(satellite.anchor);if(!anchorPoint)return;
    const item=entity(satellite.id);if(!item)return;
    const named=selectedId===satellite.anchor||selectedId===satellite.id||sysView.expanded.has(satellite.anchor),
      angle=-Math.PI/2+(index-(systemSatellites.length-1)/2)*.5,distance=58,
      group=svgEl("g",{class:`system-satellite system-satellite-${satellite.mode}${selectedId===satellite.id?" satellite-selected":""}`,"data-id":satellite.id,role:"button",tabindex:0,"aria-label":`${item.name}, ${satellite.mode==="merged"?"merged away":"destroyed"} — open its history`});
    group.append(svgEl("circle",{cx:0,cy:0,r:13,class:"system-satellite-hit"}),svgEl("circle",{cx:0,cy:0,r:6,class:"system-satellite-mark"}));
    if(satellite.mode==="ended")group.append(svgEl("path",{d:"M -3.4 -3.4 L 3.4 3.4 M 3.4 -3.4 L -3.4 3.4",class:"system-satellite-cross"}));
    if(named){const label=svgEl("text",{x:0,y:-13,class:"system-satellite-label"});label.textContent=item.name;group.appendChild(label);}
    satelliteLayer.appendChild(group);
    const place=()=>{const base=positions.get(satellite.anchor);if(!base)return;const x=base.x+Math.cos(angle)*distance,y=base.y+Math.sin(angle)*distance;physics.hubPos.set(satellite.id,{x,y});group.setAttribute("transform",`translate(${x.toFixed(2)},${y.toFixed(2)})`);};
    place();edgeUpdaters.push(place);
    const open=()=>{cancelChapterSequence();selectedId=selectedId===satellite.id?satellite.anchor:satellite.id;setMobilePanel("info");renderAll();};
    group.addEventListener("pointerup",event=>{event.stopPropagation();open();});
    group.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();open();});
    noteEdge(satellite.id,satellite.anchor,satellite.from,satellite.mode==="merged"?"Merged into this system":satellite.reason||"Destroyed");
    straightEdge(satellite.id,satellite.anchor,`edge system-satellite-edge`,satellite.id,satellite.anchor);
  });
  renderLocationPods(locView,currentEvent,positions,podLayer,glyphRadius,podOrigins);
  podOrigins=new Map();
  // Draw each departing node where it last stood, then let it travel into whatever took it in.
  departing.forEach(item=>{
    if(!positions.get(item.into))return;
    // The ghost is the node's own glyph, not a stand-in, so what travels is recognisably the
    // place or system that was standing there a moment ago.
    const ghost=svgEl("g",{class:`node-departing depart-${item.kind}`,"aria-hidden":"true"}),
      state=derived.states.get(item.id),
      radius=item.kind==="system"?systemGlyphRadius(state):locationGlyphRadius(item.id,locView),
      name=state?.displayName||entity(item.id)?.name||"";
    if(item.kind==="system")ghost.append(
      svgEl("polygon",{points:Array.from({length:4},(_,i)=>{const angle=Math.PI/2*i;return `${radius*Math.cos(angle)},${radius*Math.sin(angle)}`}).join(" "),class:"system-shape"}),
      svgEl("polygon",{points:Array.from({length:4},(_,i)=>{const angle=Math.PI/2*i;return `${radius*.62*Math.cos(angle)},${radius*.62*Math.sin(angle)}`}).join(" "),class:"system-shape-inner"}));
    else ghost.append(
      svgEl("path",{d:roundedSquarePath(radius,radius*.42),class:"location-glyph"}),
      svgEl("path",{d:roundedSquarePath(radius*.44,radius*.22),class:"location-glyph-core"}));
    if(name){const label=svgEl("text",{x:0,y:-radius-11,class:"depart-label"});label.textContent=name;ghost.appendChild(label);}
    ghost.style.transform=`translate(${item.from.x}px,${item.from.y}px)`;
    departLayer.appendChild(ghost);
    departingGhosts.push({el:ghost,from:item.from,into:item.into,start:performance.now(),duration:640});
  });
  applyGraphFocus(derived);
  updateLabelVisibility();
}

// A location that is folded away inside a collapsed parent still deserves a moment on
// screen when an action names it: it swells out of its visible ancestor as a round pod,
// then sinks back into that ancestor once the action moves on.
function eventPodIds(view,currentEvent){
  const named=currentEvent?[currentEvent.location,currentEvent.type==="location_parent"?currentEvent.source:null].filter(Boolean).filter(id=>entity(id)?.kind==="location"):[];
  return [...new Set(named)].filter(id=>view.present.has(id)&&!view.rendered.has(id)&&view.anchorOf.get(id));
}
// Decide which pods are coming out and which are sinking back BEFORE the links are drawn, so a
// link to a retracting pod stays attached and rides it home instead of snapping to the parent.
function syncPodTransitions(view,currentEvent){
  const podIds=eventPodIds(view,currentEvent),podKey=podIds.join("|");
  if(podKey!==activePodKey){
    const gone=activePodIds.filter(id=>!podIds.includes(id));
    activePodIds=podIds;activePodKey=podKey;
    if(gone.length){retiringPodIds=gone;clearTimeout(podRetireTimer);podRetireTimer=setTimeout(()=>{retiringPodIds=[];podRetireTimer=null;renderGraph();},POD_TRAVEL_MS);}
  }
  return podIds;
}
function renderLocationPods(view,currentEvent,positions,layer,glyphRadius,origins=new Map()){
  const podIds=activePodIds;
  const placedPods=[];
  const draw=(id,retiring)=>{
    const anchor=view.anchorOf.get(id),anchorPos=anchor&&positions.get(anchor);if(!anchorPos)return;
    const item=entity(id);if(!item)return;
    // Park the pod in the emptiest direction around its ancestor, leaning upward, so it does
    // not land on top of whichever characters happen to be clustered nearby.
    const distance=glyphRadius(anchor)+112,angle=(()=>{let best=-Math.PI/2,bestScore=-Infinity;for(let step=0;step<16;step++){const candidate=-Math.PI+step*(Math.PI/8),x=anchorPos.x+Math.cos(candidate)*distance,y=anchorPos.y+Math.sin(candidate)*distance;let score=Math.sin(candidate)<0?90:0;positions.forEach((point,other)=>{if(other===anchor)return;score+=Math.min(170,Math.hypot(point.x-x,point.y-y));});placedPods.forEach(point=>{score+=Math.min(170,Math.hypot(point.x-x,point.y-y))*2.5;});if(score>bestScore){bestScore=score;best=candidate;}}return best;})(),
      group=svgEl("g",{class:`location-pod${retiring?" pod-retracting":""}`,"data-id":id,role:"button",tabindex:0,"aria-label":`${item.name}, inside ${entity(anchor)?.name||anchor}`});
    const tether=svgEl("line",{class:"location-pod-tether"}),ring=svgEl("circle",{cx:0,cy:0,r:25,class:"location-pod-ring"}),core=svgEl("circle",{cx:0,cy:0,r:8,class:"location-pod-core"}),
      tier=svgEl("text",{x:0,y:-49,class:"location-pod-tier"}),label=svgEl("text",{x:0,y:-35,class:"location-pod-label"});
    tier.textContent=String(item.locationType||"Place").toUpperCase();label.textContent=item.name;
    const shell=svgEl("g",{class:"location-pod-shell"});shell.append(ring,core,tier,label);group.append(shell);
    layer.append(tether,group);
    const bornAt=performance.now(),place=()=>{
      const base=positions.get(anchor);if(!base)return;
      const progress=Math.max(0,Math.min(1,(performance.now()-bornAt)/POD_TRAVEL_MS)),
        eased=retiring?1-progress**3:1-(1-progress)**3,
        target={x:base.x+Math.cos(angle)*distance,y:base.y+Math.sin(angle)*distance},
        // A pod normally grows out of its parent. One standing in for a node that was just
        // folded away sets off from where that node stood instead.
        origin=origins.get(id)||base,
        x=origin.x+(target.x-origin.x)*eased,y=origin.y+(target.y-origin.y)*eased;
      physics.podPos.set(id,{x,y});
      group.setAttribute("transform",`translate(${x.toFixed(2)},${y.toFixed(2)})`);
      tether.setAttribute("x1",base.x);tether.setAttribute("y1",base.y);tether.setAttribute("x2",x);tether.setAttribute("y2",y);
    };
    placedPods.push({x:anchorPos.x+Math.cos(angle)*distance,y:anchorPos.y+Math.sin(angle)*distance});
    place();edgeUpdaters.push(place);
    group.addEventListener("pointerup",event=>{event.stopPropagation();cancelChapterSequence();revealLocationPath(id);});
    group.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();cancelChapterSequence();revealLocationPath(id);});
  };
  podIds.forEach(id=>draw(id,false));
  retiringPodIds.filter(id=>!podIds.includes(id)).forEach(id=>draw(id,true));
}

// Click cycle for a place: first click selects it (and, because everything folded inside
// reports through it, shows the whole subtree's connections), second click opens it into a
// dot ringed by its children, and clicking that dot folds the children back in.
function activateLocation(id){
  const view=lastLocationView;
  if(!view||!view.rendered.has(id)){locationPovId=null;selectedId=selectedId===id?null:id;setMobilePanel("info");renderAll();return;}
  if(view.expanded.has(id)){closeLocation(id);return;}
  if(selectedId===id&&(view.children.get(id)||[]).length){openLocation(id);return;}
  locationPovId=null;selectedId=selectedId===id?null:id;setMobilePanel("info");renderAll();
}
// A system opens and closes like a place. The one difference is upstream: picking its host opens
// it for you, so opening one by hand never changes what is selected.
function activateSystem(id){
  const view=lastSystemView;
  if(!view||!view.rendered.has(id)){selectedId=id;setMobilePanel("info");renderAll();return;}
  if(view.expanded.has(id)){closeSystem(id);return;}
  // Same three steps as a place: select it — which lists its own history, including everything
  // merged into it — then open it into its subsystems, then close it again.
  if(selectedId===id&&(view.children.get(id)||[]).length){openSystem(id);return;}
  selectedId=id;setMobilePanel("info");renderAll();
}
function openSystem(id){
  const view=lastSystemView,kids=view?.children.get(id)||[];if(!kids.length)return;
  const origin=physics.pos.get(id);
  expandedSystems.add(id);
  kids.forEach((kid,index)=>{const angle=-Math.PI/2+index*(Math.PI*2/kids.length);physics.pos.set(kid,{x:(origin?.x??360)+Math.cos(angle)*4,y:(origin?.y??260)+Math.sin(angle)*4});physics.vel.set(kid,{x:Math.cos(angle)*3.2,y:Math.sin(angle)*3.2});});
  emergingLocations=new Set(kids);clearTimeout(emergeTimer);emergeTimer=setTimeout(()=>{emergingLocations=new Set();emergeTimer=null;},760);
  renderAll();toast(`${entity(id)?.name||id} opened — ${kids.length} subsystem${kids.length===1?"":"s"}`);
}
function closeSystem(id){
  if(!lastSystemView?.expanded.has(id))return;
  const subtree=renderedSubtree(id,lastSystemView);
  expandedSystems.delete(id);
  subtree.forEach(child=>{expandedSystems.delete(child);physics.pos.delete(child);physics.vel.delete(child);physics.bounds.delete(child);});
  renderAll();
}
function openLocation(id){
  const view=lastLocationView,kids=view?.children.get(id)||[];if(!kids.length)return;
  const origin=physics.pos.get(id);
  expandedLocations.add(id);selectedId=null;locationPovId=null;
  kids.forEach((kid,index)=>{const angle=-Math.PI/2+index*(Math.PI*2/kids.length);physics.pos.set(kid,{x:(origin?.x??360)+Math.cos(angle)*4,y:(origin?.y??260)+Math.sin(angle)*4});physics.vel.set(kid,{x:Math.cos(angle)*3.2,y:Math.sin(angle)*3.2});});
  emergingLocations=new Set(kids);clearTimeout(emergeTimer);emergeTimer=setTimeout(()=>{emergingLocations=new Set();emergeTimer=null;},760);
  setMobilePanel("info");renderAll();
  toast(`${entity(id)?.name||id} opened — ${kids.length} place${kids.length===1?"":"s"} inside`);
}
function closeLocation(id){
  if(collapsingLocationId)return;
  if(!lastLocationView?.expanded.has(id))return;
  collapsingLocationId=id;renderAll();
  clearTimeout(locationCollapseTimer);
  locationCollapseTimer=setTimeout(()=>{
    const subtree=lastLocationView?renderedSubtree(id,lastLocationView):[];
    expandedLocations.delete(id);
    subtree.forEach(child=>{expandedLocations.delete(child);physics.pos.delete(child);physics.vel.delete(child);physics.bounds.delete(child);});
    if(selectedId&&subtree.includes(selectedId))selectedId=null;
    collapsingLocationId=null;locationCollapseTimer=null;renderAll();
  },420);
}
// Used by the action pods: opens every collapsed ancestor so the named place stays on screen.
function revealLocationPath(id){
  const view=lastLocationView;if(!view)return;
  const guard=new Set();let cursor=view.parentOf.get(id);
  while(cursor&&!guard.has(cursor)){guard.add(cursor);expandedLocations.add(cursor);cursor=view.parentOf.get(cursor);}
  emergingLocations=new Set([id]);clearTimeout(emergeTimer);emergeTimer=setTimeout(()=>{emergingLocations=new Set();emergeTimer=null;},760);
  selectedId=id;locationPovId=null;setMobilePanel("info");renderAll();
}

// Obsidian-style hover focus: sweeping the pointer over a node lifts it and its links out of
// the web without changing what is selected. A real selection or an action focus outranks it.
// Every drawn link records when it last changed, so hovering one can answer the question the
// graph otherwise leaves open: which chapter is this connection actually from?
let edgeIndex = [];
function distanceToSegment(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,lengthSq=dx*dx+dy*dy;
  if(!lengthSq)return Math.hypot(point.x-a.x,point.y-a.y);
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSq));
  return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}
function edgeUnderPoint(point){
  let best=null,bestDistance=15/Math.max(.2,view.scale);
  edgeIndex.forEach(entry=>{
    const a=pointFor(entry.a),b=pointFor(entry.b);if(!a||!b)return;
    const distance=distanceToSegment(point,a,b);
    if(distance<bestDistance){bestDistance=distance;best=entry;}
  });
  return best;
}
function showEdgeTip(entry,clientX,clientY){
  const tip=$("#edge-tip"),card=tip.parentElement.getBoundingClientRect();
  tip.innerHTML=`<strong>${escapeHtml(edgeEndpointName(entry.a))} — ${escapeHtml(edgeEndpointName(entry.b))}</strong><span>${escapeHtml(entry.note)}</span><b>Last changed · Chapter ${entry.chapter}</b>`;
  tip.hidden=false;
  const width=tip.offsetWidth,height=tip.offsetHeight;
  tip.style.left=`${Math.max(6,Math.min(card.width-width-6,clientX-card.left-width/2))}px`;
  tip.style.top=`${Math.max(6,clientY-card.top-height-14)}px`;
}
function edgeEndpointName(id){return String(id).startsWith("conversation:")?"this conversation":stateName(currentDerived(),id);}
function hideEdgeTip(){const tip=$("#edge-tip");if(tip&&!tip.hidden)tip.hidden=true;}
function setHoverNode(id){
  if(hoverId===id)return;hoverId=id;
  const neighbors=new Set(id?[id]:[]);
  if(id)document.querySelectorAll("#graph .edge").forEach(edge=>{if(edge.dataset.a===id||edge.dataset.b===id){neighbors.add(edge.dataset.a);neighbors.add(edge.dataset.b);}});
  document.querySelectorAll("#graph .node").forEach(node=>{node.classList.toggle("hover-focus",Boolean(id)&&node.dataset.id===id);node.classList.toggle("hover-neighbor",Boolean(id)&&node.dataset.id!==id&&neighbors.has(node.dataset.id));});
  document.querySelectorAll("#graph .edge").forEach(edge=>edge.classList.toggle("hover-connection",Boolean(id)&&(edge.dataset.a===id||edge.dataset.b===id)));
  viewportGroup?.classList.toggle("has-hover-focus",Boolean(id));
  updateLabelVisibility();
}
// Declutter pass. Labels are ranked (selection and the current action first, then structural
// nodes, then how many links a node carries) and laid out greedily in screen space; a label
// that would land on one already placed is dropped rather than overprinted. Zooming out also
// drops the quiet ones outright, which is what keeps a dense graph readable.
function updateLabelVisibility(){
  if(!labelEls.size)return;
  const scale=view.scale,textScale=labelScale(),zoomedOut=scale<.55,entries=[];
  labelEls.forEach((entry,id)=>{
    const point=physics.pos.get(id);if(!point)return;
    const classes=entry.group.classList,
      focused=classes.contains("selected")||classes.contains("event-active-node")||classes.contains("hover-focus"),
      linked=classes.contains("selected-neighbor")||classes.contains("hover-neighbor");
    let rank=focused?7:linked?6:entry.kind==="character"?1:3;
    rank+=Math.min(2,(physics.degree.get(id)||0)*.4);
    entries.push({entry,id,rank,focused,linked,x:point.x*scale+view.x,y:(point.y+entry.offset)*scale+view.y,hw:entry.halfWidth*textScale*scale+3,hh:entry.halfHeight*textScale*scale+3});
  });
  entries.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id));
  // On a big graph, naming every node is what makes it unreadable, so quiet nodes give up
  // their label and earn it back on hover or selection. Small graphs keep every name.
  // A small graph has room for every name once the separation forces settle, so nothing is
  // hidden there; culling is for graphs where names genuinely cannot all fit.
  // A rank announcement is transient and must not be overprinted, so its beat is treated as
  // crowded even on a sparse graph, where names are otherwise all kept.
  const budget=labelBudget(entries.length),crowded=entries.length>10||entries.some(item=>item.entry.tall),placed=[];
  let spent=0;
  entries.forEach(item=>{
    // What the reader is looking at keeps its name whatever happens. Its neighbours skip the
    // budget but still give way rather than overprint each other; everyone else takes a slot.
    let visible=item.focused||(item.linked||!zoomedOut||item.rank>=3)&&(item.linked||spent<budget);
    if(visible&&crowded&&!item.focused)visible=!placed.some(other=>Math.abs(other.x-item.x)<other.hw+item.hw&&Math.abs(other.y-item.y)<other.hh+item.hh);
    item.entry.group.classList.toggle("label-culled",!visible);
    if(visible&&item.entry.box)physics.bounds.set(item.id,item.entry.box);else physics.bounds.delete(item.id);
    if(visible){placed.push(item);if(!item.focused&&!item.linked)spent++;}
  });
}
function applyGraphFocus(derived){if(!selectedId)return;const chosen=entity(selectedId),connected=new Set([selectedId]),revealedSystems=lastSystemView?lastSystemView.rendered:new Set();document.querySelectorAll("#graph .edge").forEach(edge=>{const match=edge.dataset.a===selectedId||edge.dataset.b===selectedId||revealedSystems.has(edge.dataset.a)||revealedSystems.has(edge.dataset.b)||String(edge.dataset.a).startsWith("conversation:")||String(edge.dataset.b).startsWith("conversation:");if(match){connected.add(edge.dataset.a);connected.add(edge.dataset.b);edge.classList.add("selected-connection");}else edge.classList.add("dim");});document.querySelectorAll("#graph .node").forEach(node=>{if(node.dataset.id===selectedId)node.classList.add("selected");else if(connected.has(node.dataset.id))node.classList.add("selected-neighbor");else node.classList.add("dim");});if(chosen?.kind==="organization"||chosen?.kind==="location")document.querySelectorAll("#graph .relation-edge").forEach(edge=>edge.classList.add("hidden"));}

function summaryPills(items,limit=3){if(!items.length)return "";return `<div class="summary-pills">${items.slice(0,limit).map(item=>{const record=typeof item==="string"?{label:item}:item,label=record.label||item,url=record.id?entityWikiUrl(record.id):"";return url?`<a class="${escapeHtml(record.tone||"")}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<i aria-hidden="true">↗</i></a>`:`<span class="${escapeHtml(record.tone||"")}">${escapeHtml(label)}</span>`;}).join("")}${items.length>limit?`<span class="more">+${items.length-limit}</span>`:""}</div>`;}
function summaryGroup(label,items,limit){return items.length?`<div class="summary-group"><span>${escapeHtml(label)}</span>${summaryPills(items,limit)}</div>`:"";}
function renderSummary(){
  const box=$("#summary"),chosen=entity(selectedId),panelActive=box.classList.contains("mobile-active");if(!chosen){box.className=`side-card summary${panelActive?" mobile-active":""}`;box.innerHTML='<div class="empty">Select a character, organization, or location. Double-click a node for full details.</div>';return;}
  const d=currentDerived(),state=d.states.get(chosen.id),shownName=state.displayName||chosen.name,header=`<div class="summary-title"><div><strong>${entityNameLink(chosen.id,shownName)}</strong><small>${escapeHtml(activeVol().name)} · action ${currentActionIndex}</small></div><button class="button ghost" id="full-details">Show more</button></div>`;
  if(chosen.kind==="system"){
    const host=d.systemHosts.filter(link=>link.system===chosen.id).map(link=>({id:link.host,label:`${stateName(d,link.host)} · ${link.role}`})),
      parent=d.systemParents.find(link=>link.child===chosen.id),
      subsystems=d.systemParents.filter(link=>link.parent===chosen.id).map(link=>({id:link.child,label:stateName(d,link.child)})),
      places=d.systemLocations.filter(link=>link.system===chosen.id).map(link=>({id:link.location,label:`${stateName(d,link.location)} · ${link.role}`}));
    box.className=`side-card summary${panelActive?" mobile-active":""}`;
    box.innerHTML=`${header}<div class="summary-stats"><article><span>Authority</span><strong>${Number.isFinite(Number(state.authority))?escapeHtml(String(state.authority)):"—"}</strong></article><article><span>Grade</span><strong>${state.grade?escapeHtml(String(state.grade)):"—"}</strong></article><article><span>Subsystems</span><strong>${subsystems.length}</strong></article><article><span>Places</span><strong>${places.length}</strong></article><article><span>Hosts</span><strong>${host.length}</strong></article></div><div class="summary-groups">${summaryGroup("Host",host,3)}${summaryGroup("Inside",parent?[{id:parent.parent,label:stateName(d,parent.parent)}]:[],1)}${summaryGroup("Subsystems",subsystems,6)}${summaryGroup("Operates at",places,6)}</div>${subsystems.length?`<p class="location-drill-hint">${lastSystemView?.expanded.has(chosen.id)?"Opened — click the dot to fold the subsystems back in.":`Click again on the graph to open ${subsystems.length} subsystem${subsystems.length===1?"":"s"}.`}</p>`:""}`;
    $("#full-details").onclick=()=>openProfile(chosen.id);return;
  }
  if(chosen.kind==="organization"){
    const members=d.memberships.filter(m=>m.organization===chosen.id).map(m=>({id:m.character,label:`${stateName(d,m.character)} · ${m.role}`})),places=d.organizationLocations.filter(link=>link.organization===chosen.id).map(link=>({id:link.location,label:`${stateName(d,link.location)} · ${link.role}`}));box.className=`side-card summary${panelActive?" mobile-active":""}`;box.innerHTML=`${header}<div class="summary-stats"><article><span>Active members</span><strong>${members.length}</strong></article><article><span>Locations</span><strong>${places.length}</strong></article><article><span>Introduced</span><strong>Ch. ${chosen.intro}</strong></article></div>${summaryGroup("Locations",places,5)}${summaryGroup("Members",members,5)}`;$("#full-details").onclick=()=>openProfile(chosen.id);return;
  }
  if(chosen.kind==="location"){
    const chapterEvents=eventsAtLocation(chosen.id),visitors=[...new Set(chapterEvents.flatMap(locationCharacterIds))].map(id=>({id,label:entity(id)?.name||id})),occupants=[...d.locations.values()].filter(visit=>visit.location===chosen.id).map(visit=>({id:visit.character,label:entity(visit.character)?.name||visit.character})),residents=d.residences.filter(link=>link.location===chosen.id).map(link=>({id:link.character,label:`${entity(link.character)?.name} · ${link.role}`})),organizations=d.organizationLocations.filter(link=>link.location===chosen.id).map(link=>({id:link.organization,label:`${entity(link.organization)?.name} · ${link.role}`})),parentId=locationParentOf(chosen.id,d),children=d.locationParents.filter(link=>link.parent===chosen.id&&!isLocationRoot(link.child,d)).map(link=>({id:link.child,label:entity(link.child)?.name||link.child})),hierarchy=parentId?[{id:parentId,label:`Inside ${entity(parentId)?.name||parentId}`}]:[{label:String(chosen.locationType||"")===LOCATION_ROOT_TYPE?"Top-level realm":"Top level"}],pov=locationPovId?[{id:locationPovId,label:`${entity(locationPovId)?.name||locationPovId} event POV`}]:[];box.className=`side-card summary${panelActive?" mobile-active":""}`;box.innerHTML=`${header}<div class="summary-stats"><article><span>Place type</span><strong>${escapeHtml(chosen.locationType||"Other")}</strong></article><article><span>Residents</span><strong>${residents.length}</strong></article><article><span>Here now</span><strong>${occupants.length}</strong></article></div><div class="summary-groups">${summaryGroup("Viewing",pov,1)}${summaryGroup("Hierarchy",hierarchy,1)}${summaryGroup("Contains",children,5)}${summaryGroup("Residents",residents,5)}${summaryGroup("Based here",organizations,5)}${summaryGroup("Here now",occupants,5)}${summaryGroup("Active chapter",visitors,5)}</div>${children.length?`<p class="location-drill-hint">${lastLocationView?.expanded.has(chosen.id)?"Opened — click the dot to fold these places back in.":`Click again on the graph to open ${children.length} place${children.length===1?"":"s"} inside.`}</p>`:""}`;$("#full-details").onclick=()=>openProfile(chosen.id);return;
  }
  const applied=appliedEvents(),unrevealed=state.appeared===null||state.appeared>currentChapter,relationItems=[...new Set(applied.filter(e=>e.type==="relationship"&&(e.source===chosen.id||e.target===chosen.id)).map(e=>pairKey(e.source,e.target)))].map(key=>{const [a,b]=key.split("|"),other=a===chosen.id?b:a,history=applied.filter(e=>e.type==="relationship"&&pairKey(e.source,e.target)===key),type=String(history.at(-1)?.value||"neutral").toLowerCase();return {id:other,label:stateName(d,other),tone:`tone-${type}`};}),meetingIds=[...new Set(applied.filter(e=>e.type==="meeting"&&(e.source===chosen.id||e.target===chosen.id)).map(e=>e.source===chosen.id?e.target:e.source))],meetings=meetingIds.map(id=>({id,label:stateName(d,id)})),awareOutIds=[...new Set(applied.filter(e=>e.type==="awareness"&&e.source===chosen.id).map(e=>e.target))],awareOut=awareOutIds.map(id=>({id,label:stateName(d,id)})),awareInIds=[...new Set(applied.filter(e=>e.type==="awareness"&&e.target===chosen.id).map(e=>e.source))],awareIn=awareInIds.map(id=>({id,label:stateName(d,id)})),aliases=state.aliases.map(alias=>({label:alias.value})),organizations=state.memberships.map(m=>({id:m.organization,label:`${stateName(d,m.organization)} · ${m.role}`})),identityParent=d.identityParents.find(link=>link.child===chosen.id),identityChildren=d.identityParents.filter(link=>link.parent===chosen.id).map(link=>({id:link.child,label:`${stateName(d,link.child)} · ${link.relation}`})),identityFamily=[...(identityParent?[{id:identityParent.parent,label:`${stateName(d,identityParent.parent)} · ${identityParent.relation} parent`}]:[]),...identityChildren];
  const currentPlace=d.locations.get(chosen.id),currentPlaces=currentPlace?[{id:currentPlace.location,label:entity(currentPlace.location)?.name||currentPlace.location}]:[],chapterPlaces=[...new Set(d.locationVisits.filter(visit=>visit.character===chosen.id&&visit.chapter===currentChapter).map(visit=>visit.location))].map(id=>({id,label:entity(id)?.name||id})),residences=d.residences.filter(link=>link.character===chosen.id).map(link=>({id:link.location,label:`${entity(link.location)?.name} · ${link.role}`}));
  const stats=[{label:"State",value:unrevealed?"Mentioned":"Appeared"},!unrevealed&&state.realm!=="Unrevealed"?{label:trackName(state.track),value:state.realm.toLowerCase()===state.canonicalRealm.toLowerCase()?state.realm:`${state.realm} · ${state.canonicalRealm}`} : null,!unrevealed&&state.status!=="unknown"?{label:"Status",value:state.status}:null].filter(Boolean);
  box.className=`side-card summary${panelActive?" mobile-active":""}${unrevealed?" muted":""}`;box.innerHTML=`${header}<div class="summary-stats">${stats.map(stat=>`<article><span>${escapeHtml(stat.label)}</span><strong>${escapeHtml(stat.value)}</strong></article>`).join("")}</div><div class="summary-groups">${summaryGroup("Identity family",identityFamily,4)}${summaryGroup("Current place",currentPlaces,1)}${summaryGroup("Homes / bases",residences,3)}${summaryGroup("Places this chapter",chapterPlaces,4)}${summaryGroup("Aliases",aliases,3)}${summaryGroup("Organizations",organizations,2)}${summaryGroup("Relations",relationItems,4)}${summaryGroup("Met",meetings,4)}${summaryGroup("Aware of",awareOut,4)}${summaryGroup("Known by",awareIn,4)}</div>`;$("#full-details").onclick=()=>openProfile(chosen.id);
}

function eventPanelRow(event,index,{current=false,related=false,upcoming=false}={}){return `<li class="event-summary-row${current?" current-action":""}${related?" selection-related-event":""}${upcoming?" upcoming-action":""}"${index?` data-focus-action="${index}" title="Show this action on the graph"`:""}><div><div class="event-panel-meta"><span>Chapter ${event.chapter}</span><b class="event-type event-${escapeHtml(event.type)}">${escapeHtml(event.type.replaceAll("_"," "))}</b></div>${canEditEvents()?`<input class="event-message-edit" data-id="${escapeHtml(event.id)}" value="${escapeHtml(event.description||"")}" placeholder="${escapeHtml(event.type)} — describe what happens" aria-label="Message for this action" />`:`<p>${richText(event.description||event.type)}</p>`}${event.location?`<p class="event-panel-place"><small>· ${escapeHtml(entity(event.location)?.name||event.location)}</small></p>`:""}</div>${eventOriginControl(event)}</li>`;}
function canEditEvents(){return isUploadRoute&&adminAuthenticated;}
function bindEventPanelRows(){
  document.querySelectorAll(".event-message-edit").forEach(field=>{
    field.onchange=()=>{const record=data.events.find(event=>event.id===field.dataset.id);if(!record)return;record.description=field.value.trim();saveData();renderAll();toast("Message updated");};
    field.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();field.blur();}};
    field.onclick=event=>event.stopPropagation();
  });
  document.querySelectorAll("[data-focus-action]").forEach(row=>row.onclick=event=>{if(event.target.closest("button,a,input"))return;cancelChapterSequence();currentActionIndex=Number(row.dataset.focusAction);currentChapter=currentActionEvent()?.chapter||activeVol().from;renderAll();});}
function renderEvents(){const list=$("#events-list"),event=currentActionEvent(),card=list.closest(".events-card");
  // Paging through one character's history should not carry over to the next one picked.
  if(lastEventSelection!==selectedId){lastEventSelection=selectedId;selectionEventPage=SELECTION_EVENT_PAGE;}list.className="events-list";card.classList.toggle("selection-event-mode",Boolean(selectedId));card.classList.toggle("current-event-mode",Boolean(event&&!selectedId));if(!event){$("#events-title").textContent=`${activeVol().name} · Start`;$("#events-count").textContent="Action 0";list.innerHTML='<li class="slider-start-message"><strong>Use the slider to begin</strong><span>Each step reveals one story action in entry order.</span></li>';return;}if(selectedId){
    const chosen=entity(selectedId),family=new Set([selectedId,...(entity(selectedId)?.kind==="system"?absorbedInto(selectedId,currentDerived()):[])]),
      actions=volumeActions().slice(0,currentActionIndex).map((item,index)=>({event:item,index:index+1})).filter(entry=>[...family].some(id=>eventInvolves(entry.event,id))),
      // Across three hundred chapters a well-connected character has hundreds of these. They are
      // headed by chapter so the run of them can be read, and only the most recent are built —
      // the rest come in a page at a time rather than all at once.
      newestFirst=actions.slice().reverse(),shown=newestFirst.slice(0,selectionEventPage),rest=newestFirst.length-shown.length,
      rows=[];
    let heading=null;
    shown.forEach(entry=>{
      if(entry.event.chapter!==heading){heading=entry.event.chapter;
        const count=actions.filter(item=>item.event.chapter===heading).length;
        rows.push(`<li class="event-chapter-heading"><span>Chapter ${heading}</span><small>${count} action${count===1?"":"s"}</small></li>`);}
      rows.push(eventPanelRow(entry.event,entry.index,{current:entry.index===currentActionIndex,related:true}));
    });
    $("#events-title").textContent=`${stateName(currentDerived(),selectedId)} · connected events`;
    $("#events-count").textContent=`${newestFirst.length} shown`;
    list.innerHTML=`<li class="selection-event-note"><strong>Connection focus</strong><span>Click ${escapeHtml(chosen?.name||"this node")} again to return to the current event.</span></li>${rows.length?rows.join(""):'<li class="selection-event-empty">No connected event has been revealed yet.</li>'}${rest>0?`<li class="event-page-more"><button type="button" id="more-connected-events">Show ${Math.min(rest,SELECTION_EVENT_PAGE)} earlier · ${rest} left</button></li>`:""}`;
    bindEventPanelRows();
    $("#more-connected-events")?.addEventListener("click",()=>{selectionEventPage+=SELECTION_EVENT_PAGE;renderEvents();});
    return;
  }$("#events-title").textContent=`Chapter ${event.chapter} · Action ${currentActionIndex}`;
  // The whole chapter is listed, not just the action being played, so the reader can scroll
  // back and forth through it at their own pace while the slider keeps its place.
  const chapterRows=volumeActions().map((item,index)=>({event:item,index:index+1})).filter(entry=>entry.event.chapter===event.chapter);
  $("#events-count").textContent=`${chapterRows.length} in chapter`;
  list.innerHTML=chapterRows.map(entry=>eventPanelRow(entry.event,entry.index,{current:entry.index===currentActionIndex,upcoming:entry.index>currentActionIndex})).join("");
  bindEventPanelRows();
  if(!eventScrollHold)requestAnimationFrame(()=>list.querySelector(".current-action")?.scrollIntoView({block:"nearest"}));}

// The quest tab shows the run of a quest, not just its terms: how far along it is, which
// chapter each step landed in, and — for a chain — the quests inside it, each with its own
// rewards. A settled quest drops out of the active list rather than crowding it.
// A quest that is part of a larger one was being hidden inside it: the reader saw the name in a
// character's history and could not find it in this tab at all. Parts are shown by default now,
// and folding one away is the deliberate act.
const expandedQuests=new Set(),foldedQuestChains=new Set();
const QUEST_PAGE=10;
let questSettledOpen=false;
function questProgressTone(run){return run.status==="failed"?"failed":run.status==="abandoned"?"abandoned":run.status==="complete"?"complete":run.progress>=67?"high":run.progress>=34?"middle":"low";}
function questCardHtml(run,derived,children,depth){
  const item=entity(run.quest);if(!item)return "";
  const open=expandedQuests.has(run.quest),partsOpen=!foldedQuestChains.has(run.quest),
    kids=children.get(run.quest)||[],
    holders=run.holders.map(id=>stateName(derived,id)).filter(Boolean),
    joint=run.holders.length>1,
    settled=run.status!=="active",
    lastUpdate=run.updates.at(-1),
    // Most quests only say what they pay once they are finished, so until then the row says so
    // rather than pretending the reward is nothing.
    rewardText=run.reward||(item.rewards?.length?item.rewards.join(", "):settled?"":"Told on completion"),
    rank=run.rewardRank||item.rewardRank||"",
    facts=[
      item.issuer?{label:"Issued by",value:stateName(derived,item.issuer)||entity(item.issuer)?.name||item.issuer}:null,
      item.timeLimit?{label:"Time limit",value:item.timeLimit}:null,
      holders.length?{label:joint?"Working together":"Issued to",value:holders.join(", ")}:null,
      rewardText?{label:"Rewards",value:rewardText}:null,
      run.performance?{label:"Performance",value:run.performance}:null,
      item.achievements?.length?{label:"Achievements",value:item.achievements.join(", ")}:null,
      item.failure?{label:"On failure",value:item.failure}:null,
    ].filter(Boolean);
  const statusWord=run.status==="complete"?"Completed":run.status==="failed"?"Failed":run.status==="abandoned"?"Abandoned":`${run.progress}%`;
  return `<article class="quest-card tone-${questProgressTone(run)} depth-${Math.min(2,depth)}${open?" quest-open":""}" data-quest="${escapeHtml(run.quest)}" style="--quest-progress:${run.progress}%">
    <div class="quest-fill" aria-hidden="true"></div>
    <div class="quest-face">
      <button class="quest-toggle" type="button" data-quest-toggle="${escapeHtml(run.quest)}" aria-expanded="${open}"><span class="quest-name">${escapeHtml(item.name)}</span><span class="quest-status">${escapeHtml(statusWord)}</span></button>
      <div class="quest-chips">${item.questBadge?`<span class="quest-badge">${escapeHtml(item.questBadge)}</span>`:""}${joint?'<span class="quest-joint">Joint</span>':""}${rank?`<span class="quest-rank">${escapeHtml(rank)}</span>`:""}<span class="quest-chapter">${run.from?`Chapter ${run.from}`:"Unissued"}${run.to&&run.to!==run.from?` → ${run.to}`:""}</span></div>
      ${kids.length?`<button class="quest-chain-toggle" type="button" data-quest-chain="${escapeHtml(run.quest)}" aria-expanded="${partsOpen}">${partsOpen?"▾":"▸"} ${kids.length} part${kids.length===1?"":"s"}</button>`:""}
    </div>
    ${open?`<div class="quest-detail">${item.description?`<p class="quest-description">${richText(item.description)}</p>`:""}
      ${facts.length?`<dl class="quest-facts">${facts.map(fact=>`<div><dt>${escapeHtml(fact.label)}</dt><dd>${richInline(fact.value)}</dd></div>`).join("")}</dl>`:""}
      ${run.contributions.length?`<dl class="quest-facts quest-shares">${run.contributions.map(share=>`<div><dt>${escapeHtml(stateName(derived,share.character)||share.character)}</dt><dd>${escapeHtml([share.share,share.performance?`performance ${share.performance}`:"",share.rewardRank?`reward ${share.rewardRank}`:""].filter(Boolean).join(" · ")||"contributed")}</dd></div>`).join("")}</dl>`:""}
      ${run.updates.length?`<ol class="quest-updates">${run.updates.slice().reverse().map(update=>`<li class="update-${escapeHtml(update.kind)}${update.noteKind?` note-${escapeHtml(String(update.noteKind).toLowerCase())}`:""}"><span class="quest-update-chapter">Ch ${update.chapter}</span><span class="quest-update-text">${update.noteKind?`<em>${escapeHtml(update.noteKind)}:</em> `:""}${escapeHtml(update.text||update.kind)}</span><span class="quest-update-progress">${update.progress}%</span></li>`).join("")}</ol>`:""}</div>`
      :lastUpdate?`<p class="quest-latest">${lastUpdate.noteKind?`<em>${escapeHtml(lastUpdate.noteKind)}:</em> `:""}${escapeHtml(lastUpdate.text||"")}</p>`:""}
    ${kids.length&&partsOpen?`<div class="quest-children">${kids.map(child=>questCardHtml(child,derived,children,depth+1)).join("")}</div>`:""}
  </article>`;
}
function renderQuests(){
  const box=$("#quests-list"),count=$("#quests-count");if(!box)return;
  const derived=derive(currentChapter,revealedVolumeActions()),runs=new Map(derived.quests.map(run=>[run.quest,run])),
    parentOf=new Map(derived.questChains.filter(link=>runs.has(link.child)&&runs.has(link.parent)).map(link=>[link.child,link.parent])),
    children=new Map();
  parentOf.forEach((parent,child)=>{if(!children.has(parent))children.set(parent,[]);children.get(parent).push(runs.get(child));});
  const roots=derived.quests.filter(run=>!parentOf.has(run.quest)),
    active=roots.filter(run=>run.status==="active"),
    // A long story settles hundreds of quests. They are kept, but they are not all built: the
    // most recently settled come first and the rest arrive a page at a time, if ever.
    settled=roots.filter(run=>run.status!=="active").sort((a,b)=>(b.to||0)-(a.to||0)),
    activeShown=active.slice(0,QUEST_PAGE+questPageActive),settledShown=questSettledOpen?settled.slice(0,QUEST_PAGE+questPageSettled):[],
    activeRest=active.length-activeShown.length,settledRest=settled.length-settledShown.length;
  count.textContent=active.length?`${active.length} active`:derived.quests.length?"none active":"";
  if(!derived.quests.length){box.innerHTML='<p class="quests-empty">No quest has been issued yet. Quests appear here as the chapters reveal them.</p>';return;}
  box.innerHTML=`${active.length?`<div class="quest-group">${activeShown.map(run=>questCardHtml(run,derived,children,0)).join("")}</div>${activeRest>0?`<div class="quest-page-more"><button type="button" id="more-active-quests">Show ${Math.min(activeRest,QUEST_PAGE)} more active · ${activeRest} left</button></div>`:""}`:'<p class="quests-empty">Nothing is running right now.</p>'}
    ${settled.length?`<button class="quest-settled-toggle" type="button" id="quest-settled-toggle" aria-expanded="${questSettledOpen}">${questSettledOpen?"▾":"▸"} ${settled.length} settled</button>${questSettledOpen?`<div class="quest-group settled">${settledShown.map(run=>questCardHtml(run,derived,children,0)).join("")}</div>${settledRest>0?`<div class="quest-page-more"><button type="button" id="more-settled-quests">Show ${Math.min(settledRest,QUEST_PAGE)} older · ${settledRest} left</button></div>`:""}`:""}`:""}`;
  box.querySelectorAll("[data-quest-toggle]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();const id=button.dataset.questToggle;if(expandedQuests.has(id))expandedQuests.delete(id);else expandedQuests.add(id);renderQuests();}));
  box.querySelectorAll("[data-quest-chain]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();const id=button.dataset.questChain;if(foldedQuestChains.has(id))foldedQuestChains.delete(id);else foldedQuestChains.add(id);renderQuests();}));
  $("#quest-settled-toggle")?.addEventListener("click",()=>{questSettledOpen=!questSettledOpen;questPageSettled=0;renderQuests();});
  $("#more-active-quests")?.addEventListener("click",()=>{questPageActive+=QUEST_PAGE;renderQuests();});
  $("#more-settled-quests")?.addEventListener("click",()=>{questPageSettled+=QUEST_PAGE;renderQuests();});
}

function renderAll(){configureTimeline();renderGraph();renderSummary();renderEvents();renderQuests();renderAdmin();updateSuggestions();cacheActiveVolume();}

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
  const powerOrPurpose=item.kind==="character"?(cultivation.length||profile.abilities?.length?profileSection("profile-cultivation",`${trackName(state.track)} & abilities`,`${cultivationBody}${profile.abilities?.length?`<h3>Known abilities</h3>${proseList(profile.abilities)}`:""}`,"Progression"):""):(profile.purpose||profile.traits?.length?profileSection("profile-purpose",item.kind==="location"?"Description & features":"Purpose & identity",`${profile.purpose?`<p>${richText(profile.purpose)}</p>`:""}${profile.traits?.length?`<h3>${item.kind==="location"?"Notable features":"Defining traits"}</h3>${chipList(profile.traits)}`:""}`,item.kind==="location"?"Location":"Organization"):"");
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
let orderChapter = null, orderDragRow = null;
function chaptersWithEvents(){return [...new Set(data.events.map(event=>Number(event.chapter)))].filter(Number.isFinite).sort((a,b)=>a-b);}
function commitEventOrder(ids){
  ids.forEach((id,index)=>{const record=data.events.find(event=>event.id===id);if(record)record.order=index+1;});
  saveData();renderAll();
}
function stepOrderChapter(direction){
  const chapters=chaptersWithEvents();if(!chapters.length)return;
  const at=chapters.indexOf(orderChapter),next=at<0?0:Math.max(0,Math.min(chapters.length-1,at+direction));
  orderChapter=chapters[next];renderOrderEditor();
}
// Reordering is scoped to one chapter because that is the only place order has any meaning:
// events sort by chapter first. So the list never grows with the size of the novel.
function trackRowMarkup(track){
  return `<div class="track-row" data-id="${escapeHtml(track.id)}"><label class="field"><span>Track name</span><input class="track-name" value="${escapeHtml(track.name||"")}" placeholder="Authority" /></label><label class="field"><span>Ranks, lowest first — one per line</span><textarea class="track-levels" rows="6" placeholder="G&#10;F&#10;E&#10;S-&#10;S&#10;S+&#10;Divine">${escapeHtml((track.levels||[]).join("\n"))}</textarea></label><button type="button" class="button ghost track-remove">Remove this track</button></div>`;
}
function renderTrackEditor(){
  const host=$("#track-rows");if(!host)return;
  host.innerHTML=progressionTracks().map(trackRowMarkup).join("");
  host.querySelectorAll(".track-remove").forEach(button=>button.onclick=()=>{
    if(host.querySelectorAll(".track-row").length<2){toast("Keep at least one track");return;}
    button.closest(".track-row").remove();
  });
}
function collectTrackRows(){
  return [...document.querySelectorAll("#track-rows .track-row")].map(row=>{
    const name=row.querySelector(".track-name").value.trim(),
      levels=row.querySelector(".track-levels").value.split("\n").map(line=>line.trim()).filter(Boolean);
    return {id:row.dataset.id||slugForTrack(name),name:name||"Progression",levels};
  }).filter(track=>track.levels.length);
}
function slugForTrack(name){const base=String(name||"track").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"track";let id=base,n=2;while(progressionTracks().some(track=>track.id===id))id=`${base}-${n++}`;return id;}
function renderOrderEditor(){
  const list=$("#order-list");if(!list)return;
  const chapters=chaptersWithEvents();
  $("#order-count").textContent=`${chapters.length} chapter${chapters.length===1?"":"s"} with events`;
  if(!chapters.length){list.innerHTML='<li class="order-empty">No events yet.</li>';$("#order-position").textContent="";return;}
  if(orderChapter===null||!chapters.includes(orderChapter))orderChapter=chapters.includes(currentChapter)?currentChapter:chapters[0];
  const field=$("#order-chapter");if(field&&document.activeElement!==field)field.value=orderChapter;
  const rows=orderedEvents().filter(event=>Number(event.chapter)===orderChapter),at=chapters.indexOf(orderChapter);
  $("#order-prev").disabled=at<=0;$("#order-next").disabled=at>=chapters.length-1;
  $("#order-position").textContent=`Chapter ${orderChapter} — ${rows.length} action${rows.length===1?"":"s"} · ${at+1} of ${chapters.length} chapters that have events`;
  list.innerHTML=rows.map((event,index)=>`<li class="order-row${event.ghost?" order-row-ghost":""}" data-id="${escapeHtml(event.id)}"><button type="button" class="order-grip" aria-label="Drag to reorder">⠿</button><span class="order-index">${index+1}</span><div class="order-body"><i class="event-type event-${escapeHtml(event.type)}">${escapeHtml(event.type)}</i><input class="order-message" data-id="${escapeHtml(event.id)}" value="${escapeHtml(event.description||"")}" placeholder="${escapeHtml(event.type)} — describe what happens" aria-label="Message for this action" /></div><div class="order-actions"><button type="button" class="order-ghost${event.ghost?" is-ghost":""}" data-id="${escapeHtml(event.id)}" aria-label="${event.ghost?"Show this action in the list again":"Hide this action from the list, keeping its effects"}" title="${event.ghost?"Ghost — hidden from the list, still in force":"Make this a ghost action"}">${event.ghost?"◌":"◍"}</button><button type="button" class="order-edit" data-id="${escapeHtml(event.id)}" aria-label="Open the full editor for this action">✎</button><button type="button" class="order-up" data-id="${escapeHtml(event.id)}" aria-label="Move earlier"${index===0?" disabled":""}>↑</button><button type="button" class="order-down" data-id="${escapeHtml(event.id)}" aria-label="Move later"${index===rows.length-1?" disabled":""}>↓</button></div></li>`).join("");
  // Every action's message is editable in place, whatever produced it — including the ones the
  // identity form generates, which otherwise had no obvious way in.
  list.querySelectorAll(".order-message").forEach(field=>{
    field.onchange=()=>{const record=data.events.find(event=>event.id===field.dataset.id);if(!record)return;record.description=field.value.trim();saveData();renderAll();toast("Message updated");};
    field.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();field.blur();}};
  });
  list.querySelectorAll(".order-edit").forEach(button=>button.onclick=()=>loadEventEditor(button.dataset.id));
  list.querySelectorAll(".order-ghost").forEach(button=>button.onclick=()=>{const record=data.events.find(event=>event.id===button.dataset.id);if(!record)return;if(record.ghost)delete record.ghost;else record.ghost=true;saveData();renderAll();toast(record.ghost?"Ghost action — its effects stay, it leaves the list":"Back in the list");});
  const idsInOrder=()=>[...list.querySelectorAll(".order-row")].map(row=>row.dataset.id);
  const swap=(id,direction)=>{const ids=idsInOrder(),from=ids.indexOf(id),to=from+direction;if(from<0||to<0||to>=ids.length)return;ids.splice(to,0,ids.splice(from,1)[0]);commitEventOrder(ids);};
  list.querySelectorAll(".order-up").forEach(button=>button.onclick=()=>swap(button.dataset.id,-1));
  list.querySelectorAll(".order-down").forEach(button=>button.onclick=()=>swap(button.dataset.id,1));
  // The drag listens on the window rather than capturing the handle: reordering moves the row —
  // and the handle inside it — through the DOM, which drops a pointer capture mid-drag.
  list.querySelectorAll(".order-grip").forEach(grip=>{
    grip.addEventListener("pointerdown",event=>{
      if(event.button!==undefined&&event.button!==0)return;
      event.preventDefault();
      orderDragRow=grip.closest(".order-row");orderDragRow.classList.add("order-dragging");
      const move=moveEvent=>{
        if(!orderDragRow)return;
        const others=[...list.querySelectorAll(".order-row:not(.order-dragging)")],
          before=others.find(row=>{const box=row.getBoundingClientRect();return moveEvent.clientY<box.top+box.height/2;});
        if(before)list.insertBefore(orderDragRow,before);else list.appendChild(orderDragRow);
      };
      const finish=()=>{
        window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);
        if(!orderDragRow)return;
        orderDragRow.classList.remove("order-dragging");orderDragRow=null;commitEventOrder(idsInOrder());
      };
      window.addEventListener("pointermove",move);window.addEventListener("pointerup",finish);window.addEventListener("pointercancel",finish);
    });
  });
}
function renderAdmin(){
  renderVolumeEditor();
  const templateField=$("#chapter-url-template");if(templateField&&document.activeElement!==templateField)templateField.value=data.chapterUrlTemplate||"";
  const sourcesField=$("#chapter-sources-text");if(sourcesField&&document.activeElement!==sourcesField&&renderedChapterSources!==data.chapterSources){sourcesField.value=chapterSourcesToText(data.chapterSources);renderedChapterSources=data.chapterSources;}
  const missingBox=$("#missing-chapter-links");if(missingBox){const missing=referencedChaptersWithoutLinks();missingBox.hidden=!missing.length;if(missing.length)missingBox.querySelector("span").textContent=`Chapter${missing.length===1?"":"s"} ${missing.join(", ")} ${missing.length===1?"is":"are"} referenced somewhere but ${missing.length===1?"has":"have"} no saved link yet.`;}
  const sorted=[...data.events].sort((a,b)=>a.chapter-b.chapter||(a.order||0)-(b.order||0)||String(a.type).localeCompare(String(b.type)));$("#data-count").textContent=`${data.events.length} events`;$("#entity-count").textContent=`${data.entities.length} identities`;$("#entity-table").innerHTML=[...data.entities].sort((a,b)=>a.name.localeCompare(b.name)).map(item=>{const connected=data.events.filter(event=>eventInvolves(event,item.id)).length,intro=item.kind==="character"?(firstMention(item)||firstAppearance(item)||item.intro):item.intro;return `<tr class="${connected?"":"orphan-identity"}"><td><strong>${escapeHtml(item.name)}</strong>${connected?"":'<small class="orphan-warning">Not yet visible on graph</small>'}</td><td><span class="chip">${escapeHtml(item.kind)}</span></td><td>${intro?`Chapter ${intro}`:"—"}</td><td>${connected||'<span class="orphan-warning">0 — repair needed</span>'}</td><td><div class="table-actions"><button class="button ghost edit-identity" data-id="${escapeHtml(item.id)}">Edit identity</button><button class="button ghost delete-identity-row" data-id="${escapeHtml(item.id)}">Delete</button></div></td></tr>`;}).join("");$("#event-table").innerHTML=sorted.map(e=>{const creationManaged=isCreationManagedEvent(e);return `<tr data-event-id="${escapeHtml(e.id)}" data-event-owner="${creationManaged?"identity":"chapter"}"><td>${e.chapter}</td><td><span class="chip">${escapeHtml(e.type)}</span>${creationManaged?'<small class="table-location">creation record</small>':""}</td><td>${escapeHtml([entity(e.source)?.name,e.target?entity(e.target)?.name:null].filter(Boolean).join(" → "))}${e.location?`<small class="table-location">at ${escapeHtml(entity(e.location)?.name||e.location)}</small>`:""}</td><td>${escapeHtml(e.description||"")}</td><td><div class="table-actions"><button class="button ghost edit-event" data-id="${escapeHtml(e.id)}">${creationManaged?"Edit creation":"Edit event"}</button><button class="button ghost delete-event" data-id="${escapeHtml(e.id)}">Delete</button></div></td></tr>`;}).join("");
  renderOrderEditor();renderTrackEditor();
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

function updateEntityFormFields(){const form=$("#entity-form"),kind=form.elements.kind.value,isCharacter=kind==="character",isLocation=kind==="location";$("#entity-gender-field").hidden=!isCharacter;$("#entity-location-type-field").hidden=!isLocation;$("#entity-mentioned-field").hidden=!isCharacter;$("#entity-initial-cultivation-field").hidden=!isCharacter;$("#entity-initial-track-field").hidden=!isCharacter;const isSystem=kind==="system",isQuest=kind==="quest";$("#entity-authority-field").hidden=!isSystem;$("#entity-grade-field").hidden=!isSystem;["issuer","badge","reward-rank","time-limit","rewards","achievements","failure"].forEach(name=>{$(`#entity-quest-${name}-field`).hidden=!isQuest;});$("#entity-initial-cultivation-alias-field").hidden=!isCharacter;$("#entity-appeared-label").textContent=isCharacter?"First appearance chapter (optional)":isQuest?"Chapter the quest first exists":"Introduction chapter";form.elements.appeared.placeholder=isCharacter?"Leave blank if they have not appeared yet":`When this ${kind} becomes known`;form.elements.appeared.required=!isCharacter;$("#entity-help").textContent=isCharacter?"Presence and cultivation are separate facts. Use the cultivation fields above only for a level confirmed when the character is introduced. Leave Unknown when it has not been revealed; later breakthroughs belong in chapter events.":isLocation?"Choose the place's scale once. Use a hierarchy event to place it inside its direct parent; use movement for travel and residence for long-term homes or bases.":isQuest?"Write the quest once — its terms do not change. Issuing it, moving it along, settling it, and putting it inside a chain are all chapter actions, so the quest tab shows only as much as the reader has read.":"Create the organization once. Membership and headquarters or branch changes are recorded chapter by chapter.";}
function resetEntityEditor(){const form=$("#entity-form");form.reset();form.elements.editingId.value="";form.elements.editingCreationEventId.value="";$("#creation-edit-note").hidden=true;$("#entity-creation-description-field").hidden=true;$("#entity-form-title").textContent="Create character, organization, or location";$("#save-entity").textContent="Create and add to graph";$("#delete-entity").hidden=true;$("#cancel-entity-edit").hidden=true;$("#manage-entity").value="";updateEntityFormFields();}
function loadEntityEditor(id=null,{scroll=true,creationEventId=""}={}){const item=id?entity(id):resolveEntity($("#manage-entity").value);if(!item){toast("Choose an existing identity");return;}const form=$("#entity-form"),initialCultivation=item.kind==="character"?orderedEvents().find(event=>event.type==="cultivation"&&event.source===item.id&&event.initial===true):null,managedEvents=creationEventsFor(item),selectedCreationEvent=managedEvents.find(event=>event.id===creationEventId)||null,commonSourceUrl=selectedCreationEvent?.sourceUrl||managedEvents.find(event=>event.sourceUrl)?.sourceUrl||"";$("#manage-entity").value=item.name;form.elements.editingId.value=item.id;form.elements.editingCreationEventId.value=selectedCreationEvent?.id||"";form.elements.kind.value=item.kind;form.elements.name.value=item.name;form.elements.gender.value=item.gender||"unknown";form.elements.locationType.value=item.locationType||"Other";form.elements.authority.value=item.authority??"";form.elements.grade.value=item.grade||"";form.elements.issuer.value=item.issuer?(entity(item.issuer)?.name||item.issuer):"";form.elements.questBadge.value=item.questBadge||"";form.elements.rewardRank.value=item.rewardRank||"";form.elements.timeLimit.value=item.timeLimit||"";form.elements.rewards.value=(item.rewards||[]).join(", ");form.elements.achievements.value=(item.achievements||[]).join(", ");form.elements.failure.value=item.failure||"";form.elements.mentioned.value=item.kind==="character"?(firstMention(item)||""):"";form.elements.appeared.value=item.kind==="character"?(firstAppearance(item)||""):(item.intro||"");form.elements.initialLevel.value=initialCultivation?.level||"";form.elements.initialCultivationAlias.value=initialCultivation&&cultivationDisplay(initialCultivation).toLowerCase()!==cultivationCanonical(initialCultivation).toLowerCase()?cultivationDisplay(initialCultivation):"";form.elements.creationSourceUrl.value=commonSourceUrl;form.elements.creationEventDescription.value=selectedCreationEvent?.description||"";form.elements.description.value=item.description||"";updateEntityFormFields();$("#creation-edit-note").hidden=!selectedCreationEvent;$("#entity-creation-description-field").hidden=!selectedCreationEvent;$("#entity-form-title").textContent=selectedCreationEvent?`Edit creation record — ${item.name}`:`Edit ${item.name}`;$("#save-entity").textContent=selectedCreationEvent?"Update linked creation record":"Save identity";$("#delete-entity").hidden=false;$("#cancel-entity-edit").hidden=false;if(scroll){form.scrollIntoView({behavior:"smooth",block:"start"});(selectedCreationEvent?form.elements.creationEventDescription:form.elements.name).focus({preventScroll:true});}toast(selectedCreationEvent?`Editing the original creation record for ${item.name}`:`${item.name} loaded in the identity form`);}
function resetEventEditor(){const form=$("#event-form");form.reset();form.elements.editingId.value="";form.elements.chapter.value=eventDrafts[0]?.chapter||currentChapter;$("#event-edit-mode-note").hidden=true;$("#event-form-title").textContent="Add chapter changes";$("#save-event").textContent="Save this change";$("#cancel-event-edit").hidden=true;$("#queue-event").hidden=false;updateEventHelp();}
function loadEventEditor(id){const record=data.events.find(event=>event.id===id);if(!record)return;if(isCreationManagedEvent(record)){resetEventEditor();loadEntityEditor(record.source,{creationEventId:record.id});return;}const form=$("#event-form"),isCanonicalCultivationName=record.type==="cultivation"&&CULTIVATION_LEVELS.some(name=>name.toLowerCase()===String(record.value||"").trim().toLowerCase());form.elements.editingId.value=record.id;form.elements.type.value=record.type;form.elements.chapter.value=record.chapter;form.elements.source.value=entity(record.source)?.name||record.source;form.elements.location.value=record.location?(entity(record.location)?.name||record.location):"";form.elements.target.value=record.target?(entity(record.target)?.name||record.target):"";form.elements.characters.value=(record.characters||[]).filter(id=>id!==record.source).map(id=>entity(id)?.name||id).join(", ");form.elements.ghost.checked=record.ghost===true;form.elements.progress.value=record.progress??"";form.elements.rewardRank.value=record.rewardRank||"";form.elements.performance.value=record.performance||"";if(record.type==="quest_update")form.elements.noteKind.value=record.value||"Update";form.elements.authority.value=record.authority??"";form.elements.grade.value=record.grade||"";form.elements.value.value=isCanonicalCultivationName?"":record.value||"";fillTrackSelect(form.elements.track,trackIdOf(record));fillLevelSelect(form.elements.level,trackIdOf(record),record.level||"");form.elements.description.value=record.description||"";form.elements.sourceUrl.value=record.sourceUrl||"";updateEventHelp();const defaults={organization_location:"open",residency:"begin",location_parent:"add",identity_parent:"add",membership:"reveal",system_host:"add",system_parent:"add",system_location:"open",system_merge:"add",system_end:"add"};form.elements.action.value=record.action||defaults[record.type]||"join";$("#event-edit-mode-note").hidden=false;$("#event-form-title").textContent=`Edit this exact chapter ${record.chapter} event`;$("#save-event").textContent="Replace this event";$("#cancel-event-edit").hidden=false;$("#queue-event").hidden=true;form.scrollIntoView({behavior:"smooth",block:"start"});form.elements.type.focus({preventScroll:true});toast(`Editing only the selected chapter ${record.chapter} event`);}
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
  const form=$("#event-form"),type=form.elements.type.value,isOrgLocation=type==="organization_location",isResidence=type==="residency",isHierarchy=type==="location_parent",isIdentityHierarchy=type==="identity_parent",needsTarget=["awareness","meeting","relationship","membership","identity_parent","system_host","system_parent","system_merge","quest_part","quest_contribution"].includes(type),showsTarget=needsTarget||type==="note"||type==="quest_issue",needsValue=["alias","display_name","status","gender","age","relationship","organization_location","residency","identity_parent"].includes(type),showsSystemValue=["system_host","system_location","system_end"].includes(type),showsValue=needsValue||showsSystemValue||type==="membership"||type==="cultivation"||["quest_end","quest_contribution"].includes(type),usesAction=["membership","organization_location","residency","location_parent","identity_parent","system_host","system_parent","system_location","system_merge","system_end","quest_issue","quest_end","quest_part"].includes(type),help={mention:"Use this when an identity is referred to without physically appearing. Status remains unknown.",appearance:"A normal physical appearance also proves that the character is alive at this action.",corpse_appearance:"Use when a dead body is the character's first physical appearance. This sets appearance and dead status together.",display_name:"Changes the public label from this exact action onward. Add another display-name event later to end a spy name or restore an earlier name.",identity_parent:"Keeps clones, avatars, incarnations, split souls, and their original identity close together in the graph. A character merged into a system belongs here too — record the merge now and change or remove the link in the chapter they separate.",movement:"Records travel and changes the character's current physical position.",residency:"Records a home, permanent residence, long-term stay, camp, or personal domain.",location_parent:"Places one location directly inside another. The graph only draws the outermost place — a realm at most — until you open it.",alias:"Adds another searchable name without changing the main displayed label.",cultivation:"Choose the canonical tier by name; an equivalent path title remains synchronized.",status:"Use this for later changes or uncertain states such as missing and presumed dead.",gender:"Use this for a later reveal or an actual change — not needed if it was already set when the character was created.",age:"Use this whenever an age is stated or changes in-story — an exact number, a range, or a description.",awareness:"The first character knows the second exists.",meeting:"Records that two characters meet.",conversation:"One action for a whole conversation, however many characters are in it. Everyone listed counts as having met.",relationship:"Choose a second character and enter friendly, neutral, or hostile.",membership:"Choose whether the membership begins now, was already true but is only revealed now, or ends here.",organization_location:"Connect an organization to a headquarters, branch, base, territory, or outpost.",system_host:"Bind a system to the character who carries it. A system can have no host, and a host can carry more than one.",system_parent:"Place one system inside another — the taverns and resorts that belong to a larger system.",system_location:"A system operates at this place. A system can operate at many places at once.",system_rank:"A system rises or falls. Fill in whichever of authority or grade changed — the other keeps its current value. Write unknown in a field to take that rank away, for a system that loses its grade or whose number was never known.",system_merge:"One system is swallowed by another. It keeps its own history, shown as a small marker on the system that took it.",system_end:"The system is destroyed. It stays on the graph as a small marker so its history is still reachable.",quest_issue:"A quest is handed out. Name the character who receives it if the story says who — a quest can be issued to nobody in particular. List more than one and it becomes a joint quest, worked in cooperation and rewarded by contribution.",quest_progress:"How far along the quest is, as a percentage. Record one of these each time the story moves it, and the quest tab fills its card to match.",quest_end:"The quest is settled. Most quests only name their reward here, scaled to how the host performed, so fill in the rank and the performance grade on this action. A completed quest leaves the active list; a failed one carries whatever punishment the quest itself names.",quest_update:"A quest's terms grow as the story turns. Record the update, hint, added objective, or the system's own remark here — it belongs to the same quest, not to a second one.",quest_part:"Put this quest inside a larger one. The larger quest shows as a single card that opens to reveal its parts, each with its own reward.",quest_contribution:"For a joint quest, what one character contributed and what they were given for it. Record one of these per character — their shares need not be equal, and their rewards need not match.",note:"A general story event."};
  $("#event-target-field").hidden=!showsTarget;$("#event-characters-field").hidden=!["conversation","quest_issue"].includes(type);$("#event-authority-field").hidden=type!=="system_rank";$("#event-grade-field").hidden=type!=="system_rank";$("#event-progress-field").hidden=type!=="quest_progress";$("#event-note-kind-field").hidden=type!=="quest_update";$("#event-reward-rank-field").hidden=!["quest_end","quest_contribution"].includes(type);$("#event-performance-field").hidden=!["quest_end","quest_contribution"].includes(type);$("#event-value-field").hidden=!showsValue;$("#event-level-field").hidden=type!=="cultivation";$("#event-action-field").hidden=!usesAction;
  // Ending something does not need the wording of what it was. Leaving this required meant the
  // browser silently refused to submit a removal at all — no toast, no event, nothing.
  const removing=REMOVAL_ACTIONS.has(form.elements.action.value);
  form.elements.target.required=needsTarget;form.elements.value.required=needsValue&&!removing;form.elements.location.required=["movement","organization_location","residency","location_parent","system_location"].includes(type);
  $("#event-location-label").textContent=type==="movement"?"Destination":isOrgLocation?"Headquarters / branch location":isResidence?"Home / long-term location":isHierarchy?"Direct parent location":"Where this happened (optional)";
  $("#event-source-label").textContent=String(type).startsWith("quest_")?"Quest":type==="movement"?"Character travelling":isOrgLocation?"Organization":isResidence?"Resident character":isHierarchy?"Child location":isIdentityHierarchy?"Clone / avatar / child identity":type==="note"?"Main character, organization, or location":"Identity / source";
  $("#event-target-label").textContent=type==="quest_issue"?"Issued to (optional)":type==="quest_part"?"Larger quest this is part of":type==="quest_contribution"?"Who contributed":type==="membership"?"Organization":isIdentityHierarchy?"Original / parent identity":type==="note"?"Related identity (optional)":"Second character";
  $("#event-value-label").textContent=type==="system_end"?"Why it was destroyed (optional)":type==="quest_end"?"What the reward turned out to be (optional)":type==="quest_contribution"?"Share of the work (optional)":type==="display_name"?"New public display name":type==="identity_parent"?"Identity relationship":type==="alias"?"New alias":type==="cultivation"?"Equivalent path name (optional)":type==="status"?"New status":type==="gender"?"Gender":type==="age"?"Age":type==="relationship"?"Relationship (friendly, neutral, or hostile)":isOrgLocation?"Organization location role":isResidence?"Residence type":"Role or title (optional)";
  form.elements.target.placeholder=type==="quest_issue"?"Character who receives it":type==="quest_part"?"The larger quest this sits inside":type==="quest_contribution"?"Character whose share this is":type==="membership"?"Type an organization name":isIdentityHierarchy?"Original character, parent clone, or the system they merged into":type==="note"?"Optional":"Type a character name or alias";
  form.elements.value.placeholder=type==="system_end"?"Burned out in the Jotun campaign":type==="quest_end"?"Realm Seed, 200 contribution points":type==="quest_contribution"?"Two thirds of the work":type==="display_name"?"Name readers see from this action":type==="identity_parent"?"Clone / Avatar / Incarnation / Merged into":type==="alias"?"E.g. The Innkeeper":type==="cultivation"?"E.g. Earthen Deity":type==="status"?"Unknown / Alive / Dead / Missing":type==="gender"?"E.g. Male, Female, Unknown, Nonbinary":type==="age"?"E.g. 17, Early twenties, Over 900 years":type==="relationship"?"friendly / neutral / hostile":isOrgLocation?"Headquarters / Branch / Base / Outpost":isResidence?"Home / Permanent resident / Camp":"E.g. Founder or member";
  if(isOrgLocation)form.elements.value.setAttribute("list","location-role-options");else if(isResidence)form.elements.value.setAttribute("list","residence-role-options");else form.elements.value.removeAttribute("list");
  const action=form.elements.action,keepAction=action.value;
  if(type==="system_host"){action.innerHTML='<option value="add">Bonds to this host</option><option value="remove">Bond ends</option>';$("#event-action-label").textContent="System host change";}
  else if(type==="system_parent"){action.innerHTML='<option value="add">Becomes a subsystem</option><option value="remove">No longer a subsystem</option>';$("#event-action-label").textContent="Subsystem change";}
  else if(type==="system_location"){action.innerHTML='<option value="open">Starts operating here</option><option value="close">Withdraws from here</option>';$("#event-action-label").textContent="System location change";}
  else if(type==="system_merge"){action.innerHTML='<option value="add">Merges into it</option><option value="remove">Merge undone</option>';$("#event-action-label").textContent="System merge";}
  else if(type==="system_end"){action.innerHTML='<option value="add">Destroyed</option><option value="remove">Destruction undone</option>';$("#event-action-label").textContent="System end";}
  else if(type==="quest_issue"){action.innerHTML='<option value="issue">Issued</option><option value="withdraw">Withdrawn before it ran</option>';$("#event-action-label").textContent="Quest issue";}
  else if(type==="quest_end"){action.innerHTML='<option value="complete">Completed</option><option value="fail">Failed</option><option value="abandon">Abandoned</option><option value="reopen">Reopened</option>';$("#event-action-label").textContent="Quest outcome";}
  else if(type==="quest_part"){action.innerHTML='<option value="add">Part of it</option><option value="remove">No longer part of it</option>';$("#event-action-label").textContent="Quest grouping change";}
  else if(isOrgLocation){action.innerHTML='<option value="open">Establishes / opens here</option><option value="close">Closes / leaves this location</option>';$("#event-action-label").textContent="Organization location change";}else if(isResidence){action.innerHTML='<option value="begin">Residence begins</option><option value="end">Residence ends</option>';$("#event-action-label").textContent="Residence change";}else if(isHierarchy){action.innerHTML='<option value="add">Place inside parent</option><option value="remove">Remove from parent</option>';$("#event-action-label").textContent="Location hierarchy change";}else if(isIdentityHierarchy){action.innerHTML='<option value="add">Connect to parent identity</option><option value="remove">Separate from parent identity</option>';$("#event-action-label").textContent="Identity hierarchy change";}else{action.innerHTML='<option value="reveal">Existing membership is revealed</option><option value="join">Joins in this chapter</option><option value="leave">Leaves / membership ends</option>';$("#event-action-label").textContent="Organization membership knowledge";}
  // The options are rebuilt above, which would otherwise throw away what was chosen — and this
  // runs whenever the action changes, so the choice must survive it.
  if([...action.options].some(option=>option.value===keepAction))action.value=keepAction;
  const removingNow=REMOVAL_ACTIONS.has(action.value);
  form.elements.value.required=needsValue&&!removingNow;
  $("#event-help").textContent=`${help[type]||"Record a story change."} Add a wiki link inside details as [[visible text|https://full-link]].`;
}

// A rank action can raise a system, lower it, or take a rank away altogether, and the sentence
// has to read properly in all three cases.
function rankPhrase(source,rankAuthority,rankGrade){
  const parts=[];
  if(rankAuthority)parts.push(meansUnknown(rankAuthority)?"no longer has a known authority":`is now authority ${String(rankAuthority).trim()}`);
  if(rankGrade)parts.push(meansUnknown(rankGrade)?"is left ungraded":`is now grade ${String(rankGrade).trim()}`);
  return `${source.name} ${parts.join(" and ")||"is re-ranked"}.`;
}
function generatedEventDescription(type,source,target,location,value,level,action,initial=false,trackId=DEFAULT_TRACK_ID,participants=[],rankAuthority="",rankGrade="",progress=""){
  const other=target?.name;
  const canonical=trackLevels(trackId)[(Number(level)||1)-1]||"unknown rank",cultivationText=value?`${value}, equivalent to ${canonical}`:canonical;
  const membershipText=action==="leave"?`${source.name} leaves ${other}${value?` (${value})`:""}.`:action==="reveal"?`${source.name} is revealed to already be part of ${other}${value?` as ${value}`:""}.`:`${source.name} joins ${other}${value?` as ${value}`:""}.`;
  return {mention:`${source.name} is mentioned.`,appearance:`${source.name} appears alive.`,corpse_appearance:`${source.name}'s dead body appears.`,display_name:`${source.name} is now publicly known as ${value}.`,identity_parent:action==="remove"?`${source.name} is separated from ${other}.`:`${source.name} is connected to ${other} as ${value||"a clone"}.`,movement:`${source.name} travels to ${location?.name}.`,residency:action==="end"?`${source.name}'s ${value||"residence"} at ${location?.name} ends.`:`${source.name} begins using ${location?.name} as ${value||"a residence"}.`,location_parent:action==="remove"?`${source.name} is no longer recorded inside ${location?.name}.`:`${source.name} is inside ${location?.name}.`,alias:`${value} is revealed as an alias of ${source.name}.`,cultivation:initial?`${source.name}'s cultivation is revealed as ${cultivationText}.`:`${source.name} reaches ${cultivationText}.`,status:`${source.name}'s status changes to ${value}.`,awareness:`${source.name} becomes aware that ${other} exists.`,meeting:`${source.name} meets ${other}.`,conversation:`${source.name} talks with ${(participants||[]).filter(name=>name!==source.name).join(", ")||"others"}.`,relationship:`${source.name} and ${other}'s relationship becomes ${value}.`,membership:membershipText,system_host:action==="remove"?`${source.name} unbinds from ${other}.`:`${source.name} bonds to ${other}${value?` as ${value}`:""}.`,system_parent:action==="remove"?`${source.name} is no longer a subsystem of ${other}.`:`${source.name} becomes a subsystem of ${other}.`,system_location:action==="close"?`${source.name} withdraws from ${location?.name}.`:`${source.name} operates at ${location?.name}${value?` as ${value}`:""}.`,system_rank:rankPhrase(source,rankAuthority,rankGrade),system_merge:action==="remove"?`${source.name} separates from ${other} again.`:`${source.name} merges into ${other}.`,system_end:action==="remove"?`${source.name} is restored.`:`${source.name} is destroyed${value?` — ${value}`:""}.`,organization_location:action==="close"?`${source.name} closes its ${value||"location"} at ${location?.name}.`:`${location?.name} becomes ${source.name}'s ${value||"branch"}.`,quest_issue:action==="withdraw"?`${source.name} is withdrawn${other?` from ${other}`:""}.`:`${source.name} is issued${other?` to ${other}`:""}.`,quest_progress:`${source.name} stands at ${String(progress).trim()||"0"}%.`,quest_end:action==="fail"?`${source.name} is failed.`:action==="abandon"?`${source.name} is abandoned.`:action==="reopen"?`${source.name} is reopened.`:`${source.name} is completed${value?` — ${value}`:""}.`,quest_part:action==="remove"?`${source.name} is no longer part of ${other}.`:`${source.name} is part of ${other}.`,quest_update:`${source.name}: a new note.`,quest_contribution:`${other} contributed to ${source.name}${value?` — ${value}`:""}.`,note:`A story event involving ${source.name}.`}[type]||`${source.name}: ${type}.`;
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
  // "Where this happened" is optional on every action, this one included. A stray clause here
  // rejected the bond whenever a place was named, which is exactly when it is worth recording.
  if(type==="system_host"&&(source.kind!=="system"||target?.kind!=="character")){toast("A host bond needs a system and a character");return null;}
  if(type==="system_parent"&&(source.kind!=="system"||target?.kind!=="system")){toast("A subsystem link needs two systems");return null;}
  if(type==="system_parent"&&source.id===target?.id){toast("A system cannot be its own subsystem");return null;}
  if(type==="system_location"&&(source.kind!=="system"||!location||location.kind!=="location")){toast("A system location needs a system and a place");return null;}
  if(type==="system_merge"&&(source.kind!=="system"||target?.kind!=="system"||source.id===target.id)){toast("A merge needs two different systems");return null;}
  if(type==="system_end"&&source.kind!=="system"){toast("Only a system can be destroyed this way");return null;}
  if(type==="location_parent"&&!location){toast("Choose the direct parent location");return null;}
  if(type==="location_parent"&&(source.kind!=="location"||location.kind!=="location")){toast("Hierarchy requires a child location and a parent location");return null;}
  if(type==="location_parent"&&source.id===location.id){toast("A location cannot contain itself");return null;}
  if(type==="location_parent"&&action!=="remove"&&String(source.locationType||"")===LOCATION_ROOT_TYPE){toast("A realm is the widest place the graph draws — it cannot sit inside another location");return null;}
  if(type==="location_parent"&&action!=="remove"&&locationLineage(location.id,derive(chapter)).includes(source.id)){toast("That would create a circular location hierarchy");return null;}
  if(type==="organization_location"&&!location){toast("Choose the headquarters or branch location");return null;}
  if(type==="organization_location"&&source.kind!=="organization"){toast("Choose the organization connected to this location");return null;}
  if(["awareness","meeting","relationship","membership","identity_parent"].includes(type)&&!target){toast(type==="membership"?"Choose the organization":type==="identity_parent"?"Choose the original or parent identity":"Choose the second character");return null;}
  if(["awareness","meeting","relationship"].includes(type)&&(source.kind!=="character"||target.kind!=="character")){toast("This event requires two characters");return null;}
  if(type==="membership"&&source.kind!=="character"){toast("Choose the character joining or leaving");return null;}
  if(type==="membership"&&target.kind!=="organization"){toast("Membership must point to an organization");return null;}
  if(type==="identity_parent"&&!(IDENTITY_KINDS.has(source.kind)&&IDENTITY_KINDS.has(target.kind))){toast("An identity link joins two characters, or a character and a system");return null;}
  if(type==="identity_parent"&&source.id===target.id){toast("An identity cannot be its own parent");return null;}
  if(["appearance","corpse_appearance"].includes(type)&&source.kind!=="character"){toast("Only a character can physically appear");return null;}
  if(["alias","display_name","identity_parent","status","gender","age","relationship","organization_location","residency"].includes(type)&&!value&&!REMOVAL_ACTIONS.has(action)){toast(`Enter the ${$("#event-value-label").textContent.toLowerCase()}`);return null;}
  if(type==="cultivation"&&!level){toast("Choose the canonical cultivation tier");return null;}
  if(type==="relationship"&&!Object.keys(COLORS).includes(value.toLowerCase())){toast("Relationship must be friendly, neutral, or hostile");return null;}
  const previous=data.events.find(event=>event.id===id),enteredDescription=String(form.get("description")||"").trim(),previousGenerated=previous?generatedEventDescription(previous.type,entity(previous.source),entity(previous.target),entity(previous.location),previous.value,previous.level,previous.action,previous.initial===true,trackIdOf(previous),(previous.characters||[]).map(id=>entity(id)?.name).filter(Boolean),previous.authority??"",previous.grade||"",previous.progress??""):"",useGenerated=!enteredDescription||enteredDescription===previousGenerated||isAutomaticCultivationDescription(enteredDescription,previous),description=useGenerated?generatedEventDescription(type,source,target,location,value,level,action,previous?.initial===true,String(form.get("track")||progressionTracks()[0].id),String(form.get("characters")||"").split(",").map(part=>part.trim()).filter(Boolean).map(part=>resolveEntity(part)?.name).filter(Boolean),String(form.get("authority")||"").trim(),String(form.get("grade")||"").trim(),String(form.get("progress")||"").trim()):enteredDescription,order=previous?.chapter===chapter&&previous?.order?previous.order:nextEventOrder(chapter,eventDrafts),record={id,chapter,order,type,source:source.id,description,...(sourceUrl?{sourceUrl:safeExternalUrl(sourceUrl)}:{})};
  if(location)record.location=location.id;
  // Every type whose form offers a second identity or a free-text value has to keep it. The
  // system and quest actions were reading both from the form and then dropping them.
  if(["awareness","meeting","relationship","membership","identity_parent","system_host","system_parent","system_merge","quest_part","quest_contribution","quest_issue"].includes(type)||(type==="note"&&target))record.target=target?.id;
  if(["alias","display_name","identity_parent","cultivation","status","relationship","membership","organization_location","residency","system_host","system_location","system_end","quest_end","quest_contribution"].includes(type)&&value)record.value=["relationship","status"].includes(type)?value.toLowerCase():value;
  if(type==="cultivation"){record.track=String(form.get("track")||progressionTracks()[0].id);record.level=level;if(!value)record.value=trackLevels(record.track)[level-1];}
  if(previous?.initial===true&&type==="cultivation")record.initial=true;
  if(previous?.identityIntro===true)record.identityIntro=true;
  if(type==="conversation"){
    const named=String(form.get("characters")||"").split(",").map(part=>part.trim()).filter(Boolean).map(resolveEntity),
      talkers=[...new Set([source.id,...named.filter(item=>item?.kind==="character").map(item=>item.id)])];
    if(named.some(item=>!item)){toast("One of the conversation names does not match an identity");return null;}
    if(talkers.length<2){toast("A conversation needs at least two characters");return null;}
    record.characters=talkers;
  }
  if(String(type).startsWith("quest_")){
    if(source.kind!=="quest"){toast("A quest action needs a quest as its subject");return null;}
    if(type==="quest_part"&&(target?.kind!=="quest"||target.id===source.id)){toast("Grouping quests needs two different quests");return null;}
    if(type==="quest_issue"&&target&&target.kind!=="character"){toast("A quest is issued to a character");return null;}
    if(type==="quest_contribution"&&target?.kind!=="character"){toast("Choose the character whose contribution this is");return null;}
    if(type==="quest_progress"){
      const percent=String(form.get("progress")||"").trim();
      if(!percent||!Number.isFinite(Number(percent))||Number(percent)<0||Number(percent)>100){toast("Progress is a number between 0 and 100");return null;}
      record.progress=Number(percent);
    }
    if(type==="quest_update"){record.value=String(form.get("noteKind")||"Update");if(!enteredDescription){toast("Write the update, hint, or remark itself");return null;}}
    if(type==="quest_issue"){
      const joint=String(form.get("characters")||"").split(",").map(part=>part.trim()).filter(Boolean).map(part=>resolveEntity(part)).filter(item=>item?.kind==="character").map(item=>item.id);
      const everyone=[...new Set([...(target?.kind==="character"?[target.id]:[]),...joint])];
      if(everyone.length>1)record.characters=everyone;
    }
    if(["quest_end","quest_contribution"].includes(type)){
      const rank=String(form.get("rewardRank")||"").trim(),performance=String(form.get("performance")||"").trim();
      if(rank&&!gradeIsValid(rank)){toast("A reward rank is one to three letters with an optional + or −, or one of the named ranks");return null;}
      if(performance&&!gradeIsValid(performance)){toast("A performance grade is one to three letters with an optional + or −, or one of the named ranks");return null;}
      if(rank)record.rewardRank=rank;
      if(performance)record.performance=performance;
    }
  }
  if(type==="system_rank"){
    if(source.kind!=="system"){toast("Only a system has an authority and a grade");return null;}
    const rankAuthority=String(form.get("authority")||"").trim(),rankGrade=String(form.get("grade")||"").trim();
    if(!rankAuthority&&!rankGrade){toast("Give the new authority, the new grade, or both — or write unknown to take one away");return null;}
    if(!authorityIsValid(rankAuthority)){toast("Authority is a plain number, or unknown to take it away");return null;}
    if(rankGrade&&!gradeIsValid(rankGrade)){toast("A grade is one to three letters with an optional + or −, one of the named ranks, or unknown to take it away");return null;}
    if(rankAuthority)record.authority=meansUnknown(rankAuthority)?null:Number(rankAuthority);
    if(rankGrade)record.grade=meansUnknown(rankGrade)?null:rankGrade;
  }
  if(form.get("ghost"))record.ghost=true;
  if(["membership","organization_location","residency","location_parent","identity_parent","system_host","system_parent","system_location","system_merge","system_end","quest_issue","quest_end","quest_part"].includes(type))record.action=action;
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
  if(kind==="system"&&!gradeIsValid(form.get("grade"))){toast("A grade is one to three letters with an optional + or −, one of the named ranks, or left blank");return null;}
  if(kind==="system"&&!authorityIsValid(form.get("authority"))){toast("Authority is a plain number, or left blank");return null;}
  if(kind==="quest"&&String(form.get("issuer")||"").trim()&&!resolveEntity(String(form.get("issuer")))){toast("Choose an existing identity as the issuer, or leave it blank");return null;}
  if(kind==="quest"&&!gradeIsValid(form.get("rewardRank"))){toast("A reward rank is one to three letters with an optional + or −, one of the named ranks, or left blank");return null;}
  const record=editingId?entity(editingId):{id},managedBefore=data.events.filter(storyEvent=>storyEvent.source===id&&isCreationManagedEvent(storyEvent)),selectedBefore=managedBefore.find(storyEvent=>storyEvent.id===editingCreationEventId),initialCultivationEvent=managedBefore.find(storyEvent=>storyEvent.type==="cultivation"&&storyEvent.initial===true);Object.assign(record,{kind,name,gender:kind==="character"?String(form.get("gender")):undefined,locationType:kind==="location"?String(form.get("locationType")||"Other"):undefined,authority:kind==="system"?(String(form.get("authority")||"").trim()===""||meansUnknown(form.get("authority"))?undefined:Number(form.get("authority"))):undefined,grade:kind==="system"?(meansUnknown(form.get("grade"))?undefined:String(form.get("grade")||"").trim()||undefined):undefined,issuer:kind==="quest"?(resolveEntity(String(form.get("issuer")||""))?.id||undefined):undefined,questBadge:kind==="quest"?(String(form.get("questBadge")||"").trim()||undefined):undefined,rewardRank:kind==="quest"?(meansUnknown(form.get("rewardRank"))?undefined:String(form.get("rewardRank")||"").trim()||undefined):undefined,timeLimit:kind==="quest"?(String(form.get("timeLimit")||"").trim()||undefined):undefined,rewards:kind==="quest"?(listFromText(form.get("rewards"),true).length?listFromText(form.get("rewards"),true):undefined):undefined,achievements:kind==="quest"?(listFromText(form.get("achievements"),true).length?listFromText(form.get("achievements"),true):undefined):undefined,failure:kind==="quest"?(String(form.get("failure")||"").trim()||undefined):undefined,mentioned:kind==="character"?mentioned:null,appeared:kind==="character"?appeared:null,intro:kind!=="character"?appeared:(mentioned||appeared),description:String(form.get("description")||"")});if(parsedName.wikiUrl)record.profile={...(record.profile||{}),wikiUrl:parsedName.wikiUrl};if(!editingId)data.entities.push(record);
  const sourceFields=creationSourceUrl?{sourceUrl:safeExternalUrl(creationSourceUrl)}:{};
  const creationDescription=(previous,generated)=>previous?.id===selectedBefore?.id&&creationEventDescription&&!(creationEventDescription===previous?.description&&isAutomaticCreationDescription(previous))?creationEventDescription:isAutomaticCreationDescription(previous)?generated:(previous?.description||generated);
  if(kind==="character"){
    const previousPresence=managedBefore.filter(storyEvent=>["mention","appearance"].includes(storyEvent.type));
    data.events=data.events.filter(storyEvent=>!(storyEvent.source===id&&isCreationManagedEvent(storyEvent)&&["mention","appearance"].includes(storyEvent.type)));
    if(mentioned){const previous=previousPresence.find(storyEvent=>storyEvent.type==="mention"),sameChapter=previous?.chapter===mentioned,generated=`${name} is mentioned for the first time.`;data.events.push({id:previous?.id||"ev-"+crypto.randomUUID(),chapter:mentioned,order:sameChapter&&previous?.order?previous.order:nextEventOrder(mentioned),type:"mention",source:id,creationManaged:true,description:creationDescription(previous,generated),...sourceFields});}
    if(appeared){const previous=previousPresence.find(storyEvent=>storyEvent.type==="appearance"),sameChapter=previous?.chapter===appeared,generated=`${name} appears for the first time.`;data.events.push({id:previous?.id||"ev-"+crypto.randomUUID(),chapter:appeared,order:sameChapter&&previous?.order?previous.order:nextEventOrder(appeared),type:"appearance",source:id,creationManaged:true,description:creationDescription(previous,generated),...sourceFields});}
    const cultivationChapter=appeared||mentioned;if(initialLevel){const cultivationRecord=initialCultivationEvent||{id:"ev-"+crypto.randomUUID(),type:"cultivation",track:String(form.get("initialTrack")||progressionTracks()[0].id),source:id},presenceEvent=data.events.filter(storyEvent=>storyEvent.source===id&&storyEvent.creationManaged===true&&["mention","appearance"].includes(storyEvent.type)&&storyEvent.chapter===cultivationChapter).sort((a,b)=>(a.order||0)-(b.order||0)).at(-1),sameChapter=cultivationRecord.chapter===cultivationChapter,cultivationOrder=sameChapter&&cultivationRecord.order?cultivationRecord.order:presenceEvent?(Number(presenceEvent.order)||1)+.01:nextEventOrder(cultivationChapter),generated=initialCultivationAlias?`${name}'s cultivation is revealed as ${initialCultivationAlias}, equivalent to ${CULTIVATION_LEVELS[initialLevel-1]}.`:`${name}'s cultivation is revealed as ${CULTIVATION_LEVELS[initialLevel-1]}.`;Object.assign(cultivationRecord,{chapter:cultivationChapter,order:cultivationOrder,creationManaged:true,initial:true,level:initialLevel,value:initialCultivationAlias||CULTIVATION_LEVELS[initialLevel-1],description:creationDescription(initialCultivationEvent,generated),...sourceFields});if(!creationSourceUrl)delete cultivationRecord.sourceUrl;if(!initialCultivationEvent)data.events.push(cultivationRecord);}else if(initialCultivationEvent)data.events=data.events.filter(storyEvent=>storyEvent.id!==initialCultivationEvent.id);
  }else{data.events=data.events.filter(storyEvent=>!(storyEvent.source===id&&isCreationManagedEvent(storyEvent)&&["mention","appearance"].includes(storyEvent.type)));const introEvent=managedBefore.find(storyEvent=>storyEvent.type==="note"),generated=`${name} is introduced.`;if(introEvent){const sameChapter=introEvent.chapter===appeared;introEvent.chapter=appeared;introEvent.order=sameChapter&&introEvent.order?introEvent.order:nextEventOrder(appeared);introEvent.creationManaged=true;introEvent.identityIntro=true;introEvent.description=creationDescription(introEvent,generated);if(creationSourceUrl)introEvent.sourceUrl=safeExternalUrl(creationSourceUrl);else delete introEvent.sourceUrl;if(kind==="location")introEvent.location=id;else delete introEvent.location;}else data.events.push({id:"ev-"+crypto.randomUUID(),chapter:appeared,order:nextEventOrder(appeared),type:"note",source:id,creationManaged:true,identityIntro:true,...sourceFields,...(kind==="location"?{location:id}:{}),description:generated});}
  saveData();resetEntityEditor();renderAll();toast(`${name} ${editingId?"updated":"created"}`);
});
$("#entity-form").elements.kind.addEventListener("change",updateEntityFormFields);
$("#load-entity").onclick=()=>loadEntityEditor();
$("#cancel-entity-edit").onclick=resetEntityEditor;
$("#delete-entity").onclick=()=>deleteIdentity($("#entity-form").elements.editingId.value);

$("#event-form").addEventListener("submit",event=>{event.preventDefault();const editingId=event.currentTarget.elements.editingId.value,previous=editingId?data.events.find(item=>item.id===editingId):null,record=buildEventRecord(event.currentTarget,editingId||undefined);if(!record)return;if(editingId){const index=data.events.findIndex(item=>item.id===editingId);if(index>=0)data.events[index]=record;}else data.events.push(record);if(previous)syncPresenceFromEvents(previous.source,previous.type);syncPresenceFromEvents(record.source,record.type);saveData();resetEventEditor();renderAll();toast(`Change ${editingId?"updated":"saved"}; graph updated`);});
$("#event-form").elements.type.addEventListener("change",updateEventHelp);
$("#event-form").elements.action.addEventListener("change",updateEventHelp);
$("#event-form").elements.track.addEventListener("change",event=>{const form=$("#event-form");fillLevelSelect(form.elements.level,event.target.value,"");form.elements.value.value="";});
$("#entity-form").elements.initialTrack.addEventListener("change",event=>{const form=$("#entity-form");fillLevelSelect(form.elements.initialLevel,event.target.value,"");});
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
$("#clear-all-data").onclick=()=>{const answer=prompt("This permanently deletes every character, organization, location, profile, and event from the published graph. Your volume structure will remain. Type DELETE to continue.");if(answer!=="DELETE"){if(answer!==null)toast("Nothing was deleted");return;}cancelChapterSequence();expandedChapter=null;data={schemaVersion:11,novel:data.novel||"Living Story Graph",volumes:deepClone(data.volumes?.length?data.volumes:sampleData.volumes),cultivationLevels:deepClone(CULTIVATION_LEVELS),progressionTracks:deepClone(data.progressionTracks?.length?data.progressionTracks:sampleData.progressionTracks),chapterUrlTemplate:data.chapterUrlTemplate||"",chapterSources:deepClone(data.chapterSources||{}),entities:[],events:[]};eventDrafts=[];selectedId=null;locationPovId=null;activeVolume=data.volumes[0].id;cacheActiveVolume();currentActionIndex=0;currentChapter=data.volumes[0].from;physics.pos.clear();physics.vel.clear();lastAutoFitSignature="";saveData();resetEntityEditor();resetEventEditor();renderEventBatch();configure();renderAll();toast("All story data deleted");};

function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2200);}

function positionSliderOnboarding(){const onboarding=$("#slider-onboarding"),card=onboarding?.parentElement;if(!onboarding||onboarding.hidden||!card)return;const sliderRect=timeline.getBoundingClientRect(),cardRect=card.getBoundingClientRect(),x=Math.max(72,Math.min(cardRect.width-72,sliderRect.left+sliderRect.width/2-cardRect.left));onboarding.style.setProperty("--slider-x",`${x}px`);}
window.addEventListener("resize",positionSliderOnboarding);
// How many marks fit is a question about the track's width, so a resize can change the answer.
let timelineMarkResize=null;
window.addEventListener("resize",()=>{clearTimeout(timelineMarkResize);timelineMarkResize=setTimeout(renderTimelineMarkers,120);});

function syncChapterRefToggles(on){document.body.classList.toggle("show-chapter-refs",on);document.querySelectorAll("[data-chapter-ref-toggle]").forEach(button=>{button.classList.toggle("active",on);button.setAttribute("aria-pressed",String(on));});}
function dismissChapterRefHint(){const hint=$("#chapter-ref-hint");if(hint)hint.hidden=true;localStorage.setItem(CHAPTER_REF_HINT_SEEN_KEY,"1");}
function toggleChapterRefs(){const next=!document.body.classList.contains("show-chapter-refs");syncChapterRefToggles(next);localStorage.setItem(CHAPTER_REF_TOGGLE_KEY,next?"1":"0");dismissChapterRefHint();}
syncChapterRefToggles(localStorage.getItem(CHAPTER_REF_TOGGLE_KEY)==="1");
if(localStorage.getItem(CHAPTER_REF_HINT_SEEN_KEY)!=="1"){const hint=$("#chapter-ref-hint");if(hint)hint.hidden=false;}
$("#dismiss-chapter-ref-hint")?.addEventListener("click",event=>{event.stopPropagation();dismissChapterRefHint();});
document.addEventListener("click",event=>{if(event.target.closest("[data-chapter-ref-toggle]"))toggleChapterRefs();});
document.addEventListener("click",event=>{if(!document.body.classList.contains("show-chapter-refs"))return;if(event.target.closest("a"))return;const zone=event.target.closest(".sentence-cite");if(!zone)return;const url=zone.querySelector(".chapter-citation")?.getAttribute("href");if(url)window.open(url,"_blank","noopener,noreferrer");});
document.addEventListener("keydown",event=>{if(event.key==="Alt"&&!event.repeat){event.preventDefault();toggleChapterRefs();}});
graph.addEventListener("wheel",event=>{event.preventDefault();const {x:ux,y:uy}=toSvgPoint(event.clientX,event.clientY);zoomBy(event.deltaY>0?0.9:1.11,ux,uy);},{passive:false});
graph.addEventListener("pointerdown",event=>{if(event.button!==undefined&&event.button!==0)return;const p=toSvgPoint(event.clientX,event.clientY);panStart={ux:p.x,uy:p.y,viewX:view.x,viewY:view.y};graph.setPointerCapture(event.pointerId);});
graph.addEventListener("pointermove",event=>{if(!panStart)return;viewPinnedByUser=true;viewTween=null;const p=toSvgPoint(event.clientX,event.clientY);view.x=panStart.viewX+(p.x-panStart.ux);view.y=panStart.viewY+(p.y-panStart.uy);applyViewTransform();});
const endPan=()=>{panStart=null;};graph.addEventListener("pointerup",endPan);graph.addEventListener("pointercancel",endPan);
// Hit-testing the links in script rather than widening their strokes: a thin line stays thin,
// and the reachable band around it does not add an element per edge.
graph.addEventListener("pointermove",event=>{
  if(physics.dragId||panStart||event.target.closest(".node,.location-pod")){hideEdgeTip();return;}
  const found=edgeUnderPoint(toContentPoint(event.clientX,event.clientY));
  if(found)showEdgeTip(found,event.clientX,event.clientY);else hideEdgeTip();
});
graph.addEventListener("pointerleave",hideEdgeTip);
// Hovering the chapter list holds the auto-advance so the reader can scroll it without the
// slider moving under them. It resumes only if it was actually playing when they arrived.
const eventsCard=$("#events-list")?.closest(".events-card");
if(eventsCard){
  const hold=()=>{if(eventScrollHold)return;eventScrollHold=true;autoplayHeldByHover=Boolean(chapterAutoplayTimer);cancelChapterSequence();eventsCard.classList.add("events-holding");$("#events-hold").hidden=!autoplayHeldByHover;};
  const release=()=>{if(!eventScrollHold)return;eventScrollHold=false;eventsCard.classList.remove("events-holding");$("#events-hold").hidden=true;if(autoplayHeldByHover){autoplayHeldByHover=false;scheduleChapterSequence();}};
  eventsCard.addEventListener("pointerenter",hold);
  eventsCard.addEventListener("pointerleave",release);
  eventsCard.addEventListener("focusin",hold);
  eventsCard.addEventListener("focusout",event=>{if(!eventsCard.contains(event.relatedTarget))release();});
}
$("#add-track").onclick=()=>{const host=$("#track-rows");host.insertAdjacentHTML("beforeend",trackRowMarkup({id:"",name:"",levels:[]}));renderTrackEditorBindings();};
function renderTrackEditorBindings(){$("#track-rows").querySelectorAll(".track-remove").forEach(button=>button.onclick=()=>{if($("#track-rows").querySelectorAll(".track-row").length<2){toast("Keep at least one track");return;}button.closest(".track-row").remove();});}
$("#track-form").addEventListener("submit",event=>{
  event.preventDefault();
  const tracks=collectTrackRows();
  if(!tracks.length){toast("A track needs at least one rank");return;}
  // Ranks are re-read by name so an event keeps pointing at the same rung when a ladder is
  // reordered or renamed; a rung that disappears clamps to the closest one that remains.
  const before=new Map(progressionTracks().map(track=>[track.id,track.levels]));
  data.progressionTracks=tracks;
  data.events.filter(record=>record.type==="cultivation").forEach(record=>{
    const oldLadder=before.get(trackIdOf(record))||[],name=oldLadder[(Number(record.level)||1)-1],ladder=trackLevels(trackIdOf(record));
    const moved=name?ladder.indexOf(name):-1;
    record.level=moved>=0?moved+1:Math.min(Math.max(1,Number(record.level)||1),ladder.length);
    if(record.value&&oldLadder.includes(record.value))record.value=ladder[record.level-1];
  });
  saveData();configure();renderAll();toast("Progression tracks saved");
});
$("#order-prev").onclick=()=>stepOrderChapter(-1);
$("#order-next").onclick=()=>stepOrderChapter(1);
$("#order-chapter").addEventListener("change",event=>{const wanted=Number(event.target.value);if(!Number.isFinite(wanted))return;const chapters=chaptersWithEvents();if(!chapters.length)return;
  // Land on the nearest chapter that actually has events rather than showing an empty list.
  orderChapter=chapters.includes(wanted)?wanted:chapters.reduce((best,chapter)=>Math.abs(chapter-wanted)<Math.abs(best-wanted)?chapter:best,chapters[0]);
  renderOrderEditor();});
$("#zoom-in").onclick=()=>zoomBy(1.25);$("#zoom-out").onclick=()=>zoomBy(1/1.25);$("#zoom-reset").onclick=()=>{viewPinnedByUser=false;fitGraphToContent();};
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
