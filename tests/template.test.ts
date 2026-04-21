import * as assert from "node:assert/strict";
import { formatDate, renderTemplate, sanitizePathSegment, slugify } from "../src/template";

export function runTemplateTests(): void {
	const now = new Date(2026, 3, 20, 13, 14, 15);
	const rendered = renderTemplate("{{movie_title}} @ {{date:YYYY-MM-DD}}", { movie_title: "Dune" }, now);
	assert.equal(rendered, "Dune @ 2026-04-20");

	const missing = renderTemplate("Hello {{missing}}", {});
	assert.equal(missing, "Hello ");

	const dateNow = new Date(2026, 3, 20, 3, 4, 5);
	assert.equal(formatDate(dateNow, "YYYY-MM-DD HH:mm:ss"), "2026-04-20 03:04:05");

	assert.equal(slugify("The Last of Us (2023)"), "the-last-of-us-2023");

	assert.equal(sanitizePathSegment('A/B:C*D?"E<F>G|H'), "A-B-C-D--E-F-G-H");
}
