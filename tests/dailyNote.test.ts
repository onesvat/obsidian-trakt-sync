import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { insertEntryUnderHeading } from "../src/dailyNote";

describe("insertEntryUnderHeading", () => {
	it("inserts entry before existing lines under a heading", () => {
		const content = "# Day\n\n## Trakt\nold line\n";
		const result = insertEntryUnderHeading(content, "Trakt", "new line");
		assert.ok(result.includes("## Trakt\nnew line\nold line"));
	});

	it("appends a new heading block when the heading is absent", () => {
		const result = insertEntryUnderHeading("# Day\n", "Trakt", "entry");
		assert.ok(result.includes("## Trakt\nentry"));
	});

	it("appends the entry directly when heading is an empty string", () => {
		const result = insertEntryUnderHeading("# Day\n", "", "entry");
		assert.equal(result.trimEnd(), "# Day\n\nentry");
	});

	it("returns the original content unchanged when the entry is only whitespace", () => {
		const content = "# Day\n";
		assert.equal(insertEntryUnderHeading(content, "Trakt", "   "), content);
	});

	it("creates a heading block when content is completely empty", () => {
		const result = insertEntryUnderHeading("", "Trakt", "entry");
		assert.ok(result.includes("## Trakt\nentry"));
	});

	it("inserts under the first occurrence when the heading appears more than once", () => {
		const content = "## Trakt\nfirst\n\n## Trakt\nsecond\n";
		const result = insertEntryUnderHeading(content, "Trakt", "new");
		assert.ok(result.startsWith("## Trakt\nnew\nfirst"));
	});

	it("inserts entry after a heading at the very end of the file with no trailing newline", () => {
		const result = insertEntryUnderHeading("# Day\n## Trakt", "Trakt", "entry");
		assert.ok(result.includes("## Trakt\nentry"));
	});
});
