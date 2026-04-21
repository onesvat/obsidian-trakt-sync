import type { TraktSyncSettings } from "./settings";
import type { TraktHistoryItem, TraktLastActivities } from "./traktClient";
import { slugify } from "./template";

export interface SyncRuntimeValues extends Record<string, string> {
	synced_at: string;
	synced_date: string;
	movies_watched_at: string;
	episodes_watched_at: string;
	shows_hidden_at: string;
}

type TemplateConfig = Pick<
	TraktSyncSettings,
	| "movieFileNameTemplate"
	| "movieContentTemplate"
	| "showFileNameTemplate"
	| "showContentTemplate"
	| "episodeFileNameTemplate"
	| "episodeContentTemplate"
>;

export function buildActivityValues(activities: TraktLastActivities, now: Date): SyncRuntimeValues {
	const syncedAt = now.toISOString();
	return {
		synced_at: syncedAt,
		synced_date: syncedAt.slice(0, 10),
		movies_watched_at: activities.movies?.watched_at ?? "",
		episodes_watched_at: activities.episodes?.watched_at ?? "",
		shows_hidden_at: activities.shows?.hidden_at ?? "",
	};
}

export function getTemplateConfig(settings: TemplateConfig, type: TraktHistoryItem["type"]): { fileNameTemplate: string; contentTemplate: string } {
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

export function buildHistoryTemplateValues(item: TraktHistoryItem, now: Date): Record<string, string> | null {
	const watchedAt = item.watched_at ?? "";
	const watchedDate = formatLocalDate(watchedAt ? new Date(watchedAt) : now);

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
		const episodeCode = formatEpisodeCode(item.episode.season, item.episode.number);
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

export function formatEpisodeCode(season: number, episode: number): string {
	return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
