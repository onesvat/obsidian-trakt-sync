export type TemplateValues = Record<string, string | number | boolean | null | undefined>;

const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

export function renderTemplate(template: string, values: TemplateValues, now = new Date()): string {
	return template.replace(/{{\s*([a-zA-Z0-9_]+)(?::([^}]+))?\s*}}/g, (_match, key: string, format?: string) => {
		if (key === "date") {
			return formatDate(now, format ?? DEFAULT_DATE_FORMAT);
		}

		const value = values[key];
		if (value === null || value === undefined) {
			return "";
		}

		return String(value);
	});
}

export function formatDate(date: Date, format: string): string {
	const pad = (value: number): string => String(value).padStart(2, "0");

	const replacements: Array<[string, string]> = [
		["YYYY", String(date.getFullYear())],
		["MM", pad(date.getMonth() + 1)],
		["DD", pad(date.getDate())],
		["HH", pad(date.getHours())],
		["mm", pad(date.getMinutes())],
		["ss", pad(date.getSeconds())],
	];

	let output = format;
	for (const [token, value] of replacements) {
		output = output.replace(new RegExp(token, "g"), value);
	}
	return output;
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function sanitizePathSegment(value: string): string {
	return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}
