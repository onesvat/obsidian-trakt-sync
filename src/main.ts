import { App, Modal, Notice, Plugin } from "obsidian";
import { getBuildEnvConfig } from "./env";
import { TraktSyncSettings, TraktSyncSettingTab, DEFAULT_SETTINGS } from "./settings";
import { syncTraktData } from "./sync";
import { StoredTraktAuth, TraktClient } from "./traktClient";

const DEVICE_AUTH_TIMEOUT_SECONDS = 15 * 60;

export default class MyPlugin extends Plugin {
	settings: TraktSyncSettings;
	private readonly buildEnv = getBuildEnvConfig();
	private traktClient: TraktClient;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.initializeBuildEnvDefaults();
		this.traktClient = this.createTraktClient();

		this.addRibbonIcon("refresh-cw", "Sync Trakt activity", async () => {
			await this.runSync(true);
		});

		this.addCommand({
			id: "trakt-authenticate",
			name: "Trakt: authenticate",
			callback: async () => {
				await this.authenticateWithTrakt();
			},
		});

		this.addCommand({
			id: "trakt-sync-now",
			name: "Trakt: sync now",
			callback: async () => {
				await this.runSync(true);
			},
		});

		this.addCommand({
			id: "trakt-clear-auth",
			name: "Trakt: clear authentication",
			callback: async () => {
				await this.clearAuth();
			},
		});

		this.addSettingTab(new TraktSyncSettingTab(this.app, this));

		if (this.settings.autoSyncOnStartup && this.hasAuthToken()) {
			void this.runSync(false);
		}
	}

	onunload(): void {
		// no-op
	}

	async authenticateWithTrakt(): Promise<void> {
		try {
			const deviceCode = await this.traktClient.startDeviceAuthorization();
			const modal = new DeviceCodeModal(this.app, deviceCode.user_code, deviceCode.verification_url);
			modal.open();

			new Notice(`Open ${deviceCode.verification_url} and enter code ${deviceCode.user_code}.`);
			const token = await this.traktClient.pollForDeviceToken(
				deviceCode.device_code,
				deviceCode.interval,
				DEVICE_AUTH_TIMEOUT_SECONDS,
			);

			await this.setAuth(token);
			modal.close();
			new Notice("Trakt authentication succeeded.");
		} catch (error) {
			new Notice(`Trakt authentication failed: ${extractErrorMessage(error)}`);
		}
	}

	async runSync(showNotice: boolean): Promise<void> {
		if (!this.hasAuthToken()) {
			if (showNotice) {
				new Notice("Trakt is not authenticated. Run 'Trakt: authenticate' first.");
			}
			return;
		}

		try {
			const summary = await syncTraktData(this.app, this.settings, this.traktClient);
			this.settings.lastSyncAt = new Date().toISOString();
			await this.saveSettings();

			if (showNotice) {
				new Notice(
					`Trakt sync complete. Daily note: ${summary.dailyNoteUpdated ? "updated" : "skipped"}. Created pages - movies: ${summary.createdMoviePages}, shows: ${summary.createdShowPages}, episodes: ${summary.createdEpisodePages}.`,
				);
			}
		} catch (error) {
			if (showNotice) {
				new Notice(`Trakt sync failed: ${extractErrorMessage(error)}`);
			}
		}
	}

	hasAuthToken(): boolean {
		return Boolean(this.settings.accessToken && this.settings.refreshToken);
	}

	async clearAuth(): Promise<void> {
		this.settings.accessToken = "";
		this.settings.refreshToken = "";
		this.settings.expiresAt = 0;
		this.settings.scope = "";
		this.settings.tokenType = "";
		await this.saveSettings();
		new Notice("Trakt authentication has been cleared.");
	}

	async setAuth(auth: StoredTraktAuth): Promise<void> {
		this.settings.accessToken = auth.accessToken;
		this.settings.refreshToken = auth.refreshToken;
		this.settings.expiresAt = auth.expiresAt;
		this.settings.tokenType = auth.tokenType;
		this.settings.scope = auth.scope;
		await this.saveSettings();
	}

	private createTraktClient(): TraktClient {
		return new TraktClient({
			getClientId: () => this.settings.clientId,
			getClientSecret: () => this.settings.clientSecret,
			getAuth: () => {
				if (!this.hasAuthToken()) {
					return null;
				}
				return {
					accessToken: this.settings.accessToken,
					refreshToken: this.settings.refreshToken,
					expiresAt: this.settings.expiresAt,
					tokenType: this.settings.tokenType,
					scope: this.settings.scope,
				};
			},
			saveAuth: async (auth) => {
				await this.setAuth(auth);
			},
		});
	}

	private initializeBuildEnvDefaults(): void {
		if (!this.settings.clientId && this.buildEnv.clientId) {
			this.settings.clientId = this.buildEnv.clientId;
		}

		if (!this.settings.clientSecret && this.buildEnv.clientSecret) {
			this.settings.clientSecret = this.buildEnv.clientSecret;
		}
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<TraktSyncSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class DeviceCodeModal extends Modal {
	private readonly userCode: string;
	private readonly verificationUrl: string;

	constructor(app: App, userCode: string, verificationUrl: string) {
		super(app);
		this.userCode = userCode;
		this.verificationUrl = verificationUrl;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Authenticate with Trakt" });
		contentEl.createEl("p", { text: `1. Open ${this.verificationUrl}` });
		contentEl.createEl("p", { text: `2. Enter code: ${this.userCode}` });
		contentEl.createEl("p", { text: "3. Keep this modal open until authentication finishes." });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return "Unknown error";
}
