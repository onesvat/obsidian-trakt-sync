import * as assert from "node:assert/strict";
import { TFile } from "obsidian";
import { DEFAULT_SETTINGS, TraktSyncSettings } from "../src/settings";
import { syncTraktData } from "../src/sync";
import { buildActivityValues, buildHistoryTemplateValues, formatEpisodeCode, getTemplateConfig } from "../src/syncPure";
import { TraktClient, TraktHistoryItem, TraktLastActivities } from "../src/traktClient";

class FakeClient {
	constructor(
		private readonly activities: TraktLastActivities,
		private readonly history: TraktHistoryItem[],
	) {}

	async getLastActivities(): Promise<TraktLastActivities> {
		return this.activities;
	}

	async getRecentHistory(): Promise<TraktHistoryItem[]> {
		return this.history;
	}
}

class FakeVault {
	private readonly files = new Map<string, string>();
	private readonly folders = new Set<string>();

	constructor(initialFiles: Record<string, string>) {
		for (const [path, content] of Object.entries(initialFiles)) {
			this.files.set(path, content);
		}
	}

	getAbstractFileByPath(path: string): TFile | { path: string } | null {
		if (this.files.has(path)) {
			return createTestFile(path);
		}
		if (this.folders.has(path)) {
			return { path };
		}
		return null;
	}

	async read(file: TFile): Promise<string> {
		return this.files.get(file.path) ?? "";
	}

	async modify(file: TFile, content: string): Promise<void> {
		this.files.set(file.path, content);
	}

	async create(path: string, content: string): Promise<TFile> {
		this.files.set(path, content);
		return createTestFile(path);
	}

	async createFolder(path: string): Promise<void> {
		this.folders.add(path);
	}

	readPath(path: string): string | undefined {
		return this.files.get(path);
	}
}

export async function runSyncTests(): Promise<void> {
	const now = new Date("2026-04-20T12:00:00.000Z");
	const activityValues = buildActivityValues({}, now);
	assert.equal(activityValues.synced_at, "2026-04-20T12:00:00.000Z");
	assert.equal(activityValues.synced_date, "2026-04-20");
	assert.equal(activityValues.movies_watched_at, "");

	const movieValues = buildHistoryTemplateValues(
		{
			id: 1,
			type: "movie",
			watched_at: "2026-04-20T10:00:00.000Z",
			movie: { title: "Dune", year: 2021, ids: { trakt: 42, imdb: "tt1160419", slug: "dune-2021" } },
		},
		now,
	);
	assert.ok(movieValues !== null);
	assert.equal(movieValues.movie_title, "Dune");
	assert.equal(movieValues.icon, "🎬");
	assert.equal(movieValues.title, "Dune");

	const episodeValues = buildHistoryTemplateValues(
		{
			id: 2,
			type: "episode",
			watched_at: "2026-04-20T10:00:00.000Z",
			show: { title: "Breaking Bad", year: 2008, ids: { slug: "breaking-bad" } },
			episode: { season: 1, number: 1, title: "Pilot", ids: { trakt: 99 } },
		},
		now,
	);
	assert.ok(episodeValues !== null);
	assert.equal(episodeValues.episode_code, "S01E01");
	assert.equal(episodeValues.title, "Breaking Bad - S01E01");
	assert.equal(formatEpisodeCode(10, 10), "S10E10");

	type TemplateSettings = Pick<
		TraktSyncSettings,
		| "movieFileNameTemplate"
		| "movieContentTemplate"
		| "showFileNameTemplate"
		| "showContentTemplate"
		| "episodeFileNameTemplate"
		| "episodeContentTemplate"
	>;
	const templateSettings: TemplateSettings = {
		movieFileNameTemplate: "movie-fn",
		movieContentTemplate: "movie-ct",
		showFileNameTemplate: "show-fn",
		showContentTemplate: "show-ct",
		episodeFileNameTemplate: "episode-fn",
		episodeContentTemplate: "episode-ct",
	};
	assert.deepEqual(getTemplateConfig(templateSettings, "movie"), { fileNameTemplate: "movie-fn", contentTemplate: "movie-ct" });
	assert.deepEqual(getTemplateConfig(templateSettings, "show"), { fileNameTemplate: "show-fn", contentTemplate: "show-ct" });
	assert.deepEqual(getTemplateConfig(templateSettings, "episode"), { fileNameTemplate: "episode-fn", contentTemplate: "episode-ct" });

	const history: TraktHistoryItem[] = [
		{
			id: 10,
			type: "episode",
			watched_at: "2026-04-20T23:30:00.000Z",
			show: { title: "Severance", year: 2022, ids: { slug: "severance", trakt: 12, imdb: "tt11280740" } },
			episode: { title: "Hello, Ms. Cobel", season: 1, number: 1, ids: { trakt: 99, imdb: "tt11280741" } },
		},
		{
			id: 9,
			type: "movie",
			watched_at: "2026-04-20T20:00:00.000Z",
			movie: { title: "Dune", year: 2021, ids: { slug: "dune-2021", trakt: 1, imdb: "tt1160419" } },
		},
		{
			id: 8,
			type: "movie",
			watched_at: "2026-04-19T20:00:00.000Z",
			movie: { title: "Arrival", year: 2016, ids: { slug: "arrival-2016", trakt: 2, imdb: "tt2543164" } },
		},
	];
	const client = new FakeClient({}, history) as unknown as TraktClient;
	const vault = new FakeVault({
		"Daily/2026-04-21.md": "# 2026-04-21\n\n## Trakt\nold line\n",
		"Daily/2026-04-20.md": "# 2026-04-20\n",
	});
	const app = { vault } as never;
	const settings: TraktSyncSettings = {
		...DEFAULT_SETTINGS,
		dailyNoteSyncedHistoryIds: [99],
	};

	const summary = await syncTraktData(app, settings, client);
	assert.equal(summary.dailyNoteUpdated, true);
	assert.match(vault.readPath("Daily/2026-04-21.md") ?? "", /📺 - Severance - S01E01 watched\nold line/);
	assert.match(vault.readPath("Daily/2026-04-20.md") ?? "", /## Trakt\n🎬 - Dune watched/);
	assert.deepEqual(settings.dailyNoteSyncedHistoryIds, [99, 10, 9]);

	const missingNoteVault = new FakeVault({});
	const missingApp = { vault: missingNoteVault } as never;
	const missingSettings: TraktSyncSettings = { ...DEFAULT_SETTINGS };
	const missingSummary = await syncTraktData(missingApp, missingSettings, client);
	assert.equal(missingSummary.dailyNoteUpdated, false);
	assert.deepEqual(missingSettings.dailyNoteSyncedHistoryIds, []);
	assert.equal(missingNoteVault.readPath("Daily/2026-04-20.md"), undefined);

	const duplicateVault = new FakeVault({
		"Daily/2026-04-21.md": "# 2026-04-21\n\n## Trakt\nold line\n",
		"Daily/2026-04-20.md": "# 2026-04-20\n",
	});
	const duplicateSettings: TraktSyncSettings = {
		...DEFAULT_SETTINGS,
		dailyNoteSyncedHistoryIds: [10, 9],
		historyLimit: 2,
	};
	await syncTraktData({ vault: duplicateVault } as never, duplicateSettings, new FakeClient({}, history.slice(0, 2)) as unknown as TraktClient);
	assert.equal(duplicateVault.readPath("Daily/2026-04-21.md"), "# 2026-04-21\n\n## Trakt\nold line\n");
	assert.equal(duplicateVault.readPath("Daily/2026-04-20.md"), "# 2026-04-20\n");
	assert.deepEqual(duplicateSettings.dailyNoteSyncedHistoryIds, [10, 9]);
}

function createTestFile(path: string): TFile {
	const FileCtor = TFile as unknown as { new (path: string): TFile };
	return new FileCtor(path);
}
