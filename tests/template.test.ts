import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDate, renderTemplate, sanitizePathSegment, slugify } from "../src/template";

describe("renderTemplate", () => {
	it("replaces a known string token with its value", () => {
		const now = new Date("2026-04-20T13:14:15.000Z");
		assert.equal(renderTemplate("{{movie_title}} @ {{date:YYYY-MM-DD}}", { movie_title: "Dune" }, now), "Dune @ 2026-04-20");
	});

	it("replaces a missing token with an empty string", () => {
		assert.equal(renderTemplate("Hello {{missing}}", {}), "Hello ");
	});

	it("replaces a numeric value", () => {
		assert.equal(renderTemplate("Year: {{year}}", { year: 2026 }), "Year: 2026");
	});

	it("replaces a boolean value", () => {
		assert.equal(renderTemplate("Enabled: {{flag}}", { flag: true }), "Enabled: true");
	});

	it("handles spaces around the token name", () => {
		assert.equal(renderTemplate("{{ movie_title }}", { movie_title: "Dune" }), "Dune");
	});
});

describe("formatDate", () => {
	it("formats a basic date with zero-padded single-digit values", () => {
		const date = new Date("2026-04-20T03:04:05.000Z");
		assert.equal(formatDate(date, "YYYY-MM-DD HH:mm:ss"), "2026-04-20 03:04:05");
	});

	it("zero-pads month 12, day 1, and midnight hour", () => {
		const date = new Date("2026-12-01T00:05:09.000Z");
		assert.equal(formatDate(date, "YYYY-MM-DD HH:mm:ss"), "2026-12-01 00:05:09");
	});
});

describe("slugify", () => {
	it("lowercases and replaces non-alphanumeric runs with hyphens", () => {
		assert.equal(slugify("The Last of Us (2023)"), "the-last-of-us-2023");
	});

	it("returns an empty string for empty input", () => {
		assert.equal(slugify(""), "");
	});

	it("returns an empty string for all-special-character input", () => {
		assert.equal(slugify("---"), "");
	});

	it("strips leading and trailing hyphens", () => {
		assert.equal(slugify("-hello-"), "hello");
	});
});

describe("sanitizePathSegment", () => {
	it("replaces filesystem-unsafe characters with hyphens", () => {
		assert.equal(sanitizePathSegment("A/B:C*D?\"E<F>G|H"), "A-B-C-D--E-F-G-H");
	});

	it("replaces backslashes with hyphens", () => {
		assert.equal(sanitizePathSegment("A\\B"), "A-B");
	});

	it("leaves an already-clean string unchanged", () => {
		assert.equal(sanitizePathSegment("hello-world"), "hello-world");
	});
});
