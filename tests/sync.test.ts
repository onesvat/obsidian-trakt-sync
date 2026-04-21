import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildActivityValues, buildHistoryTemplateValues, getTemplateConfig } from "../src/syncPure";
import type { TraktHistoryItem, TraktLastActivities } from "../src/traktClient";
import type { TraktSyncSettings } from "../src/settings";

describe("buildActivityValues", () => {
	const now = new Date("2026-04-20T12:00:00.000Z");

	it("captures synced_at and synced_date from now", () => {
		const result = buildActivityValues({}, now);
		assert.equal(result.synced_at, "2026-04-20T12:00:00.000Z");
		assert.equal(result.synced_date, "2026-04-20");
	});

	it("maps all three activity timestamps", () => {
		const activities: TraktLastActivities = {
			movies: { watched_at: "2026-04-19T10:00:00.000Z" },
			episodes: { watched_at: "2026-04-18T10:00:00.000Z" },
			shows: { hidden_at: "2026-04-17T10:00:00.000Z" },
		};
		const result = buildActivityValues(activities, now);
		assert.equal(result.movies_watched_at, "2026-04-19T10:00:00.000Z");
		assert.equal(result.episodes_watched_at, "2026-04-18T10:00:00.000Z");
		assert.equal(result.shows_hidden_at, "2026-04-17T10:00:00.000Z");
	});

	it("falls back to empty strings when activity sub-objects are absent", () => {
		const result = buildActivityValues({}, now);
		assert.equal(result.movies_watched_at, "");
		assert.equal(result.episodes_watched_at, "");
		assert.equal(result.shows_hidden_at, "");
	});
});

describe("buildHistoryTemplateValues — movie", () => {
	const now = new Date("2026-04-20T12:00:00.000Z");

	it("returns all expected keys for a fully-populated movie item", () => {
		const item: TraktHistoryItem = {
			id: 1,
			type: "movie",
			watched_at: "2026-04-20T10:00:00.000Z",
			movie: {
				title: "Dune",
				year: 2021,
				ids: { trakt: 42, imdb: "tt1160419", slug: "dune-2021" },
			},
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.kind, "movie");
		assert.equal(result.movie_title, "Dune");
		assert.equal(result.movie_year, "2021");
		assert.equal(result.movie_slug, "dune-2021");
		assert.equal(result.movie_trakt_id, "42");
		assert.equal(result.movie_imdb_id, "tt1160419");
		assert.equal(result.watched_at, "2026-04-20T10:00:00.000Z");
		assert.equal(result.watched_date, "2026-04-20");
	});

	it("falls back to a slugified title when no ids.slug is provided", () => {
		const item: TraktHistoryItem = {
			id: 2,
			type: "movie",
			watched_at: "2026-04-20T10:00:00.000Z",
			movie: { title: "Dune Part Two", year: 2024 },
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.movie_slug, "dune-part-two-2024");
	});

	it("returns an empty string for movie_year when year is absent", () => {
		const item: TraktHistoryItem = {
			id: 3,
			type: "movie",
			watched_at: "2026-04-20T10:00:00.000Z",
			movie: { title: "Unknown" },
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.movie_year, "");
	});

	it("returns null when type is movie but movie data is absent", () => {
		const item: TraktHistoryItem = { id: 4, type: "movie", watched_at: "2026-04-20T10:00:00.000Z" };
		assert.equal(buildHistoryTemplateValues(item, now), null);
	});
});

describe("buildHistoryTemplateValues — show", () => {
	const now = new Date("2026-04-20T12:00:00.000Z");

	it("returns all expected keys for a fully-populated show item", () => {
		const item: TraktHistoryItem = {
			id: 5,
			type: "show",
			watched_at: "2026-04-20T10:00:00.000Z",
			show: {
				title: "The Last of Us",
				year: 2023,
				ids: { trakt: 10, imdb: "tt3581920", slug: "the-last-of-us" },
			},
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.kind, "show");
		assert.equal(result.show_title, "The Last of Us");
		assert.equal(result.show_year, "2023");
		assert.equal(result.show_slug, "the-last-of-us");
		assert.equal(result.show_trakt_id, "10");
		assert.equal(result.show_imdb_id, "tt3581920");
	});

	it("returns null when type is show but show data is absent", () => {
		const item: TraktHistoryItem = { id: 6, type: "show", watched_at: "2026-04-20T10:00:00.000Z" };
		assert.equal(buildHistoryTemplateValues(item, now), null);
	});
});

describe("buildHistoryTemplateValues — episode", () => {
	const now = new Date("2026-04-20T12:00:00.000Z");

	it("returns all expected keys and pads single-digit season/episode numbers", () => {
		const item: TraktHistoryItem = {
			id: 7,
			type: "episode",
			watched_at: "2026-04-20T10:00:00.000Z",
			show: { title: "Breaking Bad", year: 2008, ids: { slug: "breaking-bad" } },
			episode: { season: 1, number: 1, title: "Pilot", ids: { trakt: 99 } },
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.kind, "episode");
		assert.equal(result.episode_code, "S01E01");
		assert.equal(result.episode_season, "1");
		assert.equal(result.episode_number, "1");
		assert.equal(result.episode_title, "Pilot");
		assert.equal(result.episode_trakt_id, "99");
	});

	it("does not pad two-digit season and episode numbers", () => {
		const item: TraktHistoryItem = {
			id: 8,
			type: "episode",
			watched_at: "2026-04-20T10:00:00.000Z",
			show: { title: "Breaking Bad", year: 2008 },
			episode: { season: 10, number: 10, title: "Finale" },
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.episode_code, "S10E10");
	});

	it("returns an empty string for episode_title when title is absent", () => {
		const item: TraktHistoryItem = {
			id: 9,
			type: "episode",
			watched_at: "2026-04-20T10:00:00.000Z",
			show: { title: "Some Show", year: 2020 },
			episode: { season: 2, number: 3 },
		};
		const result = buildHistoryTemplateValues(item, now);
		assert.ok(result !== null);
		assert.equal(result.episode_title, "");
	});

	it("returns null when episode data is absent", () => {
		const item: TraktHistoryItem = {
			id: 10,
			type: "episode",
			watched_at: "2026-04-20T10:00:00.000Z",
			show: { title: "Some Show", year: 2020 },
		};
		assert.equal(buildHistoryTemplateValues(item, now), null);
	});

	it("returns null when show data is absent for an episode item", () => {
		const item: TraktHistoryItem = {
			id: 11,
			type: "episode",
			watched_at: "2026-04-20T10:00:00.000Z",
			episode: { season: 1, number: 1 },
		};
		assert.equal(buildHistoryTemplateValues(item, now), null);
	});
});

describe("getTemplateConfig", () => {
	const settings = {
		movieFileNameTemplate: "movie-fn",
		movieContentTemplate: "movie-ct",
		showFileNameTemplate: "show-fn",
		showContentTemplate: "show-ct",
		episodeFileNameTemplate: "episode-fn",
		episodeContentTemplate: "episode-ct",
	} as unknown as TraktSyncSettings;

	it("returns movie templates for type movie", () => {
		const config = getTemplateConfig(settings, "movie");
		assert.equal(config.fileNameTemplate, "movie-fn");
		assert.equal(config.contentTemplate, "movie-ct");
	});

	it("returns show templates for type show", () => {
		const config = getTemplateConfig(settings, "show");
		assert.equal(config.fileNameTemplate, "show-fn");
		assert.equal(config.contentTemplate, "show-ct");
	});

	it("returns episode templates for type episode", () => {
		const config = getTemplateConfig(settings, "episode");
		assert.equal(config.fileNameTemplate, "episode-fn");
		assert.equal(config.contentTemplate, "episode-ct");
	});
});
