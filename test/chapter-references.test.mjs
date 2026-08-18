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

test("the timeline position (not just the selected volume) is persisted and restored across a refresh, with range validation against the current volume", () => {
  assert.match(source, /function cacheActiveVolume\(\)\{try\{localStorage\.setItem\(VIEW_STATE_KEY,JSON\.stringify\(\{activeVolume,currentChapter,currentActionIndex\}\)\)/);
  const restoreBody = functionBody("restoreActiveVolume");
  assert.match(restoreBody, /inRange=vol&&Number\.isFinite\(cached\.currentChapter\)&&cached\.currentChapter>=vol\.from&&cached\.currentChapter<=vol\.to/);
  assert.match(restoreBody, /currentChapter=inRange\?cached\.currentChapter:\(vol\?\.from\|\|1\)/);
  assert.match(source, /function renderAll\(\)\{configureTimeline\(\);renderGraph\(\);renderSummary\(\);renderEvents\(\);renderAdmin\(\);updateSuggestions\(\);cacheActiveVolume\(\);\}/);
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
