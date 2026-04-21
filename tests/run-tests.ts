import { runDailyNotePathTests } from "./dailyNotePath.test";
import { runDailyNoteTests } from "./dailyNote.test";
import { runSettingsTests } from "./settings.test";
import { runSyncTests } from "./sync.test";
import { runTemplateTests } from "./template.test";

async function run(name: string, test: () => void | Promise<void>): Promise<void> {
	try {
		await test();
		console.log(`PASS ${name}`);
		return;
	} catch (error) {
		console.error(`FAIL ${name}`);
		throw error;
	}
}

async function main(): Promise<void> {
	await run("template", runTemplateTests);
	await run("daily-note", runDailyNoteTests);
	await run("daily-note-path", runDailyNotePathTests);
	await run("settings", runSettingsTests);
	await run("sync", runSyncTests);
}

void main();
