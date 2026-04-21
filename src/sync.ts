import { App, normalizePath, TFile } from "obsidian";
import { insertEntryUnderHeading } from "./dailyNote";
import { resolveDailyNotePathTemplate } from "./dailyNotePath";
import { resolveNoteTarget } from "./noteTarget";
import { limitSyncedHistoryIds, TraktSyncSettings } from "./settings";
import { buildActivityValues, buildHistoryTemplateValues, SyncRuntimeValues } from "./syncPure";
import { renderTemplate } from "./template";
import { TraktClient, TraktHistoryItem } from "./traktClient";

interface DailyNoteUpdateResult {
	updated: boolean;
	syncedIds: number[];
}

interface DailyNoteEntry {
	historyId: number;
	path: string;
	content: string;
}

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
		const dailyNoteResult = await updateDailyNotes(app, settings, history, runtimeValues, now);
		dailyNoteUpdated = dailyNoteResult.updated;
		settings.dailyNoteSyncedHistoryIds = dailyNoteResult.syncedIds;
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

async function updateDailyNotes(
	app: App,
	settings: TraktSyncSettings,
	history: TraktHistoryItem[],
	runtimeValues: SyncRuntimeValues,
	now: Date,
): Promise<DailyNoteUpdateResult> {
	const alreadySynced = new Set(settings.dailyNoteSyncedHistoryIds);
	const updatedSyncedIds = [...settings.dailyNoteSyncedHistoryIds];
	const dailyNotePathTemplate = resolveDailyNotePathTemplate(app, settings);
	const pendingEntries = new Map<string, DailyNoteEntry[]>();

	for (const item of history) {
		if (alreadySynced.has(item.id)) {
			continue;
		}

		const entry = buildDailyNoteEntry(item, settings, dailyNotePathTemplate, runtimeValues, now);
		if (!entry) {
			continue;
		}

		const file = app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) {
			continue;
		}

		const entriesForPath = pendingEntries.get(entry.path) ?? [];
		entriesForPath.push(entry);
		pendingEntries.set(entry.path, entriesForPath);
		alreadySynced.add(item.id);
		updatedSyncedIds.push(item.id);
	}

	let updated = false;
	for (const [path, entries] of pendingEntries) {
		const file = app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			continue;
		}

		const entryBlock = entries.map((entry) => entry.content).join("\n");
		if (!entryBlock.trim()) {
			continue;
		}

		const current = await app.vault.read(file);
		const next = insertEntryUnderHeading(current, settings.dailyNoteHeading, entryBlock);
		if (next !== current) {
			await app.vault.modify(file, next);
			updated = true;
		}
	}

	return {
		updated,
		syncedIds: limitSyncedHistoryIds(updatedSyncedIds.reverse()).reverse(),
	};
}

function buildDailyNoteEntry(
	item: TraktHistoryItem,
	settings: TraktSyncSettings,
	dailyNotePathTemplate: string,
	runtimeValues: SyncRuntimeValues,
	now: Date,
): DailyNoteEntry | null {
	const watchedAtDate = parseWatchedAt(item.watched_at);
	if (!watchedAtDate) {
		return null;
	}

	const values = buildHistoryTemplateValues(item, watchedAtDate);
	if (!values) {
		return null;
	}

	const noteTarget = resolveNoteTarget(settings, item, now);
	if (!noteTarget) {
		return null;
	}

	const dailyNotePath = normalizePath(renderTemplate(dailyNotePathTemplate, values, watchedAtDate));
	const dailyEntry = renderTemplate(settings.dailyNoteEntryTemplate, { ...runtimeValues, ...noteTarget.values }, now).trim();
	if (!dailyEntry) {
		return null;
	}

	return {
		historyId: item.id,
		path: dailyNotePath,
		content: dailyEntry,
	};
}

async function createMediaPage(app: App, settings: TraktSyncSettings, item: TraktHistoryItem, now: Date): Promise<boolean> {
	const noteTarget = resolveNoteTarget(settings, item, now);
	if (!noteTarget) {
		return false;
	}

	const fullPath = noteTarget.notePath;
	const existing = app.vault.getAbstractFileByPath(fullPath);
	if (existing instanceof TFile && !settings.overwriteExistingPages) {
		return false;
	}

	const values = buildHistoryTemplateValues(item, now);
	if (!values) {
		return false;
	}

	const contentTemplate = getContentTemplate(settings, item.type);
	const content = renderTemplate(contentTemplate, values, now).trimEnd() + "\n";
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return true;
	}

	await ensureParentFolders(app, fullPath);
	await app.vault.create(fullPath, content);
	return true;
}

function getContentTemplate(
	settings: Pick<TraktSyncSettings, "movieContentTemplate" | "showContentTemplate" | "episodeContentTemplate">,
	type: TraktHistoryItem["type"],
): string {
	if (type === "movie") {
		return settings.movieContentTemplate;
	}

	if (type === "show") {
		return settings.showContentTemplate;
	}

	return settings.episodeContentTemplate;
}

function parseWatchedAt(watchedAt: string | undefined): Date | null {
	if (!watchedAt) {
		return null;
	}

	const parsed = new Date(watchedAt);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
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
