// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import type { GoogleSpeechOptions } from "@/src/core";
import { IDLE_SPEECH, type SpeechPlaybackState } from "./speech-playback.ts";

type AudioElement = Pick<HTMLAudioElement, "src" | "play" | "pause" | "load" | "playbackRate" | "onended" | "onerror">;
/** Generate only the current passage; cancel obsolete callbacks and release every object URL. */
export class GoogleSpeechPlayback {
	private generation = 0;
	private request: AbortController | null = null;
	private audio: AudioElement | null = null;
	private url: string | null = null;
	private chunks: string[] = [];
	private index = 0;
	private rate = 1;
	private options: GoogleSpeechOptions | null = null;
	private state: SpeechPlaybackState = IDLE_SPEECH;
	constructor(
		private readonly changed: (state: SpeechPlaybackState) => void,
		private readonly makeAudio: () => AudioElement = () => new Audio(),
		private readonly fetcher: typeof fetch = (...args) => fetch(...args),
		private readonly urls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
	) {}
	private update(state: SpeechPlaybackState) { this.state = state; this.changed(state); }
	start(owner: string, chunks: string[], options: GoogleSpeechOptions, rate: number) {
		this.stop();
		if (!chunks.length) return;
		this.chunks = [...chunks]; this.options = options; this.rate = rate; this.index = 0;
		this.update({ owner, status: "loading", chunk: 1, total: chunks.length, error: null });
		void this.next(this.generation);
	}
	private clearAudio() {
		if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio.src = ""; this.audio.load(); this.audio = null; }
		if (this.url) { this.urls.revokeObjectURL(this.url); this.url = null; }
	}
	private async next(generation: number) {
		if (generation !== this.generation) return;
		const text = this.chunks[this.index];
		if (text === undefined) { this.stop(); return; }
		const abort = new AbortController(); this.request = abort;
		try {
			const response = await this.fetcher("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...this.options, text }), signal: abort.signal });
			if (generation !== this.generation) return;
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(typeof body.error === "string" ? body.error : "Google speech could not start.");
			}
			const blob = await response.blob();
			if (generation !== this.generation) return;
			this.request = null;
			this.clearAudio();
			this.url = this.urls.createObjectURL(blob);
			const audio = this.makeAudio(); this.audio = audio;
			audio.src = this.url; audio.playbackRate = this.rate;
			audio.onended = () => {
				if (generation !== this.generation || this.audio !== audio) return;
				this.clearAudio(); this.index++;
				if (this.index === this.chunks.length) { this.stop(); return; }
				this.update({ ...this.state, chunk: this.index + 1, cached: undefined });
				if (this.state.status !== "paused") { this.update({ ...this.state, status: "loading" }); void this.next(generation); }
			};
			audio.onerror = () => { if (generation === this.generation) this.fail("This browser could not play the audio. Press Read aloud to retry the saved recording."); };
			this.update({ ...this.state, cached: response.headers.get("X-Speech-Cache") === "hit" });
			if (this.state.status !== "paused") await this.play(audio, generation);
		} catch (error) {
			if (generation === this.generation) this.fail(error instanceof Error ? error.message : "Google speech could not start.");
		}
	}
	private async play(audio: AudioElement, generation: number) {
		try {
			await audio.play();
			if (generation !== this.generation || this.audio !== audio) { audio.pause(); return; }
			if (this.state.status === "paused") { audio.pause(); return; }
			this.update({ ...this.state, status: "speaking" });
		} catch {
			if (generation === this.generation) this.fail("Audio playback was blocked. Press Read aloud again to play the saved recording.");
		}
	}
	pause() {
		if (!["loading", "speaking"].includes(this.state.status)) return;
		this.update({ ...this.state, status: "paused" }); this.audio?.pause();
	}
	resume() {
		if (this.state.status !== "paused") return;
		this.update({ ...this.state, status: "loading" });
		if (this.audio) void this.play(this.audio, this.generation);
		else if (!this.request) void this.next(this.generation);
	}
	setRate(rate: number) { this.rate = rate; if (this.audio) this.audio.playbackRate = rate; }
	stop() {
		this.generation++; this.request?.abort(); this.request = null;
		this.clearAudio(); this.chunks = []; this.index = 0; this.update(IDLE_SPEECH);
	}
	private fail(error: string) { const owner = this.state.owner; this.stop(); this.update({ ...IDLE_SPEECH, owner, error }); }
}
