import { runDailyNoteTests } from "./dailyNote.test";
import { runTemplateTests } from "./template.test";

function run(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`PASS ${name}`);
	} catch (error) {
		console.error(`FAIL ${name}`);
		throw error;
	}
}

run("template", runTemplateTests);
run("daily-note", runDailyNoteTests);

console.log("All tests passed.");
