// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
/** Browser speech adapter; injectable so cancellation and queue races are testable. */
export interface SpeechPlaybackState {
	owner: string | null;
	status: "idle" | "loading" | "speaking" | "paused";
	chunk: number;
	total: number;
	error: string | null;
	cached?: boolean;
}
export const IDLE_SPEECH: SpeechPlaybackState = { owner: null, status: "idle", chunk: 0, total: 0, error: null };

export class SpeechPlayback {
	private generation = 0;
	private chunks: string[] = [];
	private index = 0;
	private utterance: SpeechSynthesisUtterance | null = null;
	private voice: SpeechSynthesisVoice | null = null;
	private rate = 1;
	private state: SpeechPlaybackState = IDLE_SPEECH;

	constructor(
		private readonly synth: Pick<SpeechSynthesis, "speak" | "cancel" | "pause" | "resume">,
		private readonly makeUtterance: (text: string) => SpeechSynthesisUtterance,
		private readonly changed: (state: SpeechPlaybackState) => void,
	) {}

	private update(state: SpeechPlaybackState) { this.state = state; this.changed(state); }

	start(owner: string, chunks: string[], voice: SpeechSynthesisVoice, rate: number): void {
		this.stop();
		if (!chunks.length) return;
		if (!voice.localService) { this.fail(owner, "Choose an on-device voice in Speech options."); return; }
		this.chunks = [...chunks];
		this.index = 0;
		this.voice = voice;
		this.rate = rate;
		this.update({ owner, status: "speaking", chunk: 1, total: chunks.length, error: null });
		try { this.synth.resume(); this.speakNext(this.generation); }
		catch { this.fail(owner, "Speech could not start. Try another on-device voice."); }
	}

	private speakNext(generation: number): void {
		if (generation !== this.generation || this.state.status !== "speaking") return;
		const text = this.chunks[this.index];
		if (text === undefined) { this.update(IDLE_SPEECH); return; }
		const utterance = this.makeUtterance(text);
		this.utterance = utterance; // Keep a strong reference for browser speech engines.
		utterance.voice = this.voice;
		utterance.lang = this.voice?.lang ?? "";
		utterance.rate = this.rate;
		utterance.onend = () => {
			if (generation !== this.generation || this.utterance !== utterance) return;
			this.utterance = null;
			this.index++;
			if (this.index === this.chunks.length) { this.update(IDLE_SPEECH); return; }
			this.update({ ...this.state, chunk: this.index + 1 });
			try { this.speakNext(generation); }
			catch { this.fail(this.state.owner, "Speech stopped. Try another on-device voice."); }
		};
		utterance.onerror = () => {
			if (generation === this.generation && this.utterance === utterance) this.fail(this.state.owner, "Speech stopped. Press Read aloud to try again.");
		};
		this.synth.speak(utterance);
	}

	pause(): void {
		if (this.state.status !== "speaking") return;
		this.update({ ...this.state, status: "paused" });
		try { this.synth.pause(); }
		catch { this.fail(this.state.owner, "This voice could not pause. Start reading again."); }
	}

	resume(): void {
		if (this.state.status !== "paused") return;
		this.update({ ...this.state, status: "speaking" });
		try {
			this.synth.resume();
			if (!this.utterance) this.speakNext(this.generation);
		} catch { this.fail(this.state.owner, "This voice could not resume. Start reading again."); }
	}

	stop(): void {
		this.generation++;
		this.utterance = null;
		this.chunks = [];
		this.index = 0;
		this.update(IDLE_SPEECH);
		try { this.synth.cancel(); } catch { /* Some hosts expose an unavailable speech engine. */ }
	}

	private fail(owner: string | null, error: string): void {
		this.stop();
		this.update({ ...IDLE_SPEECH, owner, error });
	}
}
