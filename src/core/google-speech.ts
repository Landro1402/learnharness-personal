// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
/** Shared, non-secret choices for the personal Google read-aloud adapter. */
export const GOOGLE_SPEECH_KEY = "GEMINI_TTS_API_KEY";
export const GOOGLE_SPEECH_MODELS = [
	{ id: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS" },
	{ id: "gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS (preview)" },
	{ id: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash TTS (preview)" },
] as const;
export const GOOGLE_SPEECH_VOICES = [
	{ id: "Sulafat", label: "Sulafat · Warm" },
	{ id: "Achernar", label: "Achernar · Soft" },
	{ id: "Aoede", label: "Aoede · Breezy" },
	{ id: "Kore", label: "Kore · Firm" },
] as const;
export type GoogleSpeechModel = typeof GOOGLE_SPEECH_MODELS[number]["id"];
export type GoogleSpeechVoice = typeof GOOGLE_SPEECH_VOICES[number]["id"];
export interface GoogleSpeechOptions { model: GoogleSpeechModel; voice: GoogleSpeechVoice; language: "en" | "it" }
export const DEFAULT_GOOGLE_SPEECH: GoogleSpeechOptions = { model: "gemini-3.8-flash-tts", voice: "Sulafat", language: "en" };
export const GOOGLE_SPEECH_CHUNK_LENGTH = 1800;
export function googleSpeechOptions(value: unknown): GoogleSpeechOptions {
	const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
	return {
		language: input.language === "it" ? "it" : "en",
		model: GOOGLE_SPEECH_MODELS.some((m) => m.id === input.model) ? input.model as GoogleSpeechModel : DEFAULT_GOOGLE_SPEECH.model,
		voice: GOOGLE_SPEECH_VOICES.some((v) => v.id === input.voice) ? input.voice as GoogleSpeechVoice : DEFAULT_GOOGLE_SPEECH.voice,
	};
}
