import * as assert from "node:assert/strict";
import { getAutoDetectedDailyNotePathTemplate, resolveDailyNotePathTemplate } from "../src/dailyNotePath";
import { DEFAULT_SETTINGS, TraktSyncSettings } from "../src/settings";

export function runDailyNotePathTests(): void {
	const periodicApp = {
		plugins: {
			getPlugin: (id: string) => {
				if (id === "periodic-notes") {
					return {
						settings: {
							daily: {
								enabled: true,
								folder: "Journal/Daily",
								format: "YYYY/MM/DD",
							},
						},
					};
				}
				return null;
			},
		},
		internalPlugins: {
			getPluginById: () => ({
				instance: {
					options: {
						folder: "Daily",
						format: "YYYY-MM-DD",
					},
				},
			}),
		},
	} as never;
	assert.equal(getAutoDetectedDailyNotePathTemplate(periodicApp), "Journal/Daily/{{date:YYYY/MM/DD}}.md");

	const coreOnlyApp = {
		plugins: {
			getPlugin: () => null,
		},
		internalPlugins: {
			getPluginById: () => ({
				instance: {
					options: {
						folder: "Daily",
						format: "YYYY-MM-DD",
					},
				},
			}),
		},
	} as never;
	assert.equal(getAutoDetectedDailyNotePathTemplate(coreOnlyApp), "Daily/{{date:YYYY-MM-DD}}.md");

	const manualSettings: TraktSyncSettings = {
		...DEFAULT_SETTINGS,
		autoDetectDailyNotePath: false,
		dailyNotePathOverride: "Journal/{{date:YYYY-MM-DD}}.md",
	};
	assert.equal(resolveDailyNotePathTemplate(coreOnlyApp, manualSettings), "Journal/{{date:YYYY-MM-DD}}.md");

	const fallbackApp = {
		plugins: {
			getPlugin: () => null,
		},
		internalPlugins: {
			getPluginById: () => null,
		},
	} as never;
	assert.equal(resolveDailyNotePathTemplate(fallbackApp, DEFAULT_SETTINGS), "Daily/{{date:YYYY-MM-DD}}.md");
}
