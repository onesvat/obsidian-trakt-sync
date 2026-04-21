import { App, normalizePath } from "obsidian";
import { TraktSyncSettings } from "./settings";

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";
const FALLBACK_DAILY_NOTE_PATH_TEMPLATE = "Daily/{{date:YYYY-MM-DD}}.md";

export function resolveDailyNotePathTemplate(app: App, settings: TraktSyncSettings): string {
	if (!settings.autoDetectDailyNotePath) {
		const manualTemplate = settings.dailyNotePathOverride.trim();
		return manualTemplate || FALLBACK_DAILY_NOTE_PATH_TEMPLATE;
	}

	return (getAutoDetectedDailyNotePathTemplate(app) ?? settings.dailyNotePathOverride.trim()) || FALLBACK_DAILY_NOTE_PATH_TEMPLATE;
}

export function getAutoDetectedDailyNotePathTemplate(app: App): string | null {
	const appWithPlugins = app as App & {
		plugins?: {
			getPlugin?: (id: string) => {
				settings?: {
					daily?: {
						enabled?: boolean;
						folder?: string;
						format?: string;
					};
				};
			} | null;
		};
		internalPlugins?: {
			getPluginById?: (id: string) => {
				instance?: {
					options?: {
						folder?: string;
						format?: string;
					};
				};
			} | null;
		};
	};

	const periodicDaily = appWithPlugins.plugins?.getPlugin?.("periodic-notes")?.settings?.daily;
	if (periodicDaily?.enabled) {
		return buildPathTemplate(periodicDaily.folder, periodicDaily.format);
	}

	const coreDaily = appWithPlugins.internalPlugins?.getPluginById?.("daily-notes")?.instance?.options;
	if (coreDaily) {
		return buildPathTemplate(coreDaily.folder, coreDaily.format);
	}

	return null;
}

function buildPathTemplate(folder?: string, format?: string): string {
	const cleanFolder = folder?.trim() ?? "";
	const dateToken = `{{date:${format?.trim() || DEFAULT_DAILY_NOTE_FORMAT}}}`;
	const fullPath = cleanFolder ? `${cleanFolder}/${dateToken}.md` : `${dateToken}.md`;
	return normalizePath(fullPath);
}
