declare const __TRAKT_CLIENT_ID__: string;
declare const __TRAKT_CLIENT_SECRET__: string;

export interface BuildEnvConfig {
	clientId: string;
	clientSecret: string;
}

export function getBuildEnvConfig(): BuildEnvConfig {
	return {
		clientId: __TRAKT_CLIENT_ID__.trim(),
		clientSecret: __TRAKT_CLIENT_SECRET__.trim(),
	};
}
