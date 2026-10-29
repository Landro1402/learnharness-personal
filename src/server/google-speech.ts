// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GOOGLE_SPEECH_CHUNK_LENGTH, googleSpeechOptions, type GoogleSpeechOptions } from "../core/google-speech.ts";

// Kept outside the transcript for 3.8; earlier models receive explicit recitation instructions.
const STYLE = "Natural American English, a warm, engaged tutor speaking to one learner. Relaxed conversational pace, gentle emphasis and short pauses between ideas.";
const ITALIAN_STYLE = "Natural Italian with standard Italian pronunciation, a warm, engaged tutor speaking to one learner. Relaxed conversational pace, gentle emphasis and short pauses between ideas.";
const VERSION = "google-speech-v1";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
export class GoogleSpeechError extends Error {
	constructor(public readonly status: number, message: string) { super(message); }
}
function wav(pcm: Buffer, rate: number): Buffer {
	if (!pcm.length || pcm.length % 2 || !Number.isInteger(rate) || rate < 8000 || rate > 96000) throw new GoogleSpeechError(502, "Google returned unsupported audio.");
	const header = Buffer.alloc(44);
	header.write("RIFF"); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
	header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
	header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
	header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36);
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, pcm]);
}
type AudioPart = { data?: unknown; mimeType?: unknown; mime_type?: unknown };
function decodeAudio(part: AudioPart | undefined): Buffer {
	if (typeof part?.data !== "string" || !part.data || part.data.length > MAX_AUDIO_BYTES * 1.4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(part.data)) {
		throw new GoogleSpeechError(502, "Google returned no playable audio. Try a shorter passage.");
	}
	const bytes = Buffer.from(part.data, "base64");
	if (bytes.length > MAX_AUDIO_BYTES) throw new GoogleSpeechError(502, "Google returned too much audio.");
	if (bytes.length > 44 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") return bytes;
	const mime = String(part.mimeType ?? part.mime_type ?? "");
	if (/^audio\/(L16|pcm)(;|$)/i.test(mime)) return wav(bytes, Number(/rate=(\d+)/i.exec(mime)?.[1] ?? 24000));
	throw new GoogleSpeechError(502, "Google returned an unsupported audio format.");
}

/** No SDK, retries, model fallbacks or background prefetch. One miss = one Google request. */
export function createGoogleSpeechService({ cacheDir, key, fetcher = fetch }: {
	cacheDir: string; key: () => string | undefined; fetcher?: typeof fetch;
}) {
	const inFlight = new Map<string, Promise<Buffer>>();
	return {
		async synthesize(input: unknown): Promise<{ audio: Buffer; cached: boolean }> {
			if (!input || typeof input !== "object" || Array.isArray(input)) throw new GoogleSpeechError(400, "Expected a speech request.");
			const body = input as Record<string, unknown>;
			const options = googleSpeechOptions(body);
			if (body.language !== undefined && body.language !== options.language) throw new GoogleSpeechError(400, "Choose English tutor or Italian tutor.");
			if (body.model !== options.model || body.voice !== options.voice) throw new GoogleSpeechError(400, "Choose a supported Google model and voice.");
			if (typeof body.text !== "string" || !body.text.trim() || Array.from(body.text).length > GOOGLE_SPEECH_CHUNK_LENGTH) throw new GoogleSpeechError(400, "Speech passage is empty or too long.");
			const text = body.text.trim();
			const style = options.language === "it" ? ITALIAN_STYLE : STYLE;
			// Preserve the original English cache identity, including recordings made before language selection existed.
			const cacheOptions = options.language === "en" ? { model: options.model, voice: options.voice } : options;
			const digest = createHash("sha256").update(JSON.stringify([VERSION, style, cacheOptions, text])).digest("hex");
			const file = path.join(cacheDir, `${digest}.wav`);
			try { return { audio: await readFile(file), cached: true }; }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new GoogleSpeechError(500, "Could not read the saved audio."); }
			const existing = inFlight.get(digest);
			if (existing) return { audio: await existing, cached: true };
			const apiKey = key();
			if (!apiKey) throw new GoogleSpeechError(503, "Add your Google speech key in Settings → Providers → Read aloud.");
			if (inFlight.size) throw new GoogleSpeechError(429, "Another passage is being generated. Wait a moment, then press Read aloud.");
			const pending = (async () => {
				const audio = await generate(text, options, apiKey, fetcher);
				await mkdir(cacheDir, { recursive: true, mode: 0o700 });
				const temp = `${file}.${randomUUID()}.tmp`;
				try { await writeFile(temp, audio, { mode: 0o600 }); await rename(temp, file); }
				finally { await rm(temp, { force: true }); }
				return audio;
			})();
			inFlight.set(digest, pending);
			try { return { audio: await pending, cached: false }; }
			finally { inFlight.delete(digest); }
		},
	};
}

async function generate(text: string, options: GoogleSpeechOptions, apiKey: string, fetcher: typeof fetch): Promise<Buffer> {
	const style = options.language === "it" ? ITALIAN_STYLE : STYLE;
	const modern = options.model === "gemini-3.8-flash-tts";
	const url = modern ? "https://generativelanguage.googleapis.com/v1beta/interactions"
		: `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`;
	const body = modern ? {
		model: options.model, store: false,
		input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
		response_format: { type: "audio" }, generation_config: { speech_config: [{ voice: options.voice }] },
	} : {
		contents: [{ role: "user", parts: [{ text: `Read the following transcript verbatim. ${style}\nDo not add introductions, explanations or translations.\n\nTranscript:\n${text}` }] }],
		generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: options.voice } } } },
	};
	let response: Response;
	try {
		response = await fetcher(url, { method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000), cache: "no-store" });
	} catch { throw new GoogleSpeechError(502, "Google speech did not respond. Press Read aloud to try again."); }
	if (!response.ok) {
		// Provider bodies can echo request text/credentials; never expose them or log them.
		if (response.status === 429) throw new GoogleSpeechError(429, "Google speech quota reached. Check your free limits in AI Studio, wait, then try again. Saved audio can still be replayed.");
		if ([400, 401, 403].includes(response.status)) throw new GoogleSpeechError(403, "Google rejected the speech request. Check the API key, project access and selected TTS model in AI Studio.");
		if (response.status === 404) throw new GoogleSpeechError(502, "This TTS model is unavailable for your project. Choose another model in Speech options.");
		throw new GoogleSpeechError(502, "Google speech is temporarily unavailable. Try again later.");
	}
	try {
		const result = await response.json();
		if (modern) {
			const parts = result.steps?.filter((step: { type?: string }) => step.type === "model_output").flatMap((step: { content?: unknown[] }) => step.content ?? []) ?? [];
			return decodeAudio(parts.filter((part: { type?: string }) => part.type === "audio").at(-1));
		}
		const parts = result.candidates?.[0]?.content?.parts ?? [];
		return decodeAudio(parts.find((part: { inlineData?: AudioPart }) => part.inlineData?.data)?.inlineData);
	} catch (error) {
		if (error instanceof GoogleSpeechError) throw error;
		throw new GoogleSpeechError(502, "Google returned an unreadable speech response.");
	}
}
