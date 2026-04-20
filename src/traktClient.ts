import { requestUrl } from "obsidian";

const TRAKT_API_BASE = "https://api.trakt.tv";
const TRAKT_API_VERSION = "2";
const EXPIRY_BUFFER_SECONDS = 60;

interface TraktRequestOptions {
	method?: "GET" | "POST";
	path: string;
	body?: Record<string, unknown>;
	requireAuth?: boolean;
	retryAfterRefresh?: boolean;
}

export interface TraktTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
	created_at: number;
}

export interface TraktDeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_url: string;
	expires_in: number;
	interval: number;
}

export interface TraktLastActivities {
	all?: string;
	movies?: {
		watched_at?: string;
	};
	episodes?: {
		watched_at?: string;
	};
	shows?: {
		hidden_at?: string;
	};
}

interface TraktIds {
	trakt?: number;
	imdb?: string;
	tmdb?: number;
	tvdb?: number;
	slug?: string;
}

interface TraktMovie {
	title: string;
	year?: number;
	ids?: TraktIds;
}

interface TraktShow {
	title: string;
	year?: number;
	ids?: TraktIds;
}

interface TraktEpisode {
	season: number;
	number: number;
	title?: string;
	ids?: TraktIds;
}

export interface TraktHistoryItem {
	id: number;
	type: "movie" | "show" | "episode";
	watched_at: string;
	action?: string;
	movie?: TraktMovie;
	show?: TraktShow;
	episode?: TraktEpisode;
}

export interface StoredTraktAuth {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	tokenType: string;
	scope: string;
}

export class TraktApiError extends Error {
	status: number;
	apiMessage: string;

	constructor(status: number, apiMessage: string) {
		super(`Trakt API error (${status}): ${apiMessage}`);
		this.status = status;
		this.apiMessage = apiMessage;
	}
}

export class TraktClient {
	private readonly getClientId: () => string;
	private readonly getClientSecret: () => string;
	private readonly getAuth: () => StoredTraktAuth | null;
	private readonly saveAuth: (auth: StoredTraktAuth) => Promise<void>;

	constructor(options: {
		getClientId: () => string;
		getClientSecret: () => string;
		getAuth: () => StoredTraktAuth | null;
		saveAuth: (auth: StoredTraktAuth) => Promise<void>;
	}) {
		this.getClientId = options.getClientId;
		this.getClientSecret = options.getClientSecret;
		this.getAuth = options.getAuth;
		this.saveAuth = options.saveAuth;
	}

	async startDeviceAuthorization(): Promise<TraktDeviceCodeResponse> {
		this.assertClientCredentials();
		return this.request<TraktDeviceCodeResponse>({
			method: "POST",
			path: "/oauth/device/code",
			body: {
				client_id: this.getClientId(),
			},
		});
	}

	async pollForDeviceToken(deviceCode: string, intervalSeconds: number, timeoutSeconds: number): Promise<StoredTraktAuth> {
		const timeoutMs = timeoutSeconds * 1000;
		const startedAt = Date.now();
		const intervalMs = Math.max(intervalSeconds, 1) * 1000;

		while (Date.now() - startedAt < timeoutMs) {
			try {
				const token = await this.request<TraktTokenResponse>({
					method: "POST",
					path: "/oauth/device/token",
					body: {
						code: deviceCode,
						client_id: this.getClientId(),
						client_secret: this.getClientSecret(),
					},
				});

				return this.toStoredAuth(token);
			} catch (error) {
				const traktError = this.asTraktApiError(error);
				if (traktError.status === 400 || traktError.status === 404 || traktError.status === 409 || traktError.status === 429) {
					await delay(intervalMs);
					continue;
				}
				throw traktError;
			}
		}

		throw new Error("Device authorization timed out.");
	}

	async getLastActivities(): Promise<TraktLastActivities> {
		return this.request<TraktLastActivities>({
			path: "/sync/last_activities",
			requireAuth: true,
		});
	}

	async getRecentHistory(limit: number): Promise<TraktHistoryItem[]> {
		return this.request<TraktHistoryItem[]>({
			path: `/sync/history?limit=${encodeURIComponent(String(limit))}`,
			requireAuth: true,
		});
	}

	private async request<T>(options: TraktRequestOptions): Promise<T> {
		const method = options.method ?? "GET";
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"trakt-api-version": TRAKT_API_VERSION,
			"trakt-api-key": this.getClientId(),
		};

		if (options.requireAuth) {
			const auth = await this.ensureValidAuth();
			headers.Authorization = `Bearer ${auth.accessToken}`;
		}

		try {
			const response = await requestUrl({
				url: `${TRAKT_API_BASE}${options.path}`,
				method,
				headers,
				body: options.body ? JSON.stringify(options.body) : undefined,
			});

			return response.json as T;
		} catch (error) {
			const traktError = this.asTraktApiError(error);
			if (options.requireAuth && options.retryAfterRefresh !== false && traktError.status === 401) {
				await this.refreshAccessToken();
				return this.request<T>({ ...options, retryAfterRefresh: false });
			}
			throw traktError;
		}
	}

	private async ensureValidAuth(): Promise<StoredTraktAuth> {
		const auth = this.getAuth();
		if (!auth) {
			throw new Error("Trakt is not authenticated.");
		}

		const expiresSoon = Date.now() >= auth.expiresAt - EXPIRY_BUFFER_SECONDS * 1000;
		if (!expiresSoon) {
			return auth;
		}

		return this.refreshAccessToken();
	}

	private async refreshAccessToken(): Promise<StoredTraktAuth> {
		this.assertClientCredentials();
		const currentAuth = this.getAuth();
		if (!currentAuth) {
			throw new Error("Trakt is not authenticated.");
		}

		const refreshed = await this.request<TraktTokenResponse>({
			method: "POST",
			path: "/oauth/token",
			body: {
				grant_type: "refresh_token",
				refresh_token: currentAuth.refreshToken,
				client_id: this.getClientId(),
				client_secret: this.getClientSecret(),
				redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
			},
		});

		const stored = this.toStoredAuth(refreshed);
		await this.saveAuth(stored);
		return stored;
	}

	private assertClientCredentials(): void {
		if (!this.getClientId() || !this.getClientSecret()) {
			throw new Error("Trakt client ID and client secret are required. Add them in plugin settings or .env.");
		}
	}

	private toStoredAuth(token: TraktTokenResponse): StoredTraktAuth {
		return {
			accessToken: token.access_token,
			refreshToken: token.refresh_token,
			expiresAt: (token.created_at + token.expires_in) * 1000,
			tokenType: token.token_type,
			scope: token.scope,
		};
	}

	private asTraktApiError(error: unknown): TraktApiError {
		const fallback = new TraktApiError(0, "Unknown error");
		if (error instanceof TraktApiError) {
			return error;
		}

		const maybeError = error as {
			status?: number;
			message?: string;
			response?: {
				status?: number;
				json?: {
					error?: string;
					error_description?: string;
				};
				text?: string;
			};
		};

		const status = maybeError.status ?? maybeError.response?.status ?? 0;
		const messageFromJson = maybeError.response?.json?.error_description ?? maybeError.response?.json?.error;
		const apiMessage = messageFromJson ?? maybeError.response?.text ?? maybeError.message ?? fallback.apiMessage;
		return new TraktApiError(status, apiMessage);
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}
