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
    functionBody("escapeHtml"),
    functionBody("safeExternalUrl"),
    functionBody("validChapter"),
    functionBody("chapterUrl"),
    functionBody("chapterCitation"),
    functionBody("richInline"),
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

test("selecting text and marking a chapter wraps exactly that text with [[selection|chapter]], not a bare marker appended after it", () => {
  const body = functionBody("installWikiLinkHelpers");
  assert.match(body, /chapter-mark-helper/);
  assert.match(body, /Mark chapter for selected text/);
  assert.match(body, /const selectedText=textarea\.value\.slice\(start,end\)/);
  assert.match(body, /chapter=validChapter\(input\)/);
  assert.match(body, /textarea\.setRangeText\(`\[\[\$\{selectedText\}\|\$\{chapter\}\]\]`,start,end,"end"\)/);
});

test("prose chapter refs are always-in-flow (no floating/absolute positioning) so there's no dead zone between text and badge, and stay hidden until the toggle is on", () => {
  assert.doesNotMatch(styleSource, /\.prose-chapter-ref[^{]*\{[^}]*position:absolute/);
  assert.match(styleSource, /\.prose-chapter-ref \.chapter-citation\{display:none/);
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref \.chapter-citation\{display:inline-flex\}/);
  assert.match(styleSource, /body\.show-chapter-refs \.prose-chapter-ref \.chapter-ref-link\{text-decoration:underline/);
});

test("the marked text itself is a real <a> link when a source exists, clickable independent of hover/toggle state", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("[[man|2]] text")})`, ctx);
  assert.match(html, /^<span class="prose-chapter-ref"><a class="chapter-ref-link" href="https:\/\/example\.com\/ch-2"/);
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
