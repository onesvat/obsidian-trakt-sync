import * as assert from "node:assert/strict";
import { insertEntryUnderHeading } from "../src/dailyNote";

export function runDailyNoteTests(): void {
	const content = "# Day\n\n## Trakt\nold line\n";
	const result = insertEntryUnderHeading(content, "Trakt", "new line");
	assert.ok(result.includes("## Trakt\nnew line\nold line"));

	const missingHeading = insertEntryUnderHeading("# Day\n", "Trakt", "entry");
	assert.ok(missingHeading.includes("## Trakt\nentry"));

	const emptyHeading = insertEntryUnderHeading("# Day\n", "", "entry");
	assert.equal(emptyHeading.trimEnd(), "# Day\n\nentry");

	const whitespaceEntry = insertEntryUnderHeading("# Day\n", "Trakt", "   ");
	assert.equal(whitespaceEntry, "# Day\n");

	const emptyContent = insertEntryUnderHeading("", "Trakt", "entry");
	assert.ok(emptyContent.includes("## Trakt\nentry"));

	const repeatedHeading = insertEntryUnderHeading("## Trakt\nfirst\n\n## Trakt\nsecond\n", "Trakt", "new");
	assert.ok(repeatedHeading.startsWith("## Trakt\nnew\nfirst"));

	const endHeading = insertEntryUnderHeading("# Day\n## Trakt", "Trakt", "entry");
	assert.ok(endHeading.includes("## Trakt\nentry"));
}
