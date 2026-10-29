// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
/** Plain text for speech. Only pass learner-visible content, never tool inputs. */
import { fromMarkdown } from "mdast-util-from-markdown";
import { mathFromMarkdown } from "mdast-util-math";
import { math } from "micromark-extension-math";
import { transformMathDelimiters } from "./math-delims.ts";
import type { QuestionData } from "./question-core.ts";

interface SpeechNode {
	type: string;
	value?: string;
	alt?: string | null;
	children?: SpeechNode[];
}

export function textForSpeech(input: unknown): string {
	const markdown = typeof input === "string" ? input
		: typeof input === "number" && Number.isFinite(input) ? String(input) : "";
	const tree = fromMarkdown(transformMathDelimiters(markdown), {
		extensions: [math({ singleDollarTextMath: true })],
		mdastExtensions: [mathFromMarkdown()],
	});
	function read(node: SpeechNode): string {
		if (node.type === "code" || node.type === "html" || node.type === "definition") return "";
		if (node.type === "image" || node.type === "imageReference") return node.alt ?? "";
		if (node.type === "break" || node.type === "thematicBreak") return "\n";
		if (node.value !== undefined) return node.value;
		const separator = ["root", "list", "listItem", "blockquote"].includes(node.type) ? "\n" : "";
		return (node.children ?? []).map(read).join(separator);
	}
	return read(tree)
		.split("\n")
		.filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line))
		.map((line) => line.replace(/\s*\|\s*/g, ", ").replace(/^,\s*|,\s*$/g, ""))
		.join("\n")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Enumerate the displayed choices, never the answer key or committed solution. */
export function questionTextForSpeech(question: Pick<QuestionData, "question" | "context" | "options">): string {
	return [question.question, question.context,
		...question.options.map((option, index) => `${index + 1}. ${option.label}${option.description ? `. ${option.description}` : ""}`),
	].filter(Boolean).join("\n\n");
}

/** Short utterances avoid platform limits on long speech requests. */
export function splitSpeechText(text: string, maxLength = 220): string[] {
	if (!Number.isInteger(maxLength) || maxLength < 2) throw new RangeError("Invalid speech chunk length");
	const chunks: string[] = [];
	let rest = text.trim();
	while (rest) {
		const chars = Array.from(rest);
		if (chars.length <= maxLength) { chunks.push(rest); break; }
		const window = chars.slice(0, maxLength).join("");
		const boundaries = [...window.matchAll(/[.!?;:\n](?=\s)|\s/g)];
		const boundary = boundaries.at(-1);
		const end = boundary && boundary.index > window.length / 3
			? boundary.index + boundary[0].length : window.length;
		chunks.push(rest.slice(0, end).trim());
		rest = rest.slice(end).trimStart();
	}
	return chunks;
}

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export interface SpeechPreferences { voiceURI: string; rate: number }
export function speechPreferences(value: unknown): SpeechPreferences {
	const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
	return {
		voiceURI: typeof input.voiceURI === "string" && input.voiceURI.length <= 512 ? input.voiceURI : "",
		rate: SPEECH_RATES.includes(input.rate as typeof SPEECH_RATES[number]) ? input.rate as number : 1,
	};
}

type Voice = Pick<SpeechSynthesisVoice, "voiceURI" | "lang" | "localService" | "default">;
/** Never silently select a remote voice: this feature uses on-device synthesis. */
export function chooseLocalVoice<T extends Voice>(voices: readonly T[], requested: string, locale: string): T | undefined {
	const local = voices.filter((voice) => voice.localService);
	const lang = locale.toLowerCase().replaceAll("_", "-");
	return local.find((voice) => voice.voiceURI === requested)
		?? local.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-") === lang)
		?? local.find((voice) => voice.lang.split(/[-_]/)[0]?.toLowerCase() === lang.split("-")[0])
		?? local.find((voice) => voice.default)
		?? local[0];
}
