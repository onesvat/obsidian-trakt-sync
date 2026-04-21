import * as assert from "node:assert/strict";
import { DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE, normalizeLoadedSettings } from "../src/settings";

export function runSettingsTests(): void {
	const migrated = normalizeLoadedSettings({
		dailyNoteEntryTemplate: "{{icon}} - {{title}} watched",
	});
	assert.equal(migrated.dailyNoteEntryTemplate, DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE);

	const customized = normalizeLoadedSettings({
		dailyNoteEntryTemplate: "- {{icon}} {{title}} watched in {{watched_date}}",
	});
	assert.equal(customized.dailyNoteEntryTemplate, "- {{icon}} {{title}} watched in {{watched_date}}");

	const legacySummary = normalizeLoadedSettings({
		dailyNoteEntryTemplate:
			"- Synced {{synced_at}}\n  - Movies watched at: {{movies_watched_at}}\n  - Episodes watched at: {{episodes_watched_at}}\n  - Shows hidden at: {{shows_hidden_at}}",
	});
	assert.equal(legacySummary.dailyNoteEntryTemplate, DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE);
}
