// Run: node --experimental-strip-types --no-warnings scripts/test-content.mts
import assert from "node:assert/strict";
import { sanitizeContent, normalizeLinks, slugify, readingStats } from "../lib/content/sanitize.ts";
import { renderDocx, renderPdf, htmlToBlocks } from "../lib/content/export.ts";
import { importDocument, pdfTextToBlocks, stripRepeatedHeadersFooters } from "../lib/content/import.ts";

let n = 0;
const t = async (name: string, fn: () => unknown) => { await fn(); n++; console.log("ok -", name); };

await t("sanitize strips scripts, handlers, js urls", () => {
	const out = sanitizeContent(`<p onclick="x()">hi<script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://a.org">ok</a><img src=x onerror=alert(1)></p>`);
	assert.ok(!/script|onclick|onerror|javascript:/i.test(out), out);
	assert.match(out, /rel="noopener noreferrer nofollow"/);
});
await t("sanitize keeps youtube iframe only", () => {
	assert.match(sanitizeContent(`<iframe src="https://www.youtube.com/embed/abc"></iframe>`), /iframe/);
	assert.ok(!/iframe/.test(sanitizeContent(`<iframe src="https://evil.com/x"></iframe>`)));
});
await t("normalizeLinks", () => {
	assert.deepEqual(normalizeLinks([{ url: "example.org/a" }]).links[0].url, "https://example.org/a");
	assert.ok(normalizeLinks([{ url: "javascript:alert(1)" }]).error);
	assert.equal(normalizeLinks([{ label: "", url: "" }]).links.length, 0);
});
await t("slugify/readingStats", () => {
	assert.equal(slugify("  Amina's Story: GBV Response! "), "amina-s-story-gbv-response");
	assert.equal(readingStats("<p>" + "word ".repeat(440) + "</p>").minutes, 2);
});

const html = `<h1>Title</h1><p>Hello <strong>bold</strong> <a href="https://x.org">link</a></p><ul><li>One</li><li>Two</li></ul><blockquote><p>Quoted</p></blockquote><h2>Section</h2><ol><li>First</li></ol>`;
await t("htmlToBlocks", () => {
	const b = htmlToBlocks(html);
	assert.deepEqual(b.map((x) => x.type), ["heading", "paragraph", "list-item", "list-item", "quote", "heading", "list-item"]);
});

let docx: Buffer, pdf: Buffer;
await t("render docx + pdf", async () => {
	const meta = { title: "Test — Doc", summary: "Sum", links: [{ label: "Src", url: "https://src.org" }] };
	docx = await renderDocx(html, meta);
	pdf = renderPdf(html, meta);
	assert.equal(docx.subarray(0, 2).toString(), "PK");
	assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
await t("round-trip: docx -> import", async () => {
	const r = await importDocument(docx, "round.docx");
	assert.equal(r.kind, "docx");
	assert.equal(r.title, "Test — Doc");
	assert.match(r.html, /<strong>bold<\/strong>/);
	assert.match(r.html, /<li>One<\/li>/);
});
await t("round-trip: pdf -> import", async () => {
	const r = await importDocument(pdf, "round.pdf");
	assert.equal(r.kind, "pdf");
	assert.match(r.html, /Hello/);
	assert.ok(r.warnings.length > 0);
});
await t("rejects junk / wrong extension / empty", async () => {
	await assert.rejects(importDocument(Buffer.from("hello"), "a.txt"), /Unsupported/);
	await assert.rejects(importDocument(Buffer.from("x"), "a.doc"), /Unsupported|Legacy/);
	await assert.rejects(importDocument(Buffer.alloc(0), "a.pdf"), /empty/);
	await assert.rejects(importDocument(Buffer.from("%PDF-1.4 garbage"), "a.pdf"), /could not be read|No text/);
});
await t("pdf heuristics: headers/footers, hyphenation, bullets", () => {
	const pages = [1, 2, 3, 4].map((i) => `ORG REPORT\n\nINTRODUCTION\n\nFirst para respon-\nders matter.\n\n• ${["alpha","bravo","charlie","delta"][i-1]} option\n\nPage ${i} of 4`);
	const blocks = pdfTextToBlocks(stripRepeatedHeadersFooters(pages));
	const text = blocks.map((b) => b.text).join("|");
	assert.ok(!/ORG REPORT|Page \d/.test(text), text);
	assert.match(text, /responders matter/);
	assert.ok(blocks.some((b) => b.type === "li"));
});
console.log(`\n${n} passed`);
