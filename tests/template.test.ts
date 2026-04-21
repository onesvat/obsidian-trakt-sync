import * as assert from "node:assert/strict";
import { formatDate, renderTemplate, sanitizePathSegment, slugify } from "../src/template";

export function runTemplateTests(): void {
	const now = new Date(2026, 3, 20, 13, 14, 15);
	assert.equal(renderTemplate("{{movie_title}} @ {{date:YYYY-MM-DD}}", { movie_title: "Dune" }, now), "Dune @ 2026-04-20");
	assert.equal(renderTemplate("Hello {{missing}}", {}), "Hello ");
	assert.equal(renderTemplate("Year: {{year}}", { year: 2026 }), "Year: 2026");
	assert.equal(renderTemplate("Enabled: {{flag}}", { flag: true }), "Enabled: true");
	assert.equal(renderTemplate("{{ movie_title }}", { movie_title: "Dune" }), "Dune");

	const dateNow = new Date(2026, 3, 20, 3, 4, 5);
	assert.equal(formatDate(dateNow, "YYYY-MM-DD HH:mm:ss"), "2026-04-20 03:04:05");
	assert.equal(formatDate(new Date(2026, 11, 1, 0, 5, 9), "YYYY-MM-DD HH:mm:ss"), "2026-12-01 00:05:09");

	assert.equal(slugify("The Last of Us (2023)"), "the-last-of-us-2023");
	assert.equal(slugify(""), "");
	assert.equal(slugify("---"), "");
	assert.equal(slugify("-hello-"), "hello");

	assert.equal(sanitizePathSegment("A/B:C*D?\"E<F>G|H"), "A-B-C-D--E-F-G-H");
	assert.equal(sanitizePathSegment("A\\B"), "A-B");
	assert.equal(sanitizePathSegment("hello-world"), "hello-world");
}
