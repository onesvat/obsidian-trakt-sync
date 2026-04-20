import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface TraktSyncSettings {
	clientId: string;
	clientSecret: string;

	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	tokenType: string;
	scope: string;

	autoSyncOnStartup: boolean;
	historyLimit: number;

	dailyNoteSyncEnabled: boolean;
	dailyNotePathTemplate: string;
	dailyNoteHeading: string;
	dailyNoteEntryTemplate: string;

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
	clientId: "",
	clientSecret: "",

	accessToken: "",
	refreshToken: "",
	expiresAt: 0,
	tokenType: "",
	scope: "",

	autoSyncOnStartup: false,
	historyLimit: 25,

	dailyNoteSyncEnabled: true,
	dailyNotePathTemplate: "Daily/{{date:YYYY-MM-DD}}.md",
	dailyNoteHeading: "Trakt",
	dailyNoteEntryTemplate:
		"- Synced {{synced_at}}\n  - Movies watched at: {{movies_watched_at}}\n  - Episodes watched at: {{episodes_watched_at}}\n  - Shows hidden at: {{shows_hidden_at}}",

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

export class TraktSyncSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Trakt authentication" });

		new Setting(containerEl)
			.setName("Trakt client ID")
			.setDesc("Can be left empty if provided in .env as TRAKT_CLIENT_ID.")
			.addText((text) =>
				text
					.setPlaceholder("Client ID")
					.setValue(this.plugin.settings.clientId)
					.onChange(async (value) => {
						this.plugin.settings.clientId = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Trakt client secret")
			.setDesc("Can be left empty if provided in .env as TRAKT_CLIENT_SECRET.")
			.addText((text) =>
				text
					.setPlaceholder("Client secret")
					.setValue(this.plugin.settings.clientSecret)
					.onChange(async (value) => {
						this.plugin.settings.clientSecret = value.trim();
						await this.plugin.saveSettings();
					}),
			);

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
			.setDesc("Append latest Trakt activity summary to your daily note.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.dailyNoteSyncEnabled).onChange(async (value) => {
					this.plugin.settings.dailyNoteSyncEnabled = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Daily note path template")
			.setDesc("Example: Daily/{{date:YYYY-MM-DD}}.md")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.dailyNotePathTemplate)
					.onChange(async (value) => {
						this.plugin.settings.dailyNotePathTemplate = value;
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

		new Setting(containerEl)
			.setName("Daily note entry template")
			.setDesc("Supports tokens like {{synced_at}} and {{movies_watched_at}}.")
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.dailyNoteEntryTemplate)
					.onChange(async (value) => {
						this.plugin.settings.dailyNoteEntryTemplate = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h2", { text: "Media pages" });

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

		new Setting(containerEl)
			.setName("Create movie pages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createMoviePages).onChange(async (value) => {
					this.plugin.settings.createMoviePages = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Create show pages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createShowPages).onChange(async (value) => {
					this.plugin.settings.createShowPages = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Create episode pages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.createEpisodePages).onChange(async (value) => {
					this.plugin.settings.createEpisodePages = value;
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

		new Setting(containerEl)
			.setName("Movie content template")
			.addTextArea((text) =>
				text.setValue(this.plugin.settings.movieContentTemplate).onChange(async (value) => {
					this.plugin.settings.movieContentTemplate = value;
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

		new Setting(containerEl)
			.setName("Show content template")
			.addTextArea((text) =>
				text.setValue(this.plugin.settings.showContentTemplate).onChange(async (value) => {
					this.plugin.settings.showContentTemplate = value;
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

		new Setting(containerEl)
			.setName("Episode content template")
			.addTextArea((text) =>
				text.setValue(this.plugin.settings.episodeContentTemplate).onChange(async (value) => {
					this.plugin.settings.episodeContentTemplate = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
