export function insertEntryUnderHeading(content: string, heading: string, entry: string): string {
	const safeEntry = entry.trim();
	if (!safeEntry) {
		return content;
	}

	if (!heading.trim()) {
		return appendBlock(content, safeEntry);
	}

	const lines = content.length > 0 ? content.split("\n") : [];
	const headingLine = `## ${heading}`;
	const index = lines.findIndex((line) => line.trim() === headingLine);

	if (index === -1) {
		const headingBlock = `${headingLine}\n${safeEntry}`;
		return appendBlock(content, headingBlock);
	}

	const output = [...lines];
	output.splice(index + 1, 0, safeEntry);
	return output.join("\n");
}

function appendBlock(content: string, block: string): string {
	const trimmed = content.trimEnd();
	if (!trimmed) {
		return `${block}\n`;
	}
	return `${trimmed}\n\n${block}\n`;
}
