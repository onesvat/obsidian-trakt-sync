import { normalizePath } from "obsidian";
import type { TraktSyncSettings } from "./settings";
import { renderTemplate, sanitizePathSegment } from "./template";
import type { TraktHistoryItem } from "./traktClient";
import { buildHistoryTemplateValues, getTemplateConfig } from "./syncPure";

export interface ResolvedNoteTarget {
	fileName: string;
	noteName: string;
	noteLink: string;
	notePath: string;
	values: Record<string, string>;
}

export function resolveNoteTarget(
	settings: Pick<
		TraktSyncSettings,
		| "notesFolder"
		| "movieFileNameTemplate"
		| "movieContentTemplate"
		| "showFileNameTemplate"
		| "showContentTemplate"
		| "episodeFileNameTemplate"
		| "episodeContentTemplate"
	>,
	item: TraktHistoryItem,
	now: Date,
): ResolvedNoteTarget | null {
	const values = buildHistoryTemplateValues(item, now);
	if (!values) {
		return null;
	}

	const config = getTemplateConfig(settings, item.type);
	const fileName = sanitizePathSegment(renderTemplate(config.fileNameTemplate, values, now).trim());
	if (!fileName) {
		return null;
	}

	const notePath = normalizePath(`${settings.notesFolder}/${fileName}.md`);
	const noteLink = notePath.replace(/\.md$/i, "");
	return {
		fileName,
		noteName: fileName,
		noteLink,
		notePath,
		values: {
			...values,
			note_link: noteLink,
			note_name: fileName,
			note_path: notePath,
		},
	};
}
