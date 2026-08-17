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
    functionBody("lastSentenceSplit"),
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

test("richInline turns an inline [[12]] marker into a chapter-ref-span ending in a citation, without swallowing later text", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("Luthor arrives in the lobby.[[18]] He waits by the door.")})`, ctx);
  assert.match(html, /^<mark class="chapter-ref-span">Luthor arrives in the lobby\.<a class="chapter-citation" href="https:\/\/example\.com\/ch-18"/);
  assert.match(html, /He waits by the door\.$/);
  assert.doesNotMatch(html, /He waits by the door\.<\/mark>/);
});

test("richInline with no template configured still wraps the marker as an uncited badge", () => {
  const ctx = sandbox({});
  const html = vm.runInContext(`richInline(${JSON.stringify("Something happens.[[4]]")})`, ctx);
  assert.match(html, /<mark class="chapter-ref-span">Something happens\.<span class="chapter-citation uncited"[^>]*>Chapter 4<\/span><\/mark>/);
});

test("richInline gives each marker in the same field its own segment", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("First fact.[[1]] Second fact.[[2]]")})`, ctx);
  assert.equal((html.match(/<mark class="chapter-ref-span">/g) || []).length, 2);
  assert.match(html, /First fact\.[\s\S]*?ch-1"/);
  assert.match(html, /Second fact\.[\s\S]*?ch-2"/);
});

test("richInline leaves an invalid chapter number (0) as literal text", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("Odd input.[[0]] more text")})`, ctx);
  assert.doesNotMatch(html, /<mark/);
  assert.match(html, /\[\[0\]\]/);
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

test("selecting text in a wiki field and marking a chapter inserts a [[N]] marker right after the selection", () => {
  const body = functionBody("installWikiLinkHelpers");
  assert.match(body, /chapter-mark-helper/);
  assert.match(body, /Mark chapter for selected text/);
  assert.match(body, /chapter=validChapter\(input\)/);
  assert.match(body, /textarea\.setRangeText\(`\[\[\$\{chapter\}\]\]`,end,end,"end"\)/);
});

test("chapter-ref-span markers float as non-reflowing tooltips, invisible until hovered with the toggle on", () => {
  assert.match(styleSource, /\.chapter-ref-span \.chapter-citation\{position:absolute[^}]*opacity:0;pointer-events:none/);
  assert.match(styleSource, /body\.show-chapter-refs \.chapter-ref-span:hover \.chapter-citation\{opacity:1;pointer-events:auto\}/);
});

test("richInline bounds a chapter marker's highlight to its own last sentence, not the whole preceding paragraph", () => {
  const ctx = sandbox({ chapterUrlTemplate: "https://example.com/ch-{n}" });
  const html = vm.runInContext(`richInline(${JSON.stringify("A Slightly Chubby man walked in. He looked around the room. He sat down.[[1]] More unrelated text follows.")})`, ctx);
  // only the last sentence before the marker should be wrapped — the earlier two sentences stay plain
  assert.match(html, /^A Slightly Chubby man walked in\. He looked around the room\. <mark class="chapter-ref-span">He sat down\.<a class="chapter-citation"/);
  assert.match(html, /More unrelated text follows\.$/);
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
