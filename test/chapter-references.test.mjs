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

test("the chapter-link template form validates {n} presence and a real URL before saving", () => {
  assert.match(source, /if\(raw&&!raw\.includes\("\{n\}"\)\)/);
  assert.match(source, /if\(raw&&!safeExternalUrl\(raw\.replaceAll\("\{n\}","1"\)\)\)/);
  assert.match(source, /data\.chapterUrlTemplate=raw/);
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

test("chapter-ref-span markers are hidden by default and only reveal on hover once the toggle is on", () => {
  assert.match(styleSource, /body:not\(\.show-chapter-refs\) \.chapter-ref-span \.chapter-citation\{display:none\}/);
  assert.match(styleSource, /body\.show-chapter-refs \.chapter-ref-span:hover \.chapter-citation\{display:inline-flex\}/);
});
