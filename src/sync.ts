import { App, normalizePath, TFile } from "obsidian";
import { insertEntryUnderHeading } from "./dailyNote";
import { TraktHistoryItem, TraktClient } from "./traktClient";
import { TraktSyncSettings } from "./settings";
import { renderTemplate, sanitizePathSegment } from "./template";
import { buildActivityValues, buildHistoryTemplateValues, getTemplateConfig, SyncRuntimeValues } from "./syncPure";

export interface SyncSummary {
	dailyNoteUpdated: boolean;
	createdMoviePages: number;
	createdShowPages: number;
	createdEpisodePages: number;
	historyItemsProcessed: number;
}

export async function syncTraktData(app: App, settings: TraktSyncSettings, client: TraktClient): Promise<SyncSummary> {
	const now = new Date();
	const activities = await client.getLastActivities();
	const history = await client.getRecentHistory(settings.historyLimit);

	const runtimeValues = buildActivityValues(activities, now);
	let dailyNoteUpdated = false;

	if (settings.dailyNoteSyncEnabled) {
		await updateDailyNote(app, settings, runtimeValues, now);
		dailyNoteUpdated = true;
	}

	let createdMoviePages = 0;
	let createdShowPages = 0;
	let createdEpisodePages = 0;

	for (const item of history) {
		if (item.type === "movie" && settings.createMoviePages) {
			const wasCreated = await createMediaPage(app, settings, item, now);
			if (wasCreated) {
				createdMoviePages += 1;
			}
		}

		if (item.type === "show" && settings.createShowPages) {
			const wasCreated = await createMediaPage(app, settings, item, now);
			if (wasCreated) {
				createdShowPages += 1;
			}
		}

		if (item.type === "episode" && settings.createEpisodePages) {
			const wasCreated = await createMediaPage(app, settings, item, now);
			if (wasCreated) {
				createdEpisodePages += 1;
			}
		}
	}

	return {
		dailyNoteUpdated,
		createdMoviePages,
		createdShowPages,
		createdEpisodePages,
		historyItemsProcessed: history.length,
	};
}

async function updateDailyNote(app: App, settings: TraktSyncSettings, values: SyncRuntimeValues, now: Date): Promise<void> {
	const dailyNotePath = normalizePath(renderTemplate(settings.dailyNotePathTemplate, values, now));
	const dailyEntry = renderTemplate(settings.dailyNoteEntryTemplate, values, now).trim();
	const file = await ensureFile(app, dailyNotePath);
	const current = await app.vault.read(file);
	const next = insertEntryUnderHeading(current, settings.dailyNoteHeading, dailyEntry);
	await app.vault.modify(file, next);
}

async function createMediaPage(app: App, settings: TraktSyncSettings, item: TraktHistoryItem, now: Date): Promise<boolean> {
	const values = buildHistoryTemplateValues(item, now);
	if (!values) {
		return false;
	}

	const config = getTemplateConfig(settings, item.type);
	const fileName = sanitizePathSegment(renderTemplate(config.fileNameTemplate, values, now).trim());
	if (!fileName) {
		return false;
	}

	const fullPath = normalizePath(`${settings.notesFolder}/${fileName}.md`);
	const existing = app.vault.getAbstractFileByPath(fullPath);
	if (existing instanceof TFile && !settings.overwriteExistingPages) {
		return false;
	}

	const content = renderTemplate(config.contentTemplate, values, now).trimEnd() + "\n";
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return true;
	}

	await ensureParentFolders(app, fullPath);
	await app.vault.create(fullPath, content);
	return true;
}

async function ensureFile(app: App, path: string): Promise<TFile> {
	await ensureParentFolders(app, path);
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		return existing;
	}

	return app.vault.create(path, "");
}

async function ensureParentFolders(app: App, filePath: string): Promise<void> {
	const parts = normalizePath(filePath).split("/");
	parts.pop();

	let current = "";
	for (const part of parts) {
		if (!part) {
			continue;
		}
		current = current ? `${current}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(current);
		if (!existing) {
			await app.vault.createFolder(current);
		}
	}
}

