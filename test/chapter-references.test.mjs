import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../src/style.css", import.meta.url), "utf8");

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const remainder = source.slice(start + 10), boundary = remainder.search(/\n(?:async )?function /), next = boundary < 0 ? -1 : start + 10 + boundary;
  return source.slice(start, next < 0 ? source.length : next);
}

function sandbox(dataValue) {
  const helperSource = [
    "var dataVersion=0,missingChapterLinksCache=null;",
    functionBody("escapeHtml"),
    functionBody("safeExternalUrl"),
    functionBody("validChapter"),
    functionBody("chapterUrl"),
    functionBody("chapterCitation"),
    functionBody("richInline"),
    functionBody("richText"),
    functionBody("listFromText"),
    functionBody("labelDivider"),
    functionBody("factsFromText"),
    functionBody("fact"),
    functionBody("referencedChaptersWithoutLinks"),
  ].join("\n");
  const ctx = { data: dataValue, URL };
  vm.createContext(ctx);
  vm.runInContext(helperSource, ctx);
  return ctx;
}

test("chapterUrl resolves every chapter from a single stored template", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  assert.equal(vm.runInContext("chapterUrl(18)", ctx), "https://example.com/ch-18");
  assert.equal(vm.runInContext("chapterUrl(1)", ctx), "https://example.com/ch-1");
});

test("chapterUrl returns nothing when no template is configured", () => {
  const ctx = sandbox({});
  assert.equal(vm.runInContext("chapterUrl(18)", ctx), "");
});

test("chapterCitation prefers a per-instance sourceUrl over the central template", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`chapterCitation({chapter:9, sourceUrl:"https://other-site.com/nine"})`, ctx);
  assert.match(html, /href="https:\/\/other-site\.com\/nine"/);
  assert.doesNotMatch(html, /example\.com/);
});

test("chapterCitation falls back to the central template when no sourceUrl is set", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`chapterCitation({chapter:9})`, ctx);
  assert.match(html, /href="https:\/\/example\.com\/ch-9"/);
});

test("richInline renders a bare [[12]] as a standalone point-citation, wrapping nothing else", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("Luthor arrives in the lobby.[[18]] He waits by the door.")})`, ctx);
  assert.match(html, /^Luthor arrives in the lobby\.<span class="prose-chapter-ref"><a class="chapter-citation" href="https:\/\/example\.com\/ch-18"/);
  assert.match(html, /He waits by the door\.$/);
});

test("richInline with no template configured still renders a bare marker as an uncited badge", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("Something happens.[[4]]")})`, ctx);
  assert.match(html, /Something happens\.<span class="prose-chapter-ref"><span class="chapter-citation uncited"[^>]*>Chapter 4<\/span><\/span>$/);
});

test("richInline [[Label|N]] wraps exactly the given label as a real clickable link, not a guessed range", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("A Slightly Chubby [[man|2]] random text")})`, ctx);
  assert.equal(html, 'A Slightly Chubby <span class="prose-chapter-ref"><a class="chapter-ref-link" href="https://example.com/ch-2" target="_blank" rel="noopener noreferrer" title="Open the source for chapter 2">man</a><a class="chapter-citation" href="https://example.com/ch-2" target="_blank" rel="noopener noreferrer" title="Open the source for chapter 2"><span>Chapter 2</span><i aria-hidden="true">↗</i></a></span> random text');
});

test("richInline [[Label|N]] with no saved link renders an uncited, still-visible label", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("[[man|2]] random text")})`, ctx);
  assert.match(html, /^<span class="prose-chapter-ref"><span class="chapter-ref-link uncited" title="No source saved for chapter 2 yet">man<\/span><span class="chapter-citation uncited"/);
  assert.match(html, / random text$/);
});

test("richInline leaves an invalid chapter number (0) as literal text", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("Odd input.[[0]] more text")})`, ctx);
  assert.match(html, /\[\[0\]\]/);
  assert.doesNotMatch(html, /prose-chapter-ref/);
});

test("richInline still supports the existing [[Label|url]] wiki-link syntax unchanged", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("See [[Protos Energy|https://example.com/protos]] for more.")})`, ctx);
  assert.match(html, /<a class="wiki-external-link" href="https:\/\/example\.com\/protos"[^>]*>Protos Energy/);
});

test("richInline [[Label|url|N]] attaches both an external link and a chapter citation to the same text — the originally reported bug", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("[[Protos Energy|https://wiki.example.com/protos|12]] is important.")})`, ctx);
  // the external link must be exact — no swallowed "|12" corrupting the URL (the original bug)
  assert.match(html, /<a class="wiki-external-link" href="https:\/\/wiki\.example\.com\/protos"[^>]*>Protos Energy/);
  assert.doesNotMatch(html, /protos\|12/);
  // and a separate, correctly-parsed chapter citation must follow it
  assert.match(html, /<span class="prose-chapter-ref"><a class="chapter-citation" href="https:\/\/example\.com\/ch-12"/);
  assert.match(html, / is important\.$/);
});

test("richInline [[Label|N|url]] works with the URL and chapter given in either order", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("[[Protos Energy|12|https://wiki.example.com/protos]]")})`, ctx);
  assert.match(html, /<a class="wiki-external-link" href="https:\/\/wiki\.example\.com\/protos"[^>]*>Protos Energy/);
  assert.match(html, /<span class="prose-chapter-ref"><span class="chapter-citation uncited"[^>]*>Chapter 12<\/span><\/span>/);
});

test("richInline [[Label|url|N]] with an invalid chapter number still renders the link, just without a citation", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("[[Protos Energy|https://wiki.example.com/protos|0]]")})`, ctx);
  assert.match(html, /^<a class="wiki-external-link" href="https:\/\/wiki\.example\.com\/protos"[^>]*>Protos Energy<span aria-hidden="true">↗<\/span><\/a>$/);
});

test("richInline doesn't support nesting a marker inside another marker's label — it degrades gracefully, recovering the cleanly-formed inner marker instead of baking a stray bracket into the link", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("[[[[System|https://the-innkeeper.fandom.com/wiki/Systems]]Creator|1]]")})`, ctx);
  assert.match(html, /<a class="wiki-external-link" href="https:\/\/the-innkeeper\.fandom\.com\/wiki\/Systems"[^>]*>System<span/);
  assert.doesNotMatch(html, />\[\[System</, "the label must not contain a leftover stray bracket");
  assert.doesNotMatch(html, />\[System</, "the label must not contain a leftover stray bracket");
});

test("richInline [[cite:N]]...[[/cite]] cites a whole sentence to a chapter while a word-level [[Label|url]] link inside it keeps working independently — the actual requested feature", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("[[cite:1]]Something involving the [[System|https://the-innkeeper.fandom.com/wiki/Systems]] here.[[/cite]]")})`, ctx);
  assert.equal(html, '<span class="prose-chapter-ref sentence-cite" data-chapter="1">Something involving the <a class="wiki-external-link" href="https://the-innkeeper.fandom.com/wiki/Systems" target="_blank" rel="noopener noreferrer">System<span aria-hidden="true">↗</span></a> here.<a class="chapter-citation" href="https://example.com/ch-1" target="_blank" rel="noopener noreferrer" title="Open the source for chapter 1"><span>Chapter 1</span><i aria-hidden="true">↗</i></a></span>');
});

test("richInline supports multiple sentence-cite zones for different chapters in the same field", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("[[cite:1]]Sentence one.[[/cite]] [[cite:2]]Sentence two.[[/cite]]")})`, ctx);
  assert.match(html, /data-chapter="1">Sentence one\.<a class="chapter-citation" href="https:\/\/example\.com\/ch-1"/);
  assert.match(html, /data-chapter="2">Sentence two\.<a class="chapter-citation" href="https:\/\/example\.com\/ch-2"/);
});

test("richInline auto-closes a sentence-cite zone left open at the end of the field, so a missing [[/cite]] doesn't swallow the rest of the text", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("[[cite:1]]Forgot to close this")})`, ctx);
  assert.match(html, /^<span class="prose-chapter-ref sentence-cite" data-chapter="1">Forgot to close this<span class="chapter-citation uncited"[^>]*>Chapter 1<\/span><\/span>$/);
});

test("richInline treats a new [[cite:N]] as implicitly closing a still-open previous zone", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("[[cite:1]]One[[cite:2]]Two[[/cite]]")})`, ctx);
  assert.equal((html.match(/class="prose-chapter-ref sentence-cite"/g) || []).length, 2);
  assert.match(html, /data-chapter="1">One<span class="chapter-citation uncited"/);
  assert.match(html, /data-chapter="2">Two<span class="chapter-citation uncited"/);
});

test("richInline leaves a stray [[/cite]] with no matching open zone as literal text", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("nothing was open[[/cite]] after")})`, ctx);
  assert.equal(html, "nothing was open[[/cite]] after");
});

test("richInline sentence-cite zones use the existing hover-highlight rule for free, since it's the same base class as word-level refs", () => {
  assert.doesNotMatch(styleSource, /\.sentence-cite\{[^}]*background/, "should not need its own separate highlight rule");
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref:hover\{background/);
});

test("the Mark-chapter button now wraps the selection in a [[cite:N]]...[[/cite]] zone instead of a single-bracket marker that couldn't contain other markers", () => {
  const body = functionBody("installWikiLinkHelpers");
  assert.match(body, /textarea\.setRangeText\(`\[\[cite:\$\{chapter\}\]\]\$\{selectedText\}\[\[\/cite\]\]`,start,end,"end"\)/);
});

test("the wiki-link button can optionally attach a chapter citation too, producing the three-part syntax", () => {
  const body = functionBody("installWikiLinkHelpers");
  assert.match(body, /Also cite a chapter for this\?/);
  assert.match(body, /textarea\.setRangeText\(chapter\?`\[\[\$\{label\}\|\$\{url\.trim\(\)\}\|\$\{chapter\}\]\]`:`\[\[\$\{label\}\|\$\{url\.trim\(\)\}\]\]`,start,end,"end"\)/);
});

test("the chapter-links form validates the template, each explicit-link line, and saves both together", () => {
  assert.match(source, /if\(rawTemplate&&!rawTemplate\.includes\("\{n\}"\)\)/);
  assert.match(source, /if\(rawTemplate&&!safeExternalUrl\(rawTemplate\.replaceAll\("\{n\}","1"\)\)\)/);
  assert.match(source, /const badLine=listFromText\(rawSources\)\.find/);
  assert.match(source, /data\.chapterUrlTemplate=rawTemplate;data\.chapterSources=chapterSourcesFromText\(rawSources\)/);
});

test("the header exposes an on/off toggle for hover-revealed chapter markers, persisted per browser", () => {
  assert.match(source, /id="toggle-chapter-refs"/);
  assert.match(source, /CHAPTER_REF_TOGGLE_KEY/);
  assert.match(source, /document\.body\.classList\.toggle\("show-chapter-refs"/);
});

test("pressing Alt also toggles chapter refs, sharing the same toggle logic as clicking the button", () => {
  assert.match(source, /function toggleChapterRefs\(\)\{/);
  assert.match(source, /document\.addEventListener\("keydown",event=>\{if\(event\.key==="Alt"&&!event\.repeat\)\{event\.preventDefault\(\);toggleChapterRefs\(\);\}\}\)/);
  assert.match(source, /document\.addEventListener\("click",event=>\{if\(event\.target\.closest\("\[data-chapter-ref-toggle\]"\)\)toggleChapterRefs\(\);\}\)/);
});

test("selecting text and marking a chapter wraps it in [[cite:N]]...[[/cite]], not a single-bracket marker that couldn't contain other markers", () => {
  const body = functionBody("installWikiLinkHelpers");
  assert.match(body, /chapter-mark-helper/);
  assert.match(body, /Mark chapter for selected text/);
  assert.match(body, /const selectedText=textarea\.value\.slice\(start,end\)/);
  assert.match(body, /chapter=validChapter\(input\)/);
  assert.match(body, /textarea\.setRangeText\(`\[\[cite:\$\{chapter\}\]\]\$\{selectedText\}\[\[\/cite\]\]`,start,end,"end"\)/);
});

test("prose chapter refs are fully inert with the toggle off — no pointer-events, no visible decoration — and even with the toggle on, everything stays hidden until actual hover", () => {
  assert.match(styleSource, /\.prose-chapter-ref \.chapter-ref-link\{color:inherit;text-decoration:none;pointer-events:none/);
  assert.match(styleSource, /\.prose-chapter-ref \.chapter-citation\{position:absolute;left:0;bottom:100%;[^}]*opacity:0;pointer-events:none/);
  assert.doesNotMatch(styleSource, /body\.show-chapter-refs \.prose-chapter-ref \.chapter-ref-link\{[^}]*text-decoration:underline/, "underline must not appear from the toggle alone — only on :hover");
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref:hover \.chapter-ref-link\{[^}]*text-decoration:underline/);
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref:hover \.chapter-citation\{opacity:1;pointer-events:auto\}/);
});

test("the marked text is a real <a> link when a source exists, but only becomes clickable (pointer-events:auto) once the toggle is on", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("[[man|2]] text")})`, ctx);
  assert.match(html, /^<span class="prose-chapter-ref"><a class="chapter-ref-link" href="https:\/\/example\.com\/ch-2"/);
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref \.chapter-ref-link\{pointer-events:auto\}/);
});

test("an explicit chapter link (for sites like webnovel.com with non-formulaic URLs) takes priority over the template", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}", chapterSources: { 1: "https://www.webnovel.com/book/x_1/a-shooting-star-and-a-wish_60202087178355517" } });
  assert.equal(vm.runInContext("chapterUrl(1)", ctx), "https://www.webnovel.com/book/x_1/a-shooting-star-and-a-wish_60202087178355517");
  assert.equal(vm.runInContext("chapterUrl(2)", ctx), "https://example.com/ch-2", "chapter 2 has no explicit entry, so it falls back to the template");
});

test("chapterSourcesFromText/ToText round-trip explicit chapter links as one line per chapter", () => {
  const ctx = sandbox({});
  vm.runInContext(functionBody("chapterSourcesFromText") + "\n" + functionBody("chapterSourcesToText") + "\n" + functionBody("listFromText"), ctx);
  const result = vm.runInContext(`(() => {
    const map = chapterSourcesFromText(${JSON.stringify("2 | https://example.com/two\n1 | https://example.com/one")});
    return JSON.stringify({ map, text: chapterSourcesToText(map) });
  })()`, ctx);
  const { map, text } = JSON.parse(result);
  assert.deepEqual(map, { "1": "https://example.com/one", "2": "https://example.com/two" });
  assert.equal(text, "1 | https://example.com/one\n2 | https://example.com/two");
});

test("marking a chapter with no saved link prompts to save one, so it's set once instead of re-entered every mention", () => {
  const body = functionBody("installWikiLinkHelpers");
  assert.match(body, /if\(!chapterUrl\(chapter\)\)\{/);
  assert.match(body, /data\.chapterSources=\{\.\.\.\(data\.chapterSources\|\|\{\}\),\[chapter\]:savedUrl\}/);
});

test("renderAdmin only re-syncs the explicit chapter-links textarea when the map actually changed, not on every render", () => {
  const body = functionBody("renderAdmin");
  assert.match(body, /renderedChapterSources!==data\.chapterSources/);
  assert.match(body, /renderedChapterSources=data\.chapterSources/);
});

test("Delete all story data preserves chapter links instead of silently discarding them, matching how volumes are already preserved", () => {
  assert.match(source, /chapterUrlTemplate:data\.chapterUrlTemplate\|\|""/);
  assert.match(source, /chapterSources:deepClone\(data\.chapterSources\|\|\{\}\)/);
});

test("saveData bumps a version counter used to invalidate the cached missing-links scan", () => {
  const body = functionBody("saveData");
  assert.match(body, /dataVersion\+\+/);
});

test("referencedChaptersWithoutLinks finds chapters cited by events and by [[N]]/[[Label|N]] prose markers that have no resolvable link", () => {
  const ctx = sandbox({
    chapterSources: { 3: "https://webnovel.example/three" },
    events: [
      { chapter: 3, type: "mention" }, // covered by the explicit chapterSources entry -> NOT missing
      { chapter: 9, type: "mention" }, // no template, no explicit entry -> missing
    ],
    entities: [
      { id: "lex", kind: "character", profile: { history: "He arrived.[[3]] Later, [[something odd|1234]] happened." } },
    ],
  });
  const missing = JSON.parse(vm.runInContext("JSON.stringify(referencedChaptersWithoutLinks())", ctx));
  assert.deepEqual(missing, [9, 1234]);
});

test("referencedChaptersWithoutLinks treats an event's own sourceUrl as satisfying that chapter, even with no template", () => {
  const ctx = sandbox({ events: [{ chapter: 5, sourceUrl: "https://example.com/five" }], entities: [] });
  const missing = JSON.parse(vm.runInContext("JSON.stringify(referencedChaptersWithoutLinks())", ctx));
  assert.deepEqual(missing, []);
});

test("referencedChaptersWithoutLinks result is cached against dataVersion, not recomputed on every call", () => {
  const ctx = sandbox({ events: [{ chapter: 7 }], entities: [] });
  vm.runInContext("referencedChaptersWithoutLinks()", ctx); // populate cache
  // mutate data without bumping dataVersion — a stale cache should still return the old (now-incorrect) result
  vm.runInContext(`data.chapterSources={7:"https://example.com/seven"}`, ctx);
  const stillCached = JSON.parse(vm.runInContext("JSON.stringify(referencedChaptersWithoutLinks())", ctx));
  assert.deepEqual(stillCached, [7], "cache should not have noticed the change yet");
  vm.runInContext("dataVersion++", ctx);
  const fresh = JSON.parse(vm.runInContext("JSON.stringify(referencedChaptersWithoutLinks())", ctx));
  assert.deepEqual(fresh, [], "bumping dataVersion should invalidate the cache");
});

test("the missing-chapter-links warning is wired into renderAdmin and hidden when nothing is missing", () => {
  const body = functionBody("renderAdmin");
  assert.match(body, /const missingBox=\$\("#missing-chapter-links"\)/);
  assert.match(body, /missingBox\.hidden=!missing\.length/);
});

test("a small quick-add form saves or updates a single chapter link without touching the bulk list, and prefills the URL for an existing chapter", () => {
  assert.match(source, /id="chapter-quick-add-form"/);
  assert.match(source, /id="quick-add-chapter"/);
  assert.match(source, /id="quick-add-url"/);
  assert.match(source, /\$\("#quick-add-chapter"\)\.addEventListener\("blur",\(\)=>\{const chapter=validChapter/);
  assert.match(source, /data\.chapterSources=\{\.\.\.\(data\.chapterSources\|\|\{\}\),\[chapter\]:url\}/);
});

test("the timeline position and open profile (not just the selected volume) are persisted and restored across a refresh, with range/existence validation", () => {
  assert.match(source, /function cacheActiveVolume\(\)\{try\{localStorage\.setItem\(VIEW_STATE_KEY,JSON\.stringify\(\{activeVolume,currentChapter,currentActionIndex,openProfileId\}\)\)/);
  const restoreBody = functionBody("restoreActiveVolume");
  assert.match(restoreBody, /inRange=vol&&Number\.isFinite\(cached\.currentChapter\)&&cached\.currentChapter>=vol\.from&&cached\.currentChapter<=vol\.to/);
  assert.match(restoreBody, /currentChapter=inRange\?cached\.currentChapter:\(vol\?\.from\|\|1\)/);
  assert.match(restoreBody, /openProfileId=typeof cached\.openProfileId==="string"&&entity\(cached\.openProfileId\)\?cached\.openProfileId:null/);
  assert.match(source, /function renderAll\(\)\{configureTimeline\(\);renderGraph\(\);renderSummary\(\);renderEvents\(\);renderQuests\(\);renderAdmin\(\);updateSuggestions\(\);cacheActiveVolume\(\);\}/);
});

test("closing the profile modal clears the persisted open-profile state, and starting the app reopens whatever profile was persisted", () => {
  assert.match(source, /\$\("#close-profile"\)\.onclick=\(\)=>\{\$\("#profile-modal"\)\.close\(\);openProfileId=null;cacheActiveVolume\(\);\}/);
  assert.match(source, /if\(openProfileId&&entity\(openProfileId\)\)openProfile\(openProfileId\);/);
  assert.match(source, /openProfileId=item\.id;cacheActiveVolume\(\);/);
});

test("a first-time explanation callout for chapter refs is shown once per browser and dismissed via its close button or by actually using the toggle", () => {
  assert.match(source, /id="chapter-ref-hint"/);
  assert.match(source, /CHAPTER_REF_HINT_SEEN_KEY/);
  assert.match(source, /function dismissChapterRefHint\(\)\{const hint=\$\("#chapter-ref-hint"\);if\(hint\)hint\.hidden=true;localStorage\.setItem\(CHAPTER_REF_HINT_SEEN_KEY,"1"\);\}/);
  assert.match(source, /if\(localStorage\.getItem\(CHAPTER_REF_HINT_SEEN_KEY\)!=="1"\)\{const hint=\$\("#chapter-ref-hint"\);if\(hint\)hint\.hidden=false;\}/);
  assert.match(source, /function toggleChapterRefs\(\)\{[^}]*dismissChapterRefHint\(\);\}/);
  assert.match(source, /\$\("#dismiss-chapter-ref-hint"\)\?\.addEventListener\("click"/);
});

test("gender and age are now event-tracked like status (can be revealed/changed at any chapter, with citation and link) instead of being static-only fields", () => {
  assert.match(source, /<option value="gender">Gender becomes known or changes<\/option>/);
  assert.match(source, /<option value="age">Age stated or changes<\/option>/);
  assert.match(source, /if \(event\.type === "gender" && source && event\.value\) source\.gender = event\.value;/);
  assert.match(source, /if \(event\.type === "age" && source && event\.value\) source\.age = event\.value;/);
  assert.match(source, /needsValue=\["alias","display_name","status","gender","age",/);
  assert.match(source, /if\(\["alias","display_name","identity_parent","status","gender","age",/);
});

test("the Gender and Age profile facts show a chapter citation (and link, if the event has one) once a reveal event exists, using the same ' | chapter | url' syntax richText already supports", () => {
  assert.match(source, /const citedFact=\(value,event\)=>event\?`\$\{value\} \| \$\{event\.chapter\}\$\{event\.sourceUrl\?` \| \$\{event\.sourceUrl\}`:""\}`:value;/);
  assert.match(source, /fact\("Gender",citedFact\(state\.gender,latestGenderEvent\)\)/);
  assert.match(source, /fact\("Age",citedFact\(state\.age,latestAgeEvent\)\)/);
});

test("Gender and Age history sections render on the profile alongside Status history, each entry individually cited", () => {
  assert.match(source, /\$\{genders\.length\?`<section><h3>Gender history<\/h3>\$\{proseList\(genders\.map\(event=>citedFact\(event\.value,event\)\)\)\}<\/section>`:""\}/);
  assert.match(source, /\$\{ages\.length\?`<section><h3>Age history<\/h3>\$\{proseList\(ages\.map\(event=>citedFact\(event\.value,event\)\)\)\}<\/section>`:""\}/);
});

test("citedFact produces a richText-compatible citation string that actually renders a chapter link", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  vm.runInContext(functionBody("richText"), ctx);
  const citedFact = (value, event) => event ? `${value} | ${event.chapter}${event.sourceUrl ? ` | ${event.sourceUrl}` : ""}` : value;
  const withoutSource = citedFact("Female", { chapter: 30 });
  const html1 = vm.runInContext(`richText(${JSON.stringify(withoutSource)})`, ctx);
  assert.match(html1, /Female<\/span><a class="chapter-citation" href="https:\/\/example\.com\/ch-30"/);
  const withSource = citedFact("Female", { chapter: 30, sourceUrl: "https://webnovel.example/ch30" });
  const html2 = vm.runInContext(`richText(${JSON.stringify(withSource)})`, ctx);
  assert.match(html2, /Female<\/span><a class="chapter-citation" href="https:\/\/webnovel\.example\/ch30"/);
  const noEvent = citedFact("male", null);
  assert.equal(noEvent, "male");
});

test("factsFromText finds the real Label: divider even when a [[cite:N]] marker's own colon appears earlier in the line — the exact reported bug", () => {
  const ctx = sandbox({});
  // Before the fix, indexOf(":") grabbed the colon inside [[cite:1]] itself,
  // producing label="[[cite" and a garbled value. The real divider must be
  // found after the bracket closes.
  const facts = JSON.parse(vm.runInContext(`JSON.stringify(factsFromText(${JSON.stringify("[[cite:1]]Age: 12 Elysian Cycle[[/cite]]")}))`, ctx));
  assert.equal(facts.length, 1);
  assert.doesNotMatch(facts[0].label, /^\[\[cite$/, "must not split on the marker's own colon");
});

test("factsFromText leaves ordinary Label: Value facts (including ones with a URL later in the value) working exactly as before", () => {
  const ctx = sandbox({});
  const facts = JSON.parse(vm.runInContext(`JSON.stringify(factsFromText(${JSON.stringify("Weapon: Twin Daggers\nWebsite: https://example.com/profile")}))`, ctx));
  assert.deepEqual(facts, [
    { label: "Weapon", value: "Twin Daggers" },
    { label: "Website", value: "https://example.com/profile" },
  ]);
});

test("the recommended simple form for citing a custom infobox fact — no zone syntax needed — renders a clean chapter citation", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const facts = JSON.parse(vm.runInContext(`JSON.stringify(factsFromText(${JSON.stringify("Age: 12 Elysian Cycle | 1")}))`, ctx));
  assert.deepEqual(facts, [{ label: "Age", value: "12 Elysian Cycle | 1" }]);
  const html = vm.runInContext(`fact(${JSON.stringify(facts[0].label)}, ${JSON.stringify(facts[0].value)})`, ctx);
  assert.match(html, /<dt>Age<\/dt><dd><span class="cited-prose-line"><span>12 Elysian Cycle<\/span><a class="chapter-citation" href="https:\/\/example\.com\/ch-1"/);
});

test("with the toggle on, clicking anywhere in a cited sentence zone navigates to its chapter source — not just the tiny floating badge — while an embedded word-link or the badge itself still takes priority", () => {
  assert.match(source, /document\.addEventListener\("click",event=>\{if\(!document\.body\.classList\.contains\("show-chapter-refs"\)\)return;if\(event\.target\.closest\("a"\)\)return;const zone=event\.target\.closest\("\.sentence-cite"\);if\(!zone\)return;const url=zone\.querySelector\("\.chapter-citation"\)\?\.getAttribute\("href"\);if\(url\)window\.open\(url,"_blank","noopener,noreferrer"\);\}\);/);
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref\.sentence-cite:hover:has\(\.chapter-citation:not\(\.uncited\)\)\{cursor:pointer\}/);
});

test("dragging a node pins it so the physics simulation stops pulling it back, and double-clicking a pinned node releases it", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /if\(dragMoved\)\{const p=physics\.pos\.get\(item\.id\);if\(p\)p\.pinned=true;\}else selectNode\(\);/);
  assert.match(body, /target\.addEventListener\("dblclick",event=>\{event\.stopPropagation\(\);const p=physics\.pos\.get\(item\.id\);if\(p\?\.pinned\)\{p\.pinned=false;/);
  assert.match(source, /if \(id === physics\.dragId \|\| physics\.pos\.get\(id\)\?\.pinned\) \{ physics\.calm\.set\(id,0\); return; \}/);
});

test("a node can be dragged from anywhere on it, including from its own name — a character's label covers the middle of its circle, so binding drag only to the shape left just the outer ring grabbable", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /const bindGestures=target=>\{/);
  assert.match(body, /target\.addEventListener\("pointerdown",event=>\{[^}]*physics\.dragId=item\.id;/);
  assert.match(body, /target\.addEventListener\("pointermove",event=>\{if\(physics\.dragId!==item\.id\)return;/);
  assert.match(body, /target\.setPointerCapture\(event\.pointerId\);/, "the element that started the drag must capture the pointer");
  assert.match(body, /group\.classList\.add\("dragging"\)/, "but the shape always carries the dragging state");
  assert.match(body, /bindGestures\(group\);bindGestures\(labelGroup\);/);
  assert.match(styleSource, /\.node-labels > \* \{ pointer-events: painted; \}/);
});

function locationView({ entities, parents, expanded = [], visible }) {
  const helperSource = [
    source.match(/^const LOCATION_ROOT_TYPE=.*$/m)[0],
    source.match(/^const LOCATION_TIER_RADIUS=.*$/m)[0],
    "var ENTITIES=new Map(__entities.map(item=>[item.id,item]));",
    "function entity(id){return ENTITIES.get(id)||null;}",
    "var expandedLocations=new Set(__expanded);",
    "var derived={locationParents:__parents};",
    functionBody("isLocationRoot"),
    functionBody("locationParentOf"),
    functionBody("buildLocationView"),
    functionBody("buildDrillView"),
    functionBody("renderedSubtree"),
    functionBody("locationGlyphRadius"),
  ].join("\n");
  const ctx = { __entities: entities, __parents: parents, __expanded: expanded };
  vm.createContext(ctx);
  vm.runInContext(helperSource, ctx);
  vm.runInContext(`var view=buildLocationView(derived,new Set(${JSON.stringify(visible)}));`, ctx);
  const read = expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, ctx));
  return {
    ctx,
    read,
    rendered: read("[...view.rendered].sort()"),
    opened: read("[...view.expanded].sort()"),
    anchorOf: read("Object.fromEntries(view.anchorOf)"),
    childrenOf: read("Object.fromEntries(view.children)"),
    parentOf: read("Object.fromEntries(view.parentOf)"),
  };
}

const NESTED_WORLD = {
  entities: [
    { id: "cosmos", kind: "location", locationType: "Universe", name: "Cosmos" },
    { id: "realm", kind: "location", locationType: "Realm", name: "Azure Realm" },
    { id: "world", kind: "location", locationType: "World", name: "Verdan" },
    { id: "city", kind: "location", locationType: "City", name: "Stonevale" },
    { id: "inn", kind: "location", locationType: "Site", name: "The Inn" },
    { id: "lex", kind: "character", name: "Lex" },
  ],
  parents: [
    { child: "realm", parent: "cosmos" },
    { child: "world", parent: "realm" },
    { child: "city", parent: "world" },
    { child: "inn", parent: "city" },
  ],
  visible: ["cosmos", "realm", "world", "city", "inn", "lex"],
};

test("a realm is the widest place the graph draws: it ignores any parent above it, and everything nested inside stays folded away until the realm is opened", () => {
  const view = locationView(NESTED_WORLD);
  assert.equal(view.parentOf.realm, null, "a realm never reports a parent, so nothing above it can be drawn");
  assert.deepEqual(view.rendered, ["cosmos", "realm"], "only top-level places are drawn while everything is closed");
  assert.deepEqual(view.childrenOf.cosmos, [], "the realm is not treated as a child of the universe above it");
  assert.deepEqual(view.childrenOf.realm, ["world"]);
});

test("every place folded inside a closed parent reports through that parent, so the parent carries all of its children's connections", () => {
  const view = locationView(NESTED_WORLD);
  assert.equal(view.anchorOf.world, "realm");
  assert.equal(view.anchorOf.city, "realm");
  assert.equal(view.anchorOf.inn, "realm", "a place four levels down still connects through the realm on screen");
  const body = functionBody("renderGraph");
  assert.match(body, /const resolveLocationId=id=>entity\(id\)\?\.kind==="location"\?\(locView\.anchorOf\.get\(id\)\|\|id\):id;/);
  assert.match(body, /const target=edgeLocationId\(to\);if\(!target\|\|from===target\)return;/);
});

test("opening a place moves the drill-down one level down: its children are drawn and now carry the connections that used to roll up to it", () => {
  const view = locationView({ ...NESTED_WORLD, expanded: ["realm"] });
  assert.deepEqual(view.rendered, ["cosmos", "realm", "world"]);
  assert.deepEqual(view.opened, ["realm"], "the opened parent is the one drawn as a dot");
  assert.equal(view.anchorOf.city, "world", "the child that came out now owns the connections below it");
  assert.equal(view.anchorOf.inn, "world");
  const deeper = locationView({ ...NESTED_WORLD, expanded: ["realm", "world"] });
  assert.deepEqual(deeper.rendered, ["city", "cosmos", "realm", "world"]);
  assert.deepEqual(deeper.opened, ["realm", "world"], "a child with children of its own opens the same way");
  assert.equal(deeper.anchorOf.inn, "city");
});

test("a place with no revealed children is never drawn as a dot, and closing a parent takes its whole opened subtree with it", () => {
  const view = locationView({ ...NESTED_WORLD, expanded: ["realm", "world", "city"] });
  assert.deepEqual(view.opened, ["city", "realm", "world"]);
  assert.deepEqual(view.read('renderedSubtree("realm",view).sort()'), ["city", "inn", "world"]);
  const leafOpen = locationView({ ...NESTED_WORLD, expanded: ["inn"], visible: ["realm", "inn"] });
  assert.deepEqual(leafOpen.opened, [], "opening a place that contains nothing revealed is a no-op");
});

test("a place skips ancestors the reader has not met yet, so a deep location still attaches to the closest place actually on screen", () => {
  const view = locationView({ ...NESTED_WORLD, visible: ["realm", "inn", "lex"] });
  assert.equal(view.parentOf.inn, "realm", "Stonevale and Verdan are unrevealed, so the Inn hangs straight off the realm");
  assert.deepEqual(view.rendered, ["realm"]);
  assert.equal(view.anchorOf.inn, "realm");
});

test("place glyphs stay in the same size band as characters — a realm never swallows the graph the way the old ellipse regions did", () => {
  const view = locationView({ ...NESTED_WORLD, expanded: ["realm", "world"] });
  const sizes = ["realm", "world", "city"].map(id => view.read(`locationGlyphRadius(${JSON.stringify(id)},view)`));
  assert.ok(sizes.every(size => size >= 17 && size <= 34), `place glyph radii stayed small: ${sizes.join(", ")}`);
  assert.ok(sizes[0] > sizes[2], "wider tiers still read as bigger, just not by orders of magnitude");
  assert.doesNotMatch(source, /class:"location-region"/, "the venn-style ellipse regions are gone");
  assert.doesNotMatch(source, /physics\.exclusions/, "and so is the force that shoved unrelated nodes out of those ellipses");
});

test("clicking a place cycles select -> open into a dot -> close, and the dot itself is the close control rather than a second selection", () => {
  const body = functionBody("activateLocation");
  assert.match(body, /if\(view\.expanded\.has\(id\)\)\{closeLocation\(id\);return;\}/);
  assert.match(body, /if\(selectedId===id&&\(view\.children\.get\(id\)\|\|\[\]\)\.length\)\{openLocation\(id\);return;\}/);
  assert.match(functionBody("openLocation"), /expandedLocations\.add\(id\);selectedId=null;/);
  const closeBody = functionBody("closeLocation");
  assert.match(closeBody, /collapsingLocationId=id;renderAll\(\);/, "the retract animation runs before the children are actually removed");
  assert.match(closeBody, /subtree\.forEach\(child=>\{expandedLocations\.delete\(child\);/, "closing a parent also closes everything opened inside it");
  assert.match(functionBody("renderGraph"), /if\(item\.kind==="location"\)\{activateLocation\(item\.id\);return;\}/);
});

test("children scale out of the dot when a place opens and shrink back into it when it closes", () => {
  assert.match(styleSource, /\.node\.location-emerging \.location-shell\{animation:location-emerge/);
  assert.match(styleSource, /@keyframes location-emerge\{0%\{transform:scale\(\.05\);opacity:0\}/);
  assert.match(styleSource, /\.node\.location-retracting \.location-shell\{animation:location-retract/);
  assert.match(styleSource, /@keyframes location-retract\{0%\{transform:scale\(1\);opacity:1\}70%\{opacity:\.45\}100%\{transform:scale\(\.06\);opacity:0\}\}/);
});

test("an action that names a place hidden inside a closed parent pops it out as a round pod, which sinks back into that parent once the action moves on", () => {
  const body = functionBody("renderLocationPods");
  assert.match(functionBody("eventPodIds"), /return \[\.\.\.new Set\(named\)\]\.filter\(id=>view\.present\.has\(id\)&&!view\.rendered\.has\(id\)&&view\.anchorOf\.get\(id\)\);/);
  assert.match(functionBody("syncPodTransitions"), /if\(gone\.length\)\{retiringPodIds=gone;clearTimeout\(podRetireTimer\);podRetireTimer=setTimeout\(\(\)=>\{retiringPodIds=\[\];podRetireTimer=null;renderGraph\(\);\},POD_TRAVEL_MS\);\}/);
  assert.match(body, /retiringPodIds\.filter\(id=>!podIds\.includes\(id\)\)\.forEach\(id=>draw\(id,true\)\);/);
  assert.match(styleSource, /@keyframes pod-emerge\{0%\{transform:scale\(\.02\);opacity:0\}100%\{transform:scale\(1\);opacity:1\}\}/, "the swell is CSS; the travel is JS so an attached line rides with it");
  assert.match(styleSource, /@keyframes pod-retract\{0%\{transform:scale\(1\);opacity:1\}100%\{transform:scale\(\.05\);opacity:0\}\}/);
});

function pureSandbox(names) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(names.map(name => functionBody(name)).join("\n"), ctx);
  return expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, ctx));
}

test("names are drawn in their own layer above every shape, so a node can never be painted over another node's label", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /viewportGroup\.append\(edgeLayer,departLayer,nodeLayer,satelliteLayer,conversationLayer,labelLayer,podLayer\);/, "labels sit above everything, including the conversation and system markers");
  assert.match(body, /labelLayer\.appendChild\(labelGroup\);labelEls\.set\(item\.id,\{group:labelGroup,text:label,offset:labelY,kind:item\.kind,tall:Boolean\(rankLabel\),halfWidth:/);
  assert.match(body, /labelEls\.forEach\(\(entry,id\)=>\{const box=\(entry\.tall\?entry\.group:entry\.text\)\.getBBox\(\);if\(!box\.width\)return;entry\.halfWidth=box\.width\/2;/, "and the boxes the forces use are the measured ones, not a guess from character count");
  assert.doesNotMatch(body, /\(locationShell\|\|group\)\.appendChild\(label\)/, "labels must not go back inside the node group");
  assert.match(styleSource, /\.node-label-layer \{ pointer-events: none; \}/);
});

test("the layout runs on a budget, so a busy action cannot leave the graph drifting for seconds", () => {
  const body = functionBody("stepPhysics");
  assert.match(source, /const ALPHA_DECAY = 0\.9, ALPHA_FLOOR = 0\.02, ALPHA_CONTACT = 0\.3;/);
  assert.match(body, /if \(physics\.alpha < ALPHA_FLOOR && !physics\.dragId\) return;/, "below the floor it stops dead rather than drifting");
  assert.match(body, /physics\.alpha = physics\.dragId \? 1 : physics\.alpha \* ALPHA_DECAY;/, "every frame cools it");
  assert.match(body, /if\(d<ra\+rb\)\{overlapping\.add\(ids\[i\]\);overlapping\.add\(ids\[j\]\);\}/, "only shapes genuinely on top of each other reheat it — the comfort gap kept it awake for ever");
  assert.match(body, /if \(overlapping\.size\) physics\.alpha = Math\.max\(physics\.alpha, ALPHA_CONTACT\);/);
  assert.match(functionBody("renderGraph"), /departingGhosts=\[\]; physics\.alpha=1;/, "and a change heats it again");
  assert.match(body, /const scaleCount = Math\.round\(ids\.length\/8\)\*8;/, "the strength constants step in eights, so they do not shift the whole balance for one arrival");
  assert.match(body, /calm = touching \? 0 : Math\.max\(0, Math\.min\(1, \(physics\.calm\.get\(id\)\|\|0\) \+ \(speed < 1\.2 \? \.04 : -\.3\)\)\)/, "and a node that has been sitting still takes a fraction of the force");
});

test("shapes are pushed apart by their real radii, not just by inverse-square repulsion which let them settle on top of each other", () => {
  const body = functionBody("stepPhysics");
  assert.match(body, /const ra=physics\.radii\.get\(ids\[i\]\)\|\|24,rb=physics\.radii\.get\(ids\[j\]\)\|\|24,clearance=ra\+rb\+SEPARATION_GAP;/);
  assert.match(body, /if\(d<clearance\)\{const push=Math\.min\(6,\(clearance-d\)\*\.24\);/);
  assert.match(functionBody("renderGraph"), /visible\.forEach\(item=>physics\.radii\.set\(item\.id,nodeRadiusFor\(item,derived\.states\.get\(item\.id\),locView,currentChapter,sysView\)\)\);/);
});

test("label text keeps a readable size across the zoom range instead of ballooning when zoomed out", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext("var view={scale:1};\n" + functionBody("labelScale"), ctx);
  const measure = scale => { ctx.view.scale = scale; return vm.runInContext("labelScale()", ctx); };
  assert.equal(measure(1), 1);
  assert.ok(measure(0.35) <= 1.25, "zoomed far out, text must not balloon over the graph");
  assert.ok(measure(3) >= 0.8, "zoomed far in, text must not collapse");
  assert.ok(measure(0.8) > measure(1.4), "text still grows as the view shrinks, within those bounds");
});

test("a crowded graph hands out only a few names; a small one keeps every name", () => {
  const run = pureSandbox(["labelBudget"]);
  assert.ok(run("labelBudget(7)") >= 7, "a seven-node graph labels everything");
  assert.ok(run("labelBudget(20)") >= 20, "a twenty-node graph still labels everything");
  assert.ok(run("labelBudget(67)") < 20, "a sixty-seven node graph labels only the highest-ranked few");
  assert.equal(run("labelBudget(400)"), 9, "the budget bottoms out rather than reaching zero");
  const body = functionBody("updateLabelVisibility");
  assert.match(body, /focused=classes\.contains\("selected"\)\|\|classes\.contains\("event-active-node"\)\|\|classes\.contains\("hover-focus"\)/);
  assert.match(body, /linked=classes\.contains\("selected-neighbor"\)\|\|classes\.contains\("hover-neighbor"\)/);
  assert.match(body, /let visible=item\.focused\|\|\(item\.linked\|\|!zoomedOut\|\|item\.rank>=3\)&&\(item\.linked\|\|spent<budget\)/, "what the reader is looking at always keeps its name; its neighbours skip the budget");
  assert.match(body, /const budget=labelBudget\(entries\.length\),crowded=entries\.length>10/, "a small graph never hides a name — the separation forces have room to sort it out");
  assert.match(body, /if\(visible&&crowded&&!item\.focused\)visible=!placed\.some\(other=>Math\.abs\(other\.x-item\.x\)<other\.hw\+item\.hw&&Math\.abs\(other\.y-item\.y\)<other\.hh\+item\.hh\)/, "on a crowded one, a name that would land on one already placed is dropped");
});

test("a culled name is actually invisible — its rule outranks the action, selection and hover focus rules that force opacity onto every .node", () => {
  assert.match(styleSource, /#graph \.node-label-layer \.node-labels\.label-culled \{ opacity: 0 !important; \}/);
  assert.match(styleSource, /#graph \.graph-viewport\.has-hover-focus:not\(\.has-selection-focus\) \.node:not\(\.hover-focus\):not\(\.hover-neighbor\):not\(\.label-culled\)\{opacity:\.12!important/);
});

test("hovering a node lifts it and its links out of the web, and outranks the action spotlight but not a pinned selection", () => {
  const body = functionBody("setHoverNode");
  assert.match(body, /node\.classList\.toggle\("hover-focus",Boolean\(id\)&&node\.dataset\.id===id\)/);
  assert.match(body, /edge\.classList\.toggle\("hover-connection",Boolean\(id\)&&\(edge\.dataset\.a===id\|\|edge\.dataset\.b===id\)\)/);
  assert.match(body, /viewportGroup\?\.classList\.toggle\("has-hover-focus",Boolean\(id\)\);/);
  assert.match(styleSource, /#graph \.graph-viewport\.has-hover-focus:not\(\.has-selection-focus\)/, "a pinned selection still wins");
  assert.doesNotMatch(styleSource, /has-hover-focus:not\(\.has-selection-focus\):not\(\.has-action-focus\)/, "but the action spotlight must not suppress hover — it is on for almost every action");
  assert.match(functionBody("renderGraph"), /target\.addEventListener\("pointerenter",\(\)=>setHoverNode\(item\.id\)\);/);
});

test("once the simulation settles the view fits the real layout, and any zoom or pan by the reader stops it moving under them", () => {
  const body = functionBody("fitGraphToContent");
  assert.match(body, /scale=Math\.max\(\.3,Math\.min\(1\.3,Math\.min\(\(720-padding\*2\)\/width,\(520-padding\*2\)\/height\)\)\)/);
  assert.match(body, /target=\{scale,x:360-\(minX\+maxX\)\/2\*scale,y:260-\(minY\+maxY\)\/2\*scale\}/);
  assert.match(functionBody("scheduleAutoFit"), /if\(!viewPinnedByUser&&!physics\.dragId\)fitGraphToContent\(\)/);
  assert.match(source, /function zoomBy\(factor, atX = 360, atY = 260\) \{\n  viewPinnedByUser = true;/);
  assert.match(source, /if\(!panStart\)return;viewPinnedByUser=true;/);
});

test("a name never settles on top of another node's shape, which is what still read as cramped once label-versus-label separation was in", () => {
  const body = functionBody("stepPhysics");
  assert.match(body, /const clearLabelOfShape=\(labelPos,labelBox,shapePos,shapeRadius,labelForce,shapeForce\)=>\{/);
  assert.match(body, /overlapX=labelBox\.hw\+shapeRadius\+14-Math\.abs\(dx\),overlapY=labelBox\.hh\+shapeRadius\+12-Math\.abs\(dy\)/);
  assert.match(body, /clearLabelOfShape\(a,ab,b,rb,fa,fb\);clearLabelOfShape\(b,bb,a,ra,fb,fa\);/, "both directions, so neither node's name camps on the other");
  assert.match(body, /push=Math\.min\(3\.5,\.085\*overlapX\)/, "proportional, with no constant floor — a floor never reaches zero and the layout trembles instead of settling");
});

test("two names that meet in the gap between their nodes slide apart sideways, because separating them vertically would drag the shapes together and the clearance force would just undo it", () => {
  const body = functionBody("stepPhysics");
  assert.match(body, /const opposed=\(a\.y-b\.y\)\*labelDy<0;if\(opposed\|\|overlapX<overlapY\)\{const direction=labelDx>=0\?1:-1/);
});

test("spring rest lengths clear both nodes, so a link can never pull two shapes inside the distance the separation force insists on — the tug of war between them was the source of the shivering", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /const restLength=\(a,b,desired\)=>Math\.max\(desired,\(physics\.radii\.get\(a\)\|\|24\)\+\(physics\.radii\.get\(b\)\|\|24\)\+SEPARATION_GAP\+8\)/);
  assert.match(body, /addSpring=\(a,b,desired,strength\)=>\{[^}]*const length=restLength\(a,b,desired\)/);
  assert.match(functionBody("stepPhysics"), /if \(Math\.abs\(v\.x\) < REST_SPEED && Math\.abs\(v\.y\) < REST_SPEED\) \{ v\.x = 0; v\.y = 0; return; \}/, "and near-zero motion is snapped to rest so the graph stops moving entirely");
});

test("a place a character is standing in keeps the line while it is popped out, and the line rides back into the parent as the pod retracts rather than snapping across", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /const podIds=syncPodTransitions\(locView,currentEvent\),podSet=new Set\(\[\.\.\.podIds,\.\.\.retiringPodIds\]\)/, "retracting pods stay valid endpoints so the line can follow them home");
  assert.ok(body.indexOf("syncPodTransitions(locView") < body.indexOf("const straightEdge="), "and the transition is decided before any link is drawn, or the line snaps home a render early");
  assert.match(body, /const edgeLocationId=id=>entity\(id\)\?\.kind!=="location"\?id:\(podSet\.has\(id\)\?id:\(locView\.anchorOf\.get\(id\)\|\|id\)\)/);
  assert.match(body, /const aPos=pointFor\(a\),bPos=pointFor\(b\)/, "edges resolve pod positions as well as physics positions");
  assert.match(functionBody("renderLocationPods"), /eased=retiring\?1-progress\*\*3:1-\(1-progress\)\*\*3/, "the travel is driven in JS so an attached line moves with it");
  assert.match(functionBody("renderLocationPods"), /origin=origins\.get\(id\)\|\|base,\s*x=origin\.x\+\(target\.x-origin\.x\)\*eased/, "and a pod standing in for a node just folded away sets off from where that node stood");
  assert.match(functionBody("pointFor"), /return physics\.pos\.get\(id\)\|\|physics\.podPos\.get\(id\)\|\|physics\.hubPos\.get\(id\)\|\|null;/);
});

test("an action that merely names a place — a meeting, a note — still draws everyone it involves to that place while it is showing", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /if\(currentEvent\?\.location&&entity\(currentEvent\.location\)\?\.kind==="location"&&!\["movement","residency","organization_location","location_parent"\]\.includes\(currentEvent\.type\)\)/, "the link types that already draw their own line are left alone");
  assert.match(body, /locationCharacterIds\(currentEvent\)\.forEach\(who=>\{noteEdge\(who,place,currentEvent\.chapter,"Here for this action"\);straightEdge\(who,place,"edge location-edge event-place-edge newly-revealed-edge",who,place\);\}\)/);
});

test("the view eases into a new framing instead of jumping, and a reader's own zoom or pan drops the tween immediately", () => {
  assert.match(functionBody("glideViewTo"), /viewTween=\{from:\{x:view\.x,y:view\.y,scale:view\.scale\},to:target,start:performance\.now\(\),duration\}/);
  assert.match(functionBody("stepViewTween"), /eased=progress<\.5\?4\*progress\*\*3:1-\(-2\*progress\+2\)\*\*3\/2/);
  assert.match(functionBody("fitGraphToContent"), /if\(Math\.abs\(target\.scale-view\.scale\)<\.07&&Math\.hypot\(target\.x-view\.x,target\.y-view\.y\)<46\)return;/, "and a framing that has not really outgrown the frame is left alone rather than re-zoomed");
  assert.match(functionBody("fitGraphToCount"), /const signature=`\$\{activeVolume\}`;/, "the seeded scale is guessed once per volume, not re-guessed on every action");
  assert.match(functionBody("scheduleAutoFit"), /autoFitTimers=\[1100\]\.map/, "and one settling refit, not two that fight each other");
  assert.match(source, /viewPinnedByUser = true; viewTween = null;/);
  assert.match(source, /if\(!panStart\)return;viewPinnedByUser=true;viewTween=null;/);
  assert.match(functionBody("tickGraph"), /stepViewTween\(\);/);
});

test("hovering a link answers which chapter that connection last changed in, hit-tested in script so a thin line stays thin", () => {
  assert.match(functionBody("edgeUnderPoint"), /let best=null,bestDistance=15\/Math\.max\(\.2,view\.scale\)/, "the reachable band is in screen terms, so it does not shrink as you zoom out");
  assert.match(functionBody("showEdgeTip"), /Last changed · Chapter \$\{entry\.chapter\}/);
  assert.match(source, /if\(physics\.dragId\|\|panStart\|\|event\.target\.closest\("\.node,\.location-pod"\)\)\{hideEdgeTip\(\);return;\}/, "dragging, panning and hovering a node all suppress it");
  const body = functionBody("renderGraph");
  assert.match(body, /const noteEdge=\(a,b,chapter,note\)=>\{if\(a&&b&&a!==b&&chapter\)edgeIndex\.push\(\{a,b,chapter:Number\(chapter\),note\}\);\}/);
  assert.match(body, /locationEdge\(character,visit\.location,"location-edge",[^,]*,visit\.chapter,"Travelled here"\)/, "travel");
  assert.match(body, /noteEdge\(m\.character,m\.organization,m\.from/, "membership");
  assert.match(body, /noteEdge\(child,parent,link\.from,"Sits inside"\)/, "location nesting");
  assert.match(source, /pair\.from = event\.chapter;/, "awareness had no chapter of its own to report until now");
});

test("event order is edited one chapter at a time, which is what keeps it usable at a couple of thousand chapters", () => {
  const body = functionBody("renderOrderEditor");
  assert.match(body, /const rows=orderedEvents\(\)\.filter\(event=>Number\(event\.chapter\)===orderChapter\)/, "never lists more than one chapter");
  assert.match(functionBody("chaptersWithEvents"), /\[\.\.\.new Set\(data\.events\.map\(event=>Number\(event\.chapter\)\)\)\]/, "and steps through only the chapters that have events");
  assert.match(body, /grip\.addEventListener\("pointerdown"/, "drag by handle");
  assert.match(body, /before=others\.find\(row=>\{const box=row\.getBoundingClientRect\(\);return moveEvent\.clientY<box\.top\+box\.height\/2;\}\)/, "dropping is decided by row midpoints");
  assert.match(body, /window\.addEventListener\("pointermove",move\);window\.addEventListener\("pointerup",finish\)/, "tracked on the window — reordering moves the handle through the DOM, which drops a pointer capture");
  assert.match(body, /list\.querySelectorAll\("\.order-up"\)\.forEach\(button=>button\.onclick=\(\)=>swap\(button\.dataset\.id,-1\)\)/, "with arrow buttons as the keyboard-reachable path");
  assert.match(functionBody("commitEventOrder"), /ids\.forEach\(\(id,index\)=>\{const record=data\.events\.find\(event=>event\.id===id\);if\(record\)record\.order=index\+1;\}\)/);
});

test("a node's radius is settled once, before the springs and the separation force need it — clearing the map after filling it left every shape asking for the fallback size, so big characters walked straight through each other", () => {
  const body = functionBody("renderGraph");
  const filled = body.indexOf("visible.forEach(item=>physics.radii.set(item.id,nodeRadiusFor(");
  assert.ok(filled > 0, "radii are filled from the same rule the renderer draws with");
  assert.ok(body.indexOf("const restLength=") > filled, "springs read them");
  assert.equal(body.split("physics.radii.clear()").length - 1, 1, "and nothing clears the map a second time");
  assert.match(functionBody("stepPhysics"), /const ra=physics\.radii\.get\(ids\[i\]\)\|\|24,rb=physics\.radii\.get\(ids\[j\]\)\|\|24,clearance=ra\+rb\+SEPARATION_GAP;/);
});

test("a crowd sharing one place gets a ring wide enough to hold it, rather than everyone being pulled onto a circle with no room", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /hubMembers\.forEach\(\(members,hub\)=>\{[\s\S]*?circumference\+=2\*\(physics\.radii\.get\(id\)\|\|24\)\+SEPARATION_GAP;[\s\S]*?hubRing\.set\(hub,circumference\/\(2\*Math\.PI\)\)/);
  assert.match(body, /hubLinks\.forEach\(link=>addSpring\(link\.member,link\.hub,Math\.max\(link\.desired,hubRing\.get\(link\.hub\)\|\|0\),link\.strength\)\)/);
});

test("the chapter's actions are all listed and scrollable, and hovering the list holds the auto-advance so it can be read at the reader's pace", () => {
  const body = functionBody("renderEvents");
  assert.match(body, /const chapterRows=volumeActions\(\)\.map\(\(item,index\)=>\(\{event:item,index:index\+1\}\)\)\.filter\(entry=>entry\.event\.chapter===event\.chapter\)/);
  assert.match(body, /upcoming:entry\.index>currentActionIndex/, "actions not yet reached are shown but marked");
  assert.match(body, /if\(!eventScrollHold\)requestAnimationFrame\(\(\)=>list\.querySelector\("\.current-action"\)\?\.scrollIntoView\(\{block:"nearest"\}\)\)/, "and the list does not yank itself while the reader is in it");
  assert.match(functionBody("scheduleChapterSequence"), /if\(expandedChapter!==null\|\|eventScrollHold\)return;/);
  assert.match(source, /autoplayHeldByHover=Boolean\(chapterAutoplayTimer\);cancelChapterSequence\(\)/, "only resumes if it was actually playing when the pointer arrived");
  assert.match(source, /eventsCard\.addEventListener\("pointerleave",release\)/);
  assert.match(styleSource, /\.events-list \{[^}]*overflow-y: auto/);
  assert.match(styleSource, /\.events-list > \.upcoming-action \{ opacity: \.5; \}/);
});

test("progression ladders are data the author types in, not a hardcoded tier list — a story can run cultivation, an authority grade from G to S, or both at once", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext([
    "var data={progressionTracks:[{id:'cultivation',name:'Cultivation',levels:['Mortal','Qi Training']},{id:'authority',name:'Authority',levels:['G','F','S-','S','S+','Divine']}]};",
    "function deepClone(v){return JSON.parse(JSON.stringify(v));}",
    "var CULTIVATION_LEVELS=['Mortal'];",
    functionBody("progressionTracks"),
    functionBody("trackFor"),
    functionBody("trackLevels"),
    functionBody("trackName"),
    functionBody("trackIdOf"),
    functionBody("cultivationCanonical"),
    functionBody("radius"),
  ].join("\n"), ctx);
  const run = expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, ctx));
  assert.deepEqual(run("trackLevels('authority')"), ["G","F","S-","S","S+","Divine"]);
  assert.equal(run("cultivationCanonical({track:'authority',level:6})"), "Divine");
  assert.equal(run("cultivationCanonical({track:'cultivation',level:2})"), "Qi Training");
  assert.equal(run("trackIdOf({track:'nope'})"), "cultivation", "an unknown track falls back rather than breaking");
  const top = run("radius({track:'authority',level:6})"), topShort = run("radius({track:'cultivation',level:2})");
  assert.equal(top, topShort, "the top of any ladder draws the same size, however many rungs it has");
  assert.ok(run("radius({track:'authority',level:1})") < top);
  assert.match(source, /record\.track=String\(form\.get\("track"\)\|\|progressionTracks\(\)\[0\]\.id\)/, "and the chosen track is stored on the event");
});

test("renaming or reordering a ladder keeps existing events pointing at the same rung by name", () => {
  assert.match(source, /const oldLadder=before\.get\(trackIdOf\(record\)\)\|\|\[\],name=oldLadder\[\(Number\(record\.level\)\|\|1\)-1\],ladder=trackLevels\(trackIdOf\(record\)\)/);
  assert.match(source, /record\.level=moved>=0\?moved\+1:Math\.min\(Math\.max\(1,Number\(record\.level\)\|\|1\),ladder\.length\)/, "a rung that disappears clamps instead of dangling");
});

test("every action's message can be edited where the actions are listed, including the ones the identity form generates", () => {
  const body = functionBody("renderOrderEditor");
  assert.match(body, /<input class="order-message" data-id="\$\{escapeHtml\(event\.id\)\}"/);
  assert.match(body, /field\.onchange=\(\)=>\{const record=data\.events\.find\(event=>event\.id===field\.dataset\.id\);if\(!record\)return;record\.description=field\.value\.trim\(\);saveData\(\)/);
  assert.match(body, /list\.querySelectorAll\("\.order-edit"\)\.forEach\(button=>button\.onclick=\(\)=>loadEventEditor\(button\.dataset\.id\)\)/);
});

test("a character moving on only replaces where they are — leaving one place for another is a single action", () => {
  assert.match(source, /if\(event\.type==="movement"&&source\?\.kind==="character"\)locations\.set\(event\.source,\{character:event\.source,location:event\.location/, "keyed by character, so the previous place is dropped automatically");
});

test("a system stands on the graph as soon as the story touches it, but the places it runs at wait until it or its host is picked out", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /queue=\[\.\.\.visibleIds\]\.filter\(id=>entity\(id\)\?\.kind==="system"\)/, "no selection needed — an action that names a system puts it on screen");
  assert.match(body, /derived\.systemHosts\.forEach\(link=>\{if\(visibleIds\.has\(link\.host\)\)queue\.push\(link\.system\);\}\)/, "and a host on screen brings whatever they carry");
  assert.match(body, /derived\.systemHosts\.filter\(link=>link\.host===selectedId\)\.forEach\(link=>\{queue\.push\(link\.system\);focusSystems\.add\(link\.system\);autoOpenSystems\.add\(link\.system\);\}\)/, "picking the host is what opens the system out — subsystems become nodes and their places come with them");
  assert.match(body, /if\(cursor&&entity\(cursor\)\?\.kind==="system"\)\{queue\.push\(cursor\);focusSystems\.add\(cursor\);\}/, "selecting a system — even one that was swallowed — keeps its line up");
  assert.match(body, /const kind=entity\(id\)\?\.kind;if\(kind==="system"\|\|kind==="quest"\)return false;/, "a system still comes in through the system view, so the drill-down holds — and a quest is a record, never a node");
  assert.match(body, /sysView\.rendered\.forEach\(id=>renderIds\.add\(id\)\)/);
  assert.match(body, /focusSystems\.forEach\(id=>\{if\(revealedSystems\.has\(id\)\)derived\.systemLocations\.filter\(link=>link\.system===id\)\.forEach\(link=>visibleIds\.add\(link\.location\)\)\;\}\)/, "the places it operates at are the part that stays folded away");
  assert.match(body, /derived\.systemLocations\.forEach\(link=>\{if\(!focusSystems\.has\(link\.system\)\)return;/, "and those lines are not drawn either, unlike a place's, which show whenever anyone connected is up");
});

test("a system drills down exactly like a place, sharing one tree builder, and opening one never disturbs the selection that revealed it", () => {
  assert.match(functionBody("buildLocationView"), /return buildDrillView\(\[\.\.\.visibleIds\]\.filter\(id=>entity\(id\)\?\.kind==="location"\),id=>locationParentOf\(id,derived\),expandedLocations\)/);
  assert.match(functionBody("buildSystemView"), /return buildDrillView\(\[\.\.\.systemIds\],id=>parentOf\.get\(id\)\|\|null,expanded\)/);
  assert.match(functionBody("buildSystemView"), /expanded=alsoExpanded&&alsoExpanded\.size\?new Set\(\[\.\.\.expandedSystems,\.\.\.alsoExpanded\]\):expandedSystems/, "a subsystem acting this beat is shown for it, then folds back on its own");
  assert.match(functionBody("renderGraph"), /const sysView=buildSystemView\(derived,revealedSystems,autoOpenSystems\)/);
  const activate = functionBody("activateSystem");
  assert.match(activate, /if\(view\.expanded\.has\(id\)\)\{closeSystem\(id\);return;\}/);
  assert.match(activate, /if\(selectedId===id&&\(view\.children\.get\(id\)\|\|\[\]\)\.length\)\{openSystem\(id\);return;\}/);
  assert.match(activate, /selectedId=id;setMobilePanel\("info"\);renderAll\(\);/, "the first click selects it, which is how its own history is reached");
  assert.match(functionBody("renderGraph"), /if\(item\.kind==="system"\)\{activateSystem\(item\.id\);return;\}/);
});

test("a system subtree revealed by a selection counts as part of that focus, so its links to places are not dimmed away", () => {
  assert.match(functionBody("applyGraphFocus"), /revealedSystems=lastSystemView\?lastSystemView\.rendered:new Set\(\)/);
  assert.match(functionBody("applyGraphFocus"), /revealedSystems\.has\(edge\.dataset\.a\)\|\|revealedSystems\.has\(edge\.dataset\.b\)/);
});

test("systems carry a host, a parent system and any number of places, and are drawn as something no other kind looks like", () => {
  assert.match(source, /if\(event\.type==="system_host"&&source\?\.kind==="system"&&states\.get\(event\.target\)\?\.kind==="character"\)/);
  assert.match(source, /if\(event\.type==="system_parent"&&source\?\.kind==="system"&&states\.get\(event\.target\)\?\.kind==="system"\)/);
  assert.match(source, /if\(event\.type==="system_location"&&source\?\.kind==="system"&&states\.get\(event\.location\)\?\.kind==="location"\)/, "many places per system — keyed by system and place together");
  assert.match(source, /<option value="system">System<\/option>/);
  assert.match(functionBody("renderGraph"), /class:"system-shape"/);
  assert.match(styleSource, /\.system-shape \{ fill: rgba\(46,28,78,\.92\); stroke: #b98cff/);
  assert.match(source, /if\(type==="system_parent"&&source\.id===target\?\.id\)\{toast\("A system cannot be its own subsystem"\)/);
});

test("a conversation is one action covering everyone in it, not a pile of pairwise meetings", () => {
  assert.match(source, /<option value="conversation">Conversation between characters<\/option>/);
  assert.match(source, /const talkers=\[\.\.\.new Set\(\[event\.source,\.\.\.\(event\.characters\|\|\[\]\)\]\)\]\.filter\(id=>states\.get\(id\)\?\.kind==="character"\)/);
  assert.match(source, /talkers\.forEach\(\(a,index\)=>talkers\.slice\(index\+1\)\.forEach\(b=>\{if\(!meetings\.has\(pairKey\(a,b\)\)\)meetings\.set\(pairKey\(a,b\),event\)/, "everyone in it counts as having met everyone else");
  const record = functionBody("buildEventRecord");
  assert.match(record, /if\(talkers\.length<2\)\{toast\("A conversation needs at least two characters"\);return null;\}/);
  assert.match(record, /if\(named\.some\(item=>!item\)\)\{toast\("One of the conversation names does not match an identity"\)/, "a name that matches nothing is refused rather than silently dropped");
  assert.match(functionBody("renderGraph"), /derived\.conversations\.filter\(convo=>currentEvent\?\.id===convo\.id\|\|\(selectedId&&convo\.talkers\.includes\(selectedId\)\)\)/, "and the whole group is drawn joined up");
});

test("the demo story exercises systems and conversations, so both are visible without building a story first", () => {
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("function deepClone"));
  assert.match(sample, /id: "inn-system", kind: "system"/);
  assert.match(sample, /id: "inn-taverns", kind: "system"/);
  assert.match(sample, /type: "system_host", source: "inn-system", target: "lex"/);
  assert.match(sample, /type: "system_location", source: "inn-taverns", location: "inn-lobby"/);
  assert.match(sample, /type: "system_location", source: "inn-taverns", location: "stonevale"/, "one subsystem across two different places");
  assert.match(sample, /type: "conversation", source: "lex", characters: \["lex","mary","gerald"\]/);
  assert.match(source, /sampleData\.events\.filter\(event=>\/\^\(sys-\|talk-\)\/\.test\(event\.id\)&&!eventIds\.has\(event\.id\)\)/, "and a stored copy of the demo picks them up");
});

test("two pods out at once keep away from each other, since nothing in the layout holds them apart", () => {
  const body = functionBody("renderLocationPods");
  assert.match(body, /placedPods\.forEach\(point=>\{score\+=Math\.min\(170,Math\.hypot\(point\.x-x,point\.y-y\)\)\*2\.5;\}\)/);
  assert.match(body, /placedPods\.push\(\{x:anchorPos\.x\+Math\.cos\(angle\)\*distance,y:anchorPos\.y\+Math\.sin\(angle\)\*distance\}\)/);
});

test("three or more in a conversation meet at one marker joined to each, rather than a line between every pair", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /if\(talkers\.length===2\)\{noteEdge\(talkers\[0\],talkers\[1\],convo\.chapter,"In conversation"\);straightEdge\(talkers\[0\],talkers\[1\],edgeClass,talkers\[0\],talkers\[1\]\);return;\}/, "two people still just get a line");
  assert.match(body, /const hubId=`conversation:\$\{convo\.id\}`,centre=\(\)=>\{const points=talkers\.map\(pointFor\)/, "the marker rides the middle of everyone in it");
  assert.match(body, /count\.textContent=String\(talkers\.length\)/, "and says how many were in it");
  assert.match(body, /talkers\.forEach\(id=>\{noteEdge\(id,hubId,convo\.chapter,convo\.description\|\|"In this conversation"\);straightEdge\(id,hubId,edgeClass,id,hubId\)/);
  assert.match(functionBody("pointFor"), /physics\.hubPos\.get\(id\)/, "so links can end on it");
});

test("a conversation can be found again after the slider moves on — selecting anyone who was in it brings it back, and it counts as part of that focus", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /currentEvent\?\.id===convo\.id\|\|\(selectedId&&convo\.talkers\.includes\(selectedId\)\)/);
  assert.match(functionBody("applyGraphFocus"), /String\(edge\.dataset\.a\)\.startsWith\("conversation:"\)\|\|String\(edge\.dataset\.b\)\.startsWith\("conversation:"\)/, "so the other spokes are not dimmed away from the one that touches the selection");
  assert.match(functionBody("edgeEndpointName"), /String\(id\)\.startsWith\("conversation:"\)\?"this conversation"/, "and hovering a spoke names it rather than printing an id");
});

test("a ghost action changes the world without taking a turn: no stop on the slider, not in the list, but everything it does is in force — and it replays in story order, not after everything else", () => {
  assert.match(functionBody("volumeActions"), /&&!event\.ghost\);/, "never a stop");
  assert.match(functionBody("ghostActions"), /event\.ghost&&event\.chapter>=volume\.from&&event\.chapter<=volume\.to&&event\.chapter<=chapter/, "in force from its chapter onward");
  assert.match(functionBody("revealedVolumeActions"), /const chosen=new Set\(\[\.\.\.volumeActions\(\)\.slice\(0,currentActionIndex\),\.\.\.ghostActions\(\)\]\.map\(event=>event\.id\)\);\s*return orderedEvents\(\)\.filter\(event=>chosen\.has\(event\.id\)\);/);
  assert.match(functionBody("appliedEvents"), /const volume=activeVol\(\),selected=new Set\(revealedVolumeActions\(\)\.map\(event=>event\.id\)\)/, "so derivation sees it too");
  assert.match(source, /if\(form\.get\("ghost"\)\)record\.ghost=true;/);
  assert.match(functionBody("renderOrderEditor"), /if\(record\.ghost\)delete record\.ghost;else record\.ghost=true;/, "and it can be toggled where the actions are managed");
});

test("a system's grade is letters with an optional plus or minus, or one of the named gradings — and authority is a plain number, never a letter", () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("const SPECIAL_GRADES"), source.indexOf("function progressionTracks")), ctx);
  const run = expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, ctx));
  assert.equal(run('gradeIsValid("S")'), true);
  assert.equal(run('gradeIsValid("A+")'), true);
  assert.equal(run('gradeIsValid("SS")'), true, "double letter");
  assert.equal(run('gradeIsValid("SSS")'), true, "triple letter");
  assert.equal(run('gradeIsValid("SSS-")'), true, "triple letter with a minus");
  assert.equal(run('gradeIsValid("SSSS")'), false, "four letters is too many");
  assert.equal(run('gradeIsValid("7")'), false, "a number is authority, not a grade");
  assert.equal(run('gradeIsValid("Divine")'), true);
  assert.equal(run('gradeIsValid("Death")'), true);
  assert.equal(run('gradeIsValid("life")'), true);
  assert.match(styleSource, /\.node\.system-death \.system-shape \{ fill: rgba\(48,18,58,\.94\); stroke: #c471e8; \}/, "Death is graded, not destroyed, so it does not borrow the danger red");
  assert.match(styleSource, /\.system-grade-special\.grade-len-6 \{ font-size: 7\.5px/, "and a long named grade shrinks to fit rather than being clipped");
  assert.equal(run('gradeIsValid("")'), true, "a system may simply have no grade");
  assert.equal(run('gradeIsValid("unknown")'), true, "or one nobody has been told");
  assert.equal(run('authorityIsValid("7")'), true);
  assert.equal(run('authorityIsValid("")'), true, "authority is optional in the same way");
  assert.equal(run('authorityIsValid("unknown")'), true);
  assert.equal(run('authorityIsValid("S")'), false, "a letter is a grade, not an authority");
  assert.match(functionBody("systemGlyphRadius"), /const authority=Number\(state\?\.authority\)/, "authority reads as size, since it is an unbounded number");
  assert.doesNotMatch(source, /name: "Authority", levels:/, "authority is a system property, not a character progression ladder");
});

test("the progression track picker belongs to characters only — it was showing on every kind, including systems, which have nothing to do with it", () => {
  assert.match(functionBody("updateEntityFormFields"), /\$\("#entity-initial-track-field"\)\.hidden=!isCharacter;/);
  assert.match(functionBody("updateEntityFormFields"), /const isSystem=kind==="system",isQuest=kind==="quest";\$\("#entity-authority-field"\)\.hidden=!isSystem;\$\("#entity-grade-field"\)\.hidden=!isSystem;/);
});

test("a system that was merged away or destroyed shrinks to a small marker on whatever succeeded it, named only when that system is the one being looked at", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /const retired=new Set\(\[\.\.\.derived\.systemMerges\.map\(link=>link\.absorbed\),\.\.\.derived\.systemEnds\.map\(link=>link\.system\)\]\)/);
  assert.match(body, /entity\(id\)\?\.kind!=="system"\|\|\(retired\.has\(id\)&&id!==actionSystem\)\)continue;/, "it stops being a node of its own, except for the action that retires it");
  assert.match(body, /const named=selectedId===satellite\.anchor\|\|selectedId===satellite\.id\|\|sysView\.expanded\.has\(satellite\.anchor\)/);
  assert.match(body, /if\(selectedId&&!renderIds\.has\(selectedId\)&&!systemSatellites\.some\(item=>item\.id===selectedId\)\)selectedId=null;/, "and selecting one is not thrown away just because it is not a node");
  assert.match(styleSource, /\.system-satellite-mark \{ fill: rgba\(46,28,78,\.96\); stroke: #8f74c4/);
});

test("a merged system's history also belongs to the system that took it, and the merge itself shows there", () => {
  assert.match(functionBody("absorbedInto"), /\(derived\.systemMerges\|\|\[\]\)\.filter\(link=>link\.into===current\)/, "following the chain, so a merge of a merge still reports upward");
  assert.match(functionBody("renderEvents"), /family=new Set\(\[selectedId,\.\.\.\(entity\(selectedId\)\?\.kind==="system"\?absorbedInto\(selectedId,currentDerived\(\)\):\[\]\)\]\)/);
  assert.match(functionBody("renderEvents"), /\[\.\.\.family\]\.some\(id=>eventInvolves\(entry\.event,id\)\)/);
});

test("a system is selected on the first click and opened on the second, the same as a place, so its own history is reachable", () => {
  const body = functionBody("activateSystem");
  assert.match(body, /if\(view\.expanded\.has\(id\)\)\{closeSystem\(id\);return;\}/);
  assert.match(body, /if\(selectedId===id&&\(view\.children\.get\(id\)\|\|\[\]\)\.length\)\{openSystem\(id\);return;\}/);
  assert.match(body, /selectedId=id;setMobilePanel\("info"\);renderAll\(\);/);
});

test("an action's message is editable where it is read in the editor, and stays plain prose on the public graph", () => {
  assert.match(functionBody("canEditEvents"), /return isUploadRoute&&adminAuthenticated;/);
  assert.match(functionBody("eventPanelRow"), /\$\{canEditEvents\(\)\?`<input class="event-message-edit"/);
  assert.match(functionBody("bindEventPanelRows"), /record\.description=field\.value\.trim\(\);saveData\(\)/);
  assert.match(functionBody("bindEventPanelRows"), /if\(event\.target\.closest\("button,a,input"\)\)return;/, "so typing in it does not also jump the graph");
});

test("the demo carries a merged system, a destroyed one, and graded systems, and a stored copy picks them up even if its novel was renamed", () => {
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("function deepClone"));
  assert.match(sample, /id: "hearth-system", kind: "system"[^}]*grade: "C"/);
  assert.match(sample, /id: "ash-system", kind: "system"[^}]*grade: "B"/, "the destroyed system is not also the one carrying a named grade — those are separate ideas");
  assert.match(sample, /type: "system_merge", source: "hearth-system", target: "inn-system"/);
  assert.match(sample, /type: "system_end", source: "ash-system"/);
  assert.match(sample, /id: "inn-system"[^}]*authority: 7, grade: "S"/);
  assert.match(source, /const isBundledDemo=\["lex","eclipse","inn-lobby"\]\.every\(id=>migrated\.entities\.some\(item=>item\.id===id\)\)/, "identified by its cast, not its title");
});

test("the demo exercises every action type the editor offers, so nothing ships without something in the sample that shows it working", () => {
  const typeSelect = source.slice(source.indexOf("<span>Event type</span>"), source.indexOf("</select>", source.indexOf("<span>Event type</span>")));
  const offered = [...typeSelect.matchAll(/value="([a-z_]+)"/g)].map(match => match[1]);
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  const used = new Set([...sample.matchAll(/type: "([a-z_]+)"/g)].map(match => match[1]));
  const missing = offered.filter(type => !used.has(type));
  assert.deepEqual(missing, [], `the demo never shows: ${missing.join(", ")}`);
  assert.ok(offered.length >= 25, "and the list of types is the one being checked against");
});

test("a system's authority and grade both move over time, in the demo and independently of each other", () => {
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  assert.match(sample, /type: "system_rank", source: "inn-system", grade: "S\+"/, "a grade change on its own");
  assert.match(sample, /type: "system_rank", source: "inn-system", authority: 11/, "an authority change on its own");
  assert.match(sample, /type: "system_rank", source: "ash-system", authority: 2, grade: "D"/, "and both falling together");
  assert.match(sample, /type: "system_rank", source: "warden-system", authority: 9, grade: "Death"/, "and both rising together — a named grade is a high rank, not an ending");
  assert.match(sample, /ghost: true/, "a structural fact is still carried as a ghost");
  assert.match(source, /if\(!rankAuthority&&!rankGrade\)\{toast\("Give the new authority, the new grade, or both — or write unknown to take one away"\)/);
  assert.match(source, /source\.previousAuthority=source\.authority;source\.previousGrade=source\.grade;/, "what it was is kept so the move can be shown");
});

test("neither a number nor a grade is compulsory: a system can start without one, be given one later, or have one taken away", () => {
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  assert.match(sample, /id: "inn-taverns", kind: "system", name: "Midnight Taverns", intro: 12, description:/, "founded with neither, because nobody has said");
  assert.match(sample, /type: "system_rank", source: "inn-taverns", authority: 3, grade: "B"/, "and rated for the first time later on");
  assert.match(sample, /type: "system_rank", source: "hearth-system", grade: null/, "a system swallowed by a bigger one can lose its grade outright");
  assert.match(source, /if\(event\.grade===null\)source\.grade=undefined;else if\(event\.grade\)source\.grade=String\(event\.grade\)\.trim\(\);/, "null takes it away; blank leaves it alone");
  assert.match(source, /if\(event\.authority===null\)source\.authority=undefined;/);
  assert.match(source, /if\(rankGrade\)record\.grade=meansUnknown\(rankGrade\)\?null:rankGrade;/, "which is what writing unknown in the editor records");
  assert.match(source, /if\(rankAuthority\)record\.authority=meansUnknown\(rankAuthority\)\?null:Number\(rankAuthority\);/);
  assert.match(functionBody("rankWord"), /return text===""\?"none":text;/, "an absent rank and an unknown one read the same on the graph");
  assert.match(source, /<span>Authority \(optional\)<\/span>/);
  assert.match(source, /<span>Grade \(optional\)<\/span>/);
  assert.match(source, /<article><span>Authority<\/span><strong>\$\{Number\.isFinite\(Number\(state\.authority\)\)\?escapeHtml\(String\(state\.authority\)\):"—"\}/, "the panel says so plainly rather than inventing a value");
  assert.match(source, /migrated\.schemaVersion=12;/, "and readers already holding the demo are brought along");
});

test("a marker holding several kinds of event shows the commonest few rather than a pie of mud", () => {
  assert.match(source, /const MARKER_SLICE_LIMIT = 3;/);
  assert.match(functionBody("eventMarkerFill"), /\[\.\.\.tally\]\.sort\(\(a,b\)=>b\[1\]-a\[1\]\)\.slice\(0,Math\.max\(1,limit\)\)/, "the commonest kinds win; the rest are not drawn");
  assert.match(functionBody("renderTimelineMarkers"), /eventMarkerFill\(unit\.events,fit\.size<7\?1:MARKER_SLICE_LIMIT\)/, "and below seven pixels a marker shows what it mostly was, not a smudge of everything");
  assert.match(styleSource, /\.main-timeline-marks\.tight-marks \.main-timeline-mark\{border:0;box-shadow:none\}/, "a small mark is all colour, with no rim eating it");
});

test("the bar is not a list of chapters — it carries where the reader is, and nothing else unless someone is selected", () => {
  const body = functionBody("renderTimelineMarkers");
  assert.doesNotMatch(body, /chapterGroups\.forEach/, "no mark per chapter, however few or many there are");
  assert.doesNotMatch(body, /groups\.forEach\(\(group,index\)=>/, "and no density profile standing in for them either");
  assert.match(body, /const hereIndex=chapterGroups\.findIndex\(group=>group\.chapter===currentChapter\),here=chapterGroups\[hereIndex\];/);
  assert.match(body, /class="main-timeline-mark here-mark expandable"[^`]*data-expand-chapter="\$\{here\.chapter\}"/, "where the reader is opens into that chapter's events");
  assert.match(body, /several=here\.entries\.length>1;/, "and it is only openable when the chapter actually holds several");
  assert.match(styleSource, /\.main-timeline-mark\.here-mark\{width:11px;height:11px/, "it is the one mark always present, so it is the loudest");
});

test("a node folded into something else is seen going there, rather than blinking out where it stood", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /const podsComing=new Set\(eventPodIds\(locView,currentEvent\)\),departing=\[\];/);
  assert.match(body, /into=kind==="location"\?locView\.anchorOf\.get\(id\)\s*:kind==="system"\?\(sysView\.anchorOf\.get\(id\)\|\|systemSatellites\.find\(item=>item\.id===id\)\?\.anchor\)/, "a place goes to the parent that took it in; a system to whatever swallowed or succeeded it");
  assert.match(body, /if\(into&&into!==id&&renderIds\.has\(into\)\)\{/, "only when there is somewhere to go");
  assert.match(body, /else departing\.push\(\{id,kind,from:\{\.\.\.physics\.pos\.get\(id\)\},into/, "captured before the position is forgotten");
  assert.match(body, /ghost\.style\.transform=`translate\(\$\{item\.from\.x\}px,\$\{item\.from\.y\}px\)`;/, "it starts where the node last stood");
  assert.match(body, /if\(kind==="location"&&podsComing\.has\(id\)\)podOrigins\.set\(id,\{\.\.\.physics\.pos\.get\(id\)\}\);/, "a place about to become a pod hands its journey to the pod, so it does not fly in and straight back out");
  assert.match(body, /viewportGroup\.append\(edgeLayer,departLayer,nodeLayer/, "it travels under the nodes, so the parent covers it as it arrives");
  const step = functionBody("stepDepartingGhosts");
  assert.match(step, /const target=physics\.pos\.get\(ghost\.into\)/, "driven by the tick, so it follows the parent as that settles instead of landing where it used to be");
  assert.match(step, /if\(!target\|\|progress>=1\)\{ghost\.el\.remove\(\);return false;\}/, "and does not linger once it is gone");
  assert.match(body, /radius=item\.kind==="system"\?systemGlyphRadius\(state\):locationGlyphRadius\(item\.id,locView\)/, "the ghost is the node's own glyph, not a stand-in");
});

test("a place known only to be inside a realm can later be placed exactly, without confusing the hierarchy", () => {
  // The link is keyed by the child, so the newest statement replaces the older, broader one.
  assert.match(functionBody("derive"), /else locationParents\.set\(event\.source,\{child:event\.source,parent:event\.location,from:event\.chapter\}\)/);
  assert.match(functionBody("buildDrillView"), /while\(true\)\{const parent=parentOfRaw\(cursor\);if\(!parent\|\|seen\.has\(parent\)\)break;/, "and the walk up cannot loop, whatever order the statements arrive in");
  assert.match(source, /if\(type==="location_parent"&&source\.id===location\.id\)\{toast\("A location cannot contain itself"\)/);
  assert.match(source, /if\(type==="location_parent"&&action!=="remove"&&locationLineage\(location\.id,derive\(chapter\)\)\.includes\(source\.id\)\)\{toast\("That would create a circular location hierarchy"\)/);
  assert.match(source, /String\(source\.locationType\|\|""\)===LOCATION_ROOT_TYPE\)\{toast\("A realm is the widest place the graph draws/);
});

test("a quest is a record with a run of its own: issued, inched forward chapter by chapter, and settled", () => {
  assert.match(source, /<option value="quest_issue">Quest is issued<\/option><option value="quest_update">Quest update, hint, remark, or notification<\/option><option value="quest_progress">Quest progress changes<\/option><option value="quest_end">Quest completed, failed, or abandoned<\/option><option value="quest_part">Quest is part of a larger quest<\/option><option value="quest_contribution">Quest contribution and share of the reward<\/option>/);
  assert.match(source, /<option value="quest">Quest<\/option>/, "and a quest is its own kind of identity, with its own terms");
  const derived = functionBody("derive");
  assert.match(derived, /if\(String\(event\.type\)\.startsWith\("quest_"\)&&source\?\.kind==="quest"\)/);
  assert.match(derived, /run\.status=outcome==="fail"\?"failed":outcome==="abandon"\?"abandoned":"complete"/);
  assert.match(derived, /if\(!run\.explicitProgress&&kids\.length\)run\.progress=Math\.round\(total\/kids\.length\)/, "a chain with no figure of its own reads as how far through its parts it is");
  assert.match(derived, /if\(questRuns\.has\(link\.child\)&&!questRuns\.has\(link\.parent\)\)questRun\(link\.parent\)/, "and a larger quest whose first part is issued still gets a header");
  assert.match(functionBody("renderQuests"), /active=roots\.filter\(run=>run\.status==="active"\)/, "a settled quest drops out of the active list rather than crowding it");
  assert.match(functionBody("renderQuests"), /settled=roots\.filter\(run=>run\.status!=="active"\)\.sort\(\(a,b\)=>\(b\.to\|\|0\)-\(a\.to\|\|0\)\)/, "most recently settled first");
  assert.match(functionBody("questCardHtml"), /style="--quest-progress:\$\{run\.progress\}%"/, "the card is filled by how far along the quest is");
  assert.match(functionBody("questCardHtml"), /data-quest-chain="\$\{escapeHtml\(run\.quest\)\}"/, "and a larger quest opens and closes to show its parts");
  assert.match(styleSource, /\.quest-fill \{ position: absolute; inset: 0 auto 0 0; width: var\(--quest-progress,0%\)/);
  assert.match(source, /const kind=entity\(id\)\?\.kind;if\(kind==="system"\|\|kind==="quest"\)return false;/, "quests never become graph nodes");
  assert.match(source, /if\(knownIds\.has\(item\.id\)&&item\.kind!=="quest"\)/, "nor graph search results");
});

test("a quest carries the terms the story states — and any of them may be missing", () => {
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  assert.match(sample, /id: "q-hearth", kind: "quest", issuer: "inn-system"[^}]*questBadge: "World"[^}]*timeLimit:[^}]*achievements:[^}]*failure:/, "one quest states most of its terms up front");
  assert.match(sample, /id: "q-ledger", kind: "quest", issuer: "inn-system", name: "Balance the Winter Ledger", intro: 30, timeLimit: "Before the spring audit", description:/, "and another states almost none");
  assert.match(sample, /type: "quest_part", source: "q-stock", target: "q-hearth"/);
  assert.match(sample, /type: "quest_progress", source: "q-winter", progress: 72/);
  assert.match(sample, /type: "quest_end", source: "q-envoy", action: "fail"/);
  assert.match(source, /if\(kind==="quest"&&!gradeIsValid\(form\.get\("rewardRank"\)\)\)/, "a reward rank is checked the same way a system grade is");
  assert.match(source, /if\(!percent\|\|!Number\.isFinite\(Number\(percent\)\)\|\|Number\(percent\)<0\|\|Number\(percent\)>100\)/, "and progress has to be a percentage");
  assert.match(source, /migrated\.schemaVersion=14;/, "readers already holding the demo are brought along");
  assert.match(source, /if\(event\.type==="quest_chain"\)event\.type="quest_part";/, "and anything already recorded under the old wording is renamed");
});

test("every action that offers a second identity or a free-text value actually keeps it — the system and quest actions were reading both and dropping them", () => {
  assert.match(source, /if\(\["awareness","meeting","relationship","membership","identity_parent","system_host","system_parent","system_merge","quest_part","quest_contribution","quest_issue"\]\.includes\(type\)\|\|\(type==="note"&&target\)\)record\.target=target\?\.id;/);
  assert.match(source, /"residency","system_host","system_location","system_end","quest_end","quest_contribution"\]\.includes\(type\)&&value\)record\.value=/);
  assert.match(source, /showsSystemValue=\["system_host","system_location","system_end"\]\.includes\(type\)/, "and a destroyed system can be given its reason, which the sample always had but the form never offered");
});

test("a story that settles hundreds of quests does not build hundreds of cards", () => {
  const body = functionBody("renderQuests");
  assert.match(source, /const QUEST_PAGE=10;/);
  assert.match(body, /activeShown=active\.slice\(0,QUEST_PAGE\+questPageActive\),settledShown=questSettledOpen\?settled\.slice\(0,QUEST_PAGE\+questPageSettled\):\[\]/, "settled cards are not even built until the group is opened");
  assert.match(body, /id="more-settled-quests">Show \$\{Math\.min\(settledRest,QUEST_PAGE\)\} older · \$\{settledRest\} left/, "and the rest arrive a page at a time, with the count in plain sight");
  assert.match(body, /questPageSettled=0;renderQuests\(\)/, "closing the group forgets how far it was paged");
});

test("one character's connection history is headed by chapter and paged, since a long story gives them hundreds", () => {
  const body = functionBody("renderEvents");
  assert.match(source, /const SELECTION_EVENT_PAGE=30;/);
  assert.match(body, /if\(lastEventSelection!==selectedId\)\{lastEventSelection=selectedId;selectionEventPage=SELECTION_EVENT_PAGE;\}/, "paging through one character does not carry to the next");
  assert.match(body, /newestFirst=actions\.slice\(\)\.reverse\(\),shown=newestFirst\.slice\(0,selectionEventPage\)/);
  assert.match(body, /rows\.push\(`<li class="event-chapter-heading"><span>Chapter \$\{heading\}<\/span><small>\$\{count\} action/);
  assert.match(body, /id="more-connected-events">Show \$\{Math\.min\(rest,SELECTION_EVENT_PAGE\)\} earlier/);
});

test("selecting someone fills the bar with that one's turning points and nobody else's", () => {
  const body = functionBody("renderTimelineMarkers");
  assert.match(source, /const MAJOR_EVENT_TYPES = new Set\(\["appearance","corpse_appearance","cultivation","status","display_name","identity_parent","relationship","membership","system_host","system_rank","quest_end"\]\);/);
  assert.match(body, /if\(selectedId&&chapterGroups\.length\)\{/);
  assert.match(body, /filter\(entry=>MAJOR_EVENT_TYPES\.has\(entry\.event\.type\)&&eventInvolves\(entry\.event,selectedId\)\)/, "only that person's, and only the ones that turn something");
  assert.match(body, /if\(!byChapter\.has\(entry\.event\.chapter\)\)byChapter\.set/, "a chapter where four things turned is still one place on the bar");
  assert.match(body, /const bins=binTimelineUnits\(units,fit\.budget\)/, "and one person can still turn more often than the track can hold");
  assert.match(body, /\$\("#event-position"\)\.textContent=`\$\{stateName\(currentDerived\(\),selectedId\)\|\|chosen\?\.name\|\|"Selected"\} · \$\{milestones\.length\} turning point/);
  assert.match(styleSource, /\.main-timeline-mark\.milestone-mark\{border-radius:2px;transform:translate\(-50%,-50%\) rotate\(45deg\)/, "a diamond, so it never reads as a chapter");
});

test("the two-stage mark sizing still governs one person's turning points", () => {
  const layoutBody = functionBody("timelineMarkLayout");
  assert.match(layoutBody, /width=\$\("#timeline-marks"\)\?\.clientWidth\|\|520,per=count\?width\/count:width/, "how much room each mark gets is a question about the track's real width");
  assert.match(layoutBody, /if\(per>=7\)return \{mode:"dots",size:Math\.max\(5,Math\.min\(8,per-5\)\)\};/, "marks shrink before they are given up");
  assert.match(functionBody("binTimelineUnits"), /const perBin=Math\.ceil\(units\.length\/Math\.max\(1,budget\)\)/);
});

test("a quest that is part of a larger one is still findable — it was being hidden inside it", () => {
  const body = functionBody("questCardHtml");
  assert.match(source, /const expandedQuests=new Set\(\),foldedQuestChains=new Set\(\);/);
  assert.match(body, /partsOpen=!foldedQuestChains\.has\(run\.quest\)/, "parts show by default; folding one away is the deliberate act");
  assert.match(functionBody("renderQuests"), /if\(foldedQuestChains\.has\(id\)\)foldedQuestChains\.delete\(id\);else foldedQuestChains\.add\(id\)/);
});

test("a quest's actions belong to whoever issued it, so the system that hands them out carries them in its own history", () => {
  assert.match(functionBody("eventInvolves"), /return String\(event\.type\)\.startsWith\("quest_"\) && entity\(event\.source\)\?\.issuer === id;/);
  assert.match(source, /<label class="field" id="entity-quest-issuer-field" hidden><span>Issued by \(optional\)<\/span>/);
  assert.match(source, /issuer:kind==="quest"\?\(resolveEntity\(String\(form\.get\("issuer"\)\|\|""\)\)\?\.id\|\|undefined\):undefined/);
  assert.match(functionBody("questCardHtml"), /item\.issuer\?\{label:"Issued by",value:stateName\(derived,item\.issuer\)/, "and the card says who it came from");
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  assert.match(sample, /id: "q-anomaly", kind: "quest", issuer: "warden-system"/, "the demo has two systems handing out different quests");
  assert.match(source, /migrated\.schemaVersion=15;/, "stored demos pick the issuers up");
});

test("a quest's reward is usually only named once it is finished, and it is scaled to how the host performed", () => {
  const derived = functionBody("derive");
  assert.match(derived, /if\(event\.rewardRank\)run\.rewardRank=event\.rewardRank;/);
  assert.match(derived, /if\(event\.performance\)run\.performance=event\.performance;/);
  assert.match(derived, /if\(event\.value\)run\.reward=event\.value;/);
  assert.match(functionBody("questCardHtml"), /rewardText=run\.reward\|\|\(item\.rewards\?\.length\?item\.rewards\.join\(", "\):settled\?"":"Told on completion"\)/, "so the card says the reward is still to come rather than showing none");
  assert.match(functionBody("questCardHtml"), /rank\?`<span class="quest-rank">\$\{escapeHtml\(rank\)\}<\/span>`:""/, "the rank is written as the story writes it, with nothing bolted on the front");
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  assert.match(sample, /type: "quest_end", source: "q-anomaly", action: "complete", value: "Realm Seed", rewardRank: "Destiny", performance: "SSS\+"/);
  assert.match(source, /const SPECIAL_GRADES = \["destiny","fate","divine","oblivion","death","spirit","life","chaos"\];/, "the named ranks above the letters all count as ranks");
});

test("a quest's own terms can grow as the story turns — an added objective is not a second quest", () => {
  assert.match(functionBody("derive"), /if\(event\.type==="quest_update"\)run\.updates\.push\(\{chapter:event\.chapter,order:event\.order\|\|0,kind:"note",noteKind:event\.value\|\|"Update"/);
  assert.match(source, /<option value="Update">Quest update<\/option><option value="Hint">Quest hint<\/option><option value="Remark">Remark<\/option><option value="Notification">New notification<\/option><option value="Objective">Added objective<\/option>/);
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  ["Remark","Update","Hint","Objective","Notification"].forEach(kind=>assert.match(sample, new RegExp(`type: "quest_update", source: "q-anomaly", value: "${kind}"`), `the demo shows a ${kind.toLowerCase()}`));
  assert.match(styleSource, /\.quest-updates li\.note-hint \.quest-update-text \{ color: #9fd8ff; \}/);
});

test("a joint quest is worked by more than one person and paid by contribution, which need not be equal", () => {
  assert.match(functionBody("derive"), /\[event\.target,\.\.\.\(event\.characters\|\|\[\]\)\]\.filter\(Boolean\)\.forEach\(id=>\{if\(states\.get\(id\)\?\.kind==="character"&&!run\.holders\.includes\(id\)\)run\.holders\.push\(id\);\}\)/);
  assert.match(functionBody("derive"), /if\(event\.type==="quest_contribution"&&states\.get\(event\.target\)\?\.kind==="character"\)/);
  assert.match(functionBody("questCardHtml"), /joint=run\.holders\.length>1/);
  assert.match(functionBody("questCardHtml"), /joint\?'<span class="quest-joint">Joint<\/span>':""/);
  assert.match(functionBody("questCardHtml"), /run\.contributions\.length\?`<dl class="quest-facts quest-shares">/, "each contributor's share and reward is listed separately");
  const sample = source.slice(source.indexOf("const sampleData"), source.indexOf("\nfunction deepClone"));
  assert.match(sample, /type: "quest_issue", source: "q-caravan", target: "lex", characters: \["lex","vane"\]/);
  assert.match(sample, /type: "quest_contribution", source: "q-caravan", target: "lex", value: "Held the rear against the frost", rewardRank: "S", performance: "A\+"/);
  assert.match(sample, /type: "quest_contribution", source: "q-caravan", target: "vane", value: "Broke the road ahead", rewardRank: "A", performance: "B\+"/);
});

test("a rank change is visible when it happens: the system comes up for its own action even with no host selected, and says which way it moved", () => {
  const body = functionBody("renderGraph");
  assert.match(body, /const actionSystem=currentEvent&&String\(currentEvent\.type\)\.startsWith\("system_"\)\?\[currentEvent\.source,currentEvent\.target\]\.find\(id=>entity\(id\)\?\.kind==="system"\):null/);
  assert.match(body, /if\(actionSystem\)\{queue\.push\(actionSystem\);focusSystems\.add\(actionSystem\);\}/);
  assert.match(body, /\(retired\.has\(id\)&&id!==actionSystem\)/, "a system destroyed by the very action being played is still drawn for that beat");
  assert.match(body, /moves\.push\(`\$\{rankWord\(state\.previousGrade\)\} → \$\{rankWord\(state\.grade\)\}`\)/);
  assert.match(body, /moves\.push\(`authority \$\{rankWord\(state\.previousAuthority\)\} → \$\{rankWord\(state\.authority\)\}`\)/);
  assert.match(body, /rankLabel=\{text:moves\.join\(" · "\),y:r\+\(Number\.isFinite\(now\)\?26:19\),tone:fell\?"rank-fell":"rank-rose"\}/, "the movement is written under the diamond, clear of the system's own name above it");
  assert.match(body, /if\(rankLabel\)\{const moved=svgEl\("text",\{x:0,y:rankLabel\.y,class:`system-rank-label \$\{rankLabel\.tone\}`\}\);.*labelGroup\.appendChild\(moved\);\}/, "and it sits in the label layer, where nothing else can be drawn over it");
  assert.match(body, /const box=\(entry\.tall\?entry\.group:entry\.text\)\.getBBox\(\)/, "reserving the whole strip so no other name is placed across it");
  assert.match(styleSource, /\.system-rank-label\.rank-rose \{ fill: #8de7b0; \}/);
  assert.match(styleSource, /\.system-authority-text \{ fill: #d9c2ff/, "the number has its own pip under the diamond");
});

test("a character's panel and profile name whichever ladder they are on, rather than always saying cultivation", () => {
  assert.match(source, /!unrevealed&&state\.realm!=="Unrevealed"\?\{label:trackName\(state\.track\),value:/);
  assert.match(source, /profileSection\("profile-cultivation",`\$\{trackName\(state\.track\)\} & abilities`/);
});

test("a failed migration keeps the reader's own story rather than silently replacing it with the demo", () => {
  const body = functionBody("loadLocalData");
  assert.match(body, /let stored = null;/);
  assert.match(body, /catch \(error\) \{ console\.error\("Story data could not be brought up to date; keeping it as it was\.", error\); return stored \|\| deepClone\(sampleData\); \}/);
});
