import { App, normalizePath, TFile } from "obsidian";
import { insertEntryUnderHeading } from "./dailyNote";
import { resolveDailyNotePathTemplate } from "./dailyNotePath";
import { limitSyncedHistoryIds, TraktSyncSettings } from "./settings";
import { renderTemplate, sanitizePathSegment, slugify } from "./template";
import { TraktClient, TraktHistoryItem, TraktLastActivities } from "./traktClient";

interface SyncRuntimeValues {
	[key: string]: string;
	synced_at: string;
	synced_date: string;
	movies_watched_at: string;
	episodes_watched_at: string;
	shows_hidden_at: string;
}

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

function buildActivityValues(activities: TraktLastActivities, now: Date): SyncRuntimeValues {
	const syncedAt = now.toISOString();
	return {
		synced_at: syncedAt,
		synced_date: syncedAt.slice(0, 10),
		movies_watched_at: activities.movies?.watched_at ?? "",
		episodes_watched_at: activities.episodes?.watched_at ?? "",
		shows_hidden_at: activities.shows?.hidden_at ?? "",
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

	const dailyNotePath = normalizePath(renderTemplate(dailyNotePathTemplate, values, watchedAtDate));
	const dailyEntry = renderTemplate(settings.dailyNoteEntryTemplate, { ...runtimeValues, ...values }, now).trim();
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

function getTemplateConfig(settings: TraktSyncSettings, type: TraktHistoryItem["type"]): { fileNameTemplate: string; contentTemplate: string } {
	if (type === "movie") {
		return {
			fileNameTemplate: settings.movieFileNameTemplate,
			contentTemplate: settings.movieContentTemplate,
		};
	}

	if (type === "show") {
		return {
			fileNameTemplate: settings.showFileNameTemplate,
			contentTemplate: settings.showContentTemplate,
		};
	}

	return {
		fileNameTemplate: settings.episodeFileNameTemplate,
		contentTemplate: settings.episodeContentTemplate,
	};
}

function buildHistoryTemplateValues(item: TraktHistoryItem, now: Date): Record<string, string> | null {
	const watchedAt = item.watched_at ?? "";
	const watchedDate = formatLocalDate(now);

	if (item.type === "movie" && item.movie) {
		const movieTitle = item.movie.title;
		const movieYear = item.movie.year ? String(item.movie.year) : "";
		const movieSlug = item.movie.ids?.slug ?? slugify(`${movieTitle}-${movieYear}`);
		return {
			kind: "movie",
			icon: "🎬",
			title: movieTitle,
			watched_at: watchedAt,
			watched_date: watchedDate,
			movie_title: movieTitle,
			movie_year: movieYear,
			movie_slug: movieSlug,
			movie_trakt_id: item.movie.ids?.trakt ? String(item.movie.ids.trakt) : "",
			movie_imdb_id: item.movie.ids?.imdb ?? "",
		};
	}

	if (item.type === "show" && item.show) {
		const showTitle = item.show.title;
		const showYear = item.show.year ? String(item.show.year) : "";
		const showSlug = item.show.ids?.slug ?? slugify(`${showTitle}-${showYear}`);
		return {
			kind: "show",
			icon: "📺",
			title: showTitle,
			watched_at: watchedAt,
			watched_date: watchedDate,
			show_title: showTitle,
			show_year: showYear,
			show_slug: showSlug,
			show_trakt_id: item.show.ids?.trakt ? String(item.show.ids.trakt) : "",
			show_imdb_id: item.show.ids?.imdb ?? "",
		};
	}

	if (item.type === "episode" && item.episode && item.show) {
		const showTitle = item.show.title;
		const showYear = item.show.year ? String(item.show.year) : "";
		const showSlug = item.show.ids?.slug ?? slugify(`${showTitle}-${showYear}`);
		const episodeTitle = item.episode.title ?? "";
		const season = String(item.episode.season);
		const episodeNumber = String(item.episode.number);
		const episodeCode = `S${season.padStart(2, "0")}E${episodeNumber.padStart(2, "0")}`;
		return {
			kind: "episode",
			icon: "📺",
			title: `${showTitle} - ${episodeCode}`,
			watched_at: watchedAt,
			watched_date: watchedDate,
			show_title: showTitle,
			show_year: showYear,
			show_slug: showSlug,
			episode_title: episodeTitle,
			episode_season: season,
			episode_number: episodeNumber,
			episode_code: episodeCode,
			episode_trakt_id: item.episode.ids?.trakt ? String(item.episode.ids.trakt) : "",
			episode_imdb_id: item.episode.ids?.imdb ?? "",
		};
	}

	return null;
}

function parseWatchedAt(watchedAt: string | undefined): Date | null {
	if (!watchedAt) {
		return null;
	}

	const parsed = new Date(watchedAt);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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
