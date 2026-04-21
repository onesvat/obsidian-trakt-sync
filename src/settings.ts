import { App, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import { getAutoDetectedDailyNotePathTemplate } from "./dailyNotePath";
import MyPlugin from "./main";

const LEGACY_DEFAULT_DAILY_NOTE_PATH_TEMPLATE = "Daily/{{date:YYYY-MM-DD}}.md";
const LEGACY_DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE =
	"- Synced {{synced_at}}\n  - Movies watched at: {{movies_watched_at}}\n  - Episodes watched at: {{episodes_watched_at}}\n  - Shows hidden at: {{shows_hidden_at}}";
const DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE = "{{icon}} - {{title}} watched";
const MAX_SYNCED_HISTORY_IDS = 500;

export interface TraktSyncSettings {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	tokenType: string;
	scope: string;

	autoSyncOnStartup: boolean;
	historyLimit: number;

	dailyNoteSyncEnabled: boolean;
	autoDetectDailyNotePath: boolean;
	dailyNotePathOverride: string;
	dailyNoteHeading: string;
	dailyNoteEntryTemplate: string;
	dailyNoteSyncedHistoryIds: number[];

	notesFolder: string;
	overwriteExistingPages: boolean;
	createMoviePages: boolean;
	createShowPages: boolean;
	createEpisodePages: boolean;

	movieFileNameTemplate: string;
	movieContentTemplate: string;
	showFileNameTemplate: string;
	showContentTemplate: string;
	episodeFileNameTemplate: string;
	episodeContentTemplate: string;

	lastSyncAt: string;
}

export const DEFAULT_SETTINGS: TraktSyncSettings = {
	accessToken: "",
	refreshToken: "",
	expiresAt: 0,
	tokenType: "",
	scope: "",

	autoSyncOnStartup: false,
	historyLimit: 25,

	dailyNoteSyncEnabled: true,
	autoDetectDailyNotePath: true,
	dailyNotePathOverride: "",
	dailyNoteHeading: "Trakt",
	dailyNoteEntryTemplate: DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE,
	dailyNoteSyncedHistoryIds: [],

	notesFolder: "Trakt",
	overwriteExistingPages: false,
	createMoviePages: true,
	createShowPages: true,
	createEpisodePages: true,

	movieFileNameTemplate: "{{movie_title}} ({{movie_year}})",
	movieContentTemplate:
		"---\nkind: movie\ntrakt_id: {{movie_trakt_id}}\nimdb_id: {{movie_imdb_id}}\nyear: {{movie_year}}\nwatched_at: {{watched_at}}\n---\n\n# {{movie_title}}\n",
	showFileNameTemplate: "{{show_title}} ({{show_year}})",
	showContentTemplate:
		"---\nkind: show\ntrakt_id: {{show_trakt_id}}\nimdb_id: {{show_imdb_id}}\nyear: {{show_year}}\nwatched_at: {{watched_at}}\n---\n\n# {{show_title}}\n",
	episodeFileNameTemplate: "{{show_title}} - {{episode_code}}",
	episodeContentTemplate:
		"---\nkind: episode\nshow: {{show_title}}\nseason: {{episode_season}}\nepisode: {{episode_number}}\ntrakt_id: {{episode_trakt_id}}\nimdb_id: {{episode_imdb_id}}\nwatched_at: {{watched_at}}\n---\n\n# {{show_title}} - {{episode_code}}\n\n{{episode_title}}\n",

	lastSyncAt: "",
};

interface LegacyTraktSyncSettings extends Partial<TraktSyncSettings> {
	clientId?: string;
	clientSecret?: string;
	dailyNotePathTemplate?: string;
}

export function normalizeLoadedSettings(stored: LegacyTraktSyncSettings | null | undefined): TraktSyncSettings {
	const settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {}) as TraktSyncSettings;
	const legacyPathTemplate = typeof stored?.dailyNotePathTemplate === "string" ? stored.dailyNotePathTemplate.trim() : "";

	if (stored && !("autoDetectDailyNotePath" in stored) && !("dailyNotePathOverride" in stored)) {
		settings.autoDetectDailyNotePath = legacyPathTemplate === "" || legacyPathTemplate === LEGACY_DEFAULT_DAILY_NOTE_PATH_TEMPLATE;
		settings.dailyNotePathOverride = settings.autoDetectDailyNotePath ? "" : legacyPathTemplate;
	}

	if (stored && stored.dailyNoteEntryTemplate === LEGACY_DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE) {
		settings.dailyNoteEntryTemplate = DEFAULT_DAILY_NOTE_ENTRY_TEMPLATE;
	}

	if (!Array.isArray(settings.dailyNoteSyncedHistoryIds)) {
		settings.dailyNoteSyncedHistoryIds = [];
	}

	settings.dailyNoteSyncedHistoryIds = settings.dailyNoteSyncedHistoryIds
		.filter((value): value is number => Number.isInteger(value) && value > 0)
		.slice(0, MAX_SYNCED_HISTORY_IDS);

	return settings;
}

export function limitSyncedHistoryIds(ids: number[]): number[] {
	return ids.filter((value, index) => Number.isInteger(value) && value > 0 && ids.indexOf(value) === index).slice(0, MAX_SYNCED_HISTORY_IDS);
}

export class TraktSyncSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("trakt-sync-settings");

		containerEl.createEl("h2", { text: "Trakt authentication" });

		new Setting(containerEl)
			.setName("Authentication actions")
			.setDesc(this.plugin.hasAuthToken() ? "Authenticated" : "Not authenticated")
			.addButton((button) =>
				button.setButtonText("Authenticate").onClick(async () => {
					await this.plugin.authenticateWithTrakt();
					this.display();
				}),
			)
			.addButton((button) =>
				button.setButtonText("Clear token").onClick(async () => {
					await this.plugin.clearAuth();
					this.display();
				}),
			)
			.addButton((button) =>
				button.setButtonText("Sync now").onClick(async () => {
					await this.plugin.runSync(true);
					this.display();
				}),
			);

		containerEl.createEl("h2", { text: "Sync behavior" });

		new Setting(containerEl)
			.setName("Auto sync on startup")
			.setDesc("Run a sync when Obsidian starts and authentication is available.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSyncOnStartup).onChange(async (value) => {
					this.plugin.settings.autoSyncOnStartup = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("History items per sync")
			.setDesc("How many recent history items to fetch from /sync/history.")
			.addText((text) =>
				text.setValue(String(this.plugin.settings.historyLimit)).onChange(async (value) => {
					const parsed = Number.parseInt(value, 10);
					if (!Number.isNaN(parsed) && parsed > 0) {
						this.plugin.settings.historyLimit = parsed;
						await this.plugin.saveSettings();
					}
				}),
			);

		new Setting(containerEl)
			.setName("Last successful sync")
			.setDesc(this.plugin.settings.lastSyncAt || "Never");

		containerEl.createEl("h2", { text: "Daily note sync" });

		new Setting(containerEl)
			.setName("Enable daily note sync")
			.setDesc("Append watched items to the watched day note when that note already exists.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.dailyNoteSyncEnabled).onChange(async (value) => {
					this.plugin.settings.dailyNoteSyncEnabled = value;
					await this.plugin.saveSettings();
				}),
			);

		const autoDetectedTemplate = getAutoDetectedDailyNotePathTemplate(this.app);
		new Setting(containerEl)
			.setName("Detect daily note path automatically")
			.setDesc(autoDetectedTemplate ? `Detected: ${autoDetectedTemplate}` : "No daily note plugin settings detected. Fallback will be used unless you set an override.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoDetectDailyNotePath).onChange(async (value) => {
					this.plugin.settings.autoDetectDailyNotePath = value;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Daily note path override")
			.setDesc("Used only when automatic detection is disabled. Example: Daily/{{date:YYYY-MM-DD}}.md")
			.setDisabled(this.plugin.settings.autoDetectDailyNotePath)
			.addText((text) =>
				text.setValue(this.plugin.settings.dailyNotePathOverride).onChange(async (value) => {
					this.plugin.settings.dailyNotePathOverride = value.trim();
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Daily note heading")
			.setDesc("Section heading where entries are inserted.")
			.addText((text) =>
				text.setValue(this.plugin.settings.dailyNoteHeading).onChange(async (value) => {
					this.plugin.settings.dailyNoteHeading = value;
					await this.plugin.saveSettings();
				}),
			);

		addTemplateTextArea(
			containerEl,
			"Daily note entry template",
			"Supports tokens like {{icon}}, {{title}}, {{kind}}, {{watched_at}}, {{watched_date}}, {{movie_title}}, {{show_title}}, and {{episode_code}}.",
			this.plugin.settings.dailyNoteEntryTemplate,
			async (value) => {
				this.plugin.settings.dailyNoteEntryTemplate = value;
				await this.plugin.saveSettings();
			},
		);

		containerEl.createEl("h2", { text: "Output" });

		new Setting(containerEl)
			.setName("Notes folder")
			.setDesc("Folder where media pages are created.")
			.addText((text) =>
				text.setValue(this.plugin.settings.notesFolder).onChange(async (value) => {
					this.plugin.settings.notesFolder = value.trim() || "Trakt";
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Overwrite existing pages")
			.setDesc("If disabled, existing files are not changed.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.overwriteExistingPages).onChange(async (value) => {
					this.plugin.settings.overwriteExistingPages = value;
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("h2", { text: "Movies" });

		new Setting(containerEl)
			.setName("Create movie pages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createMoviePages).onChange(async (value) => {
					this.plugin.settings.createMoviePages = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Movie file name template")
			.setDesc("Example: {{movie_title}} ({{movie_year}})")
			.addText((text) =>
				text.setValue(this.plugin.settings.movieFileNameTemplate).onChange(async (value) => {
					this.plugin.settings.movieFileNameTemplate = value;
					await this.plugin.saveSettings();
				}),
			);

		addTemplateTextArea(containerEl, "Movie content template", "Available movie tokens include {{movie_title}}, {{movie_year}}, {{movie_trakt_id}}, {{movie_imdb_id}}, {{watched_at}}, and {{watched_date}}.", this.plugin.settings.movieContentTemplate, async (value) => {
			this.plugin.settings.movieContentTemplate = value;
			await this.plugin.saveSettings();
		});

		containerEl.createEl("h2", { text: "Shows & episodes" });

		new Setting(containerEl)
			.setName("Create show pages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createShowPages).onChange(async (value) => {
					this.plugin.settings.createShowPages = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Show file name template")
			.setDesc("Example: {{show_title}} ({{show_year}})")
			.addText((text) =>
				text.setValue(this.plugin.settings.showFileNameTemplate).onChange(async (value) => {
					this.plugin.settings.showFileNameTemplate = value;
					await this.plugin.saveSettings();
				}),
			);

		addTemplateTextArea(containerEl, "Show content template", "Available show tokens include {{show_title}}, {{show_year}}, {{show_trakt_id}}, {{show_imdb_id}}, {{watched_at}}, and {{watched_date}}.", this.plugin.settings.showContentTemplate, async (value) => {
			this.plugin.settings.showContentTemplate = value;
			await this.plugin.saveSettings();
		});

		new Setting(containerEl)
			.setName("Create episode pages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createEpisodePages).onChange(async (value) => {
					this.plugin.settings.createEpisodePages = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Episode file name template")
			.setDesc("Example: {{show_title}} - {{episode_code}}")
			.addText((text) =>
				text.setValue(this.plugin.settings.episodeFileNameTemplate).onChange(async (value) => {
					this.plugin.settings.episodeFileNameTemplate = value;
					await this.plugin.saveSettings();
				}),
			);

		addTemplateTextArea(containerEl, "Episode content template", "Available episode tokens include {{show_title}}, {{episode_title}}, {{episode_code}}, {{episode_season}}, {{episode_number}}, {{episode_trakt_id}}, {{episode_imdb_id}}, {{watched_at}}, and {{watched_date}}.", this.plugin.settings.episodeContentTemplate, async (value) => {
			this.plugin.settings.episodeContentTemplate = value;
			await this.plugin.saveSettings();
		});
	}
}

function addTemplateTextArea(
	containerEl: HTMLElement,
	name: string,
	description: string,
	value: string,
	onChange: (value: string) => Promise<void>,
): void {
	new Setting(containerEl)
		.setName(name)
		.setDesc(description)
		.setClass("trakt-sync-template-setting")
		.addTextArea((text) => configureTemplateTextArea(text, value, onChange));
}

function configureTemplateTextArea(
	text: TextAreaComponent,
	value: string,
	onChange: (value: string) => Promise<void>,
): void {
	text.setValue(value).onChange(onChange);
	text.inputEl.rows = 8;
	text.inputEl.addClass("trakt-sync-template-input");
}
