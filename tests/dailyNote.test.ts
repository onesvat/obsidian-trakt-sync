import assert from "node:assert/strict";
import { insertEntryUnderHeading } from "../src/dailyNote";

export function runDailyNoteTests(): void {
	const existingHeadingContent = "# Day\n\n## Trakt\nold line\n";
	const existingHeadingOutput = insertEntryUnderHeading(existingHeadingContent, "Trakt", "new line");
	assert.ok(existingHeadingOutput.includes("## Trakt\nnew line\nold line"));

	const missingHeadingContent = "# Day\n";
	const missingHeadingOutput = insertEntryUnderHeading(missingHeadingContent, "Trakt", "entry");
	assert.ok(missingHeadingOutput.includes("## Trakt\nentry"));

	const emptyHeadingContent = "# Day\n";
	const emptyHeadingOutput = insertEntryUnderHeading(emptyHeadingContent, "", "entry");
	assert.equal(emptyHeadingOutput.trimEnd(), "# Day\n\nentry");

	const emptyEntryContent = "# Day\n";
	const emptyEntryOutput = insertEntryUnderHeading(emptyEntryContent, "Trakt", "   ");
	assert.equal(emptyEntryOutput, emptyEntryContent);
}
