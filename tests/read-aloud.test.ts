// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseLocalVoice, questionTextForSpeech, speechPreferences, splitSpeechText, textForSpeech } from "../src/core/read-aloud.ts";
import { IDLE_SPEECH, SpeechPlayback, type SpeechPlaybackState } from "../components/speech-playback.ts";

const voice = { voiceURI: "italian-local", name: "Italian", lang: "it-IT", localService: true, default: false } as SpeechSynthesisVoice;

describe("speech content and on-device preferences", () => {
	it("reads prose and identifiers without markup, link destinations or executable blocks", () => {
		const text = textForSpeech('# Title\n\nUse **labels** and `kubectl`. See [the guide](https://example.com/private).\n\n```mermaid\nsecret diagram source\n```\n\n<script>private script</script>\n\nFinal step.');
		assert.match(text, /Title/);
		assert.match(text, /Use labels and kubectl/);
		assert.match(text, /the guide/);
		assert.match(text, /Final step/);
		assert.doesNotMatch(text, /https:|secret diagram|private script|\*\*|```/);
	});
	it("keeps the displayed choice order and excludes the private answer and explanation", () => {
		const question = { question: "Which one?", context: "Compare these.", options: [{ label: "Second", value: "second" }, { label: "First", value: "first" }], committedAnswer: "PRIVATE SOLUTION", explanation: "PRIVATE EXPLANATION", correctIndices: [2] };
		assert.equal(questionTextForSpeech(question), "Which one?\n\nCompare these.\n\n1. Second\n\n2. First");
	});
	it("handles empty content and preserves long multilingual prose across bounded chunks", () => {
		assert.equal(textForSpeech(42), "42");
		assert.equal(textForSpeech(null), "");
		assert.equal(textForSpeech({ hidden: "private" }), "");
		assert.deepEqual(splitSpeechText("  "), []);
		const text = "Un'ipotesi: perché funziona? 🧠 Questa è una spiegazione. ".repeat(60).trim();
		const chunks = splitSpeechText(text);
		assert.ok(chunks.length > 1);
		assert.ok(chunks.every((chunk) => chunk && Array.from(chunk).length <= 220));
		assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
		assert.deepEqual(splitSpeechText("🧠".repeat(300)), ["🧠".repeat(220), "🧠".repeat(80)]);
	});
	it("selects the saved or matching local voice, never a remote voice", () => {
		const remote = { ...voice, voiceURI: "remote", localService: false, default: true };
		const english = { ...voice, voiceURI: "english", lang: "en-US" };
		assert.equal(chooseLocalVoice([remote, english, voice], "remote", "it-CH"), voice);
		assert.equal(chooseLocalVoice([english, voice], "english", "it-IT"), english);
		assert.equal(chooseLocalVoice([remote], "remote", "it-IT"), undefined);
	});
	it("recovers from malformed or unsupported preferences", () => {
		assert.deepEqual(speechPreferences(null), { voiceURI: "", rate: 1 });
		assert.deepEqual(speechPreferences({ voiceURI: {}, rate: 100 }), { voiceURI: "", rate: 1 });
		assert.deepEqual(speechPreferences({ voiceURI: voice.voiceURI, rate: 1.5 }), { voiceURI: voice.voiceURI, rate: 1.5 });
	});
});

function setup() {
	const spoken: SpeechSynthesisUtterance[] = [];
	let state = IDLE_SPEECH;
	let canceled = 0;
	let paused = 0;
	let resumed = 0;
	let cancelEvent: (() => void) | undefined;
	const player = new SpeechPlayback({
		speak: (utterance) => { spoken.push(utterance); },
		cancel: () => { canceled++; cancelEvent?.(); },
		pause: () => { paused++; },
		resume: () => { resumed++; },
	}, (text) => ({ text, onend: null, onerror: null, voice: null, lang: "", rate: 1 } as unknown as SpeechSynthesisUtterance),
		(next: SpeechPlaybackState) => { state = next; });
	return {
		player, spoken, get state() { return state; }, get canceled() { return canceled; },
		get paused() { return paused; }, get resumed() { return resumed; },
		onCancel: (event: () => void) => { cancelEvent = event; },
	};
}
function end(utterance: SpeechSynthesisUtterance) { utterance.onend?.({} as SpeechSynthesisEvent); }
function error(utterance: SpeechSynthesisUtterance) { utterance.onerror?.({ error: "interrupted" } as SpeechSynthesisErrorEvent); }

describe("speech queue lifecycle", () => {
	it("plays every chunk in order with the selected voice and speed", () => {
		const test = setup();
		test.player.start("a", ["First", "Second"], voice, 1.25);
		assert.equal(test.spoken[0]?.voice, voice);
		assert.equal(test.spoken[0]?.lang, "it-IT");
		assert.equal(test.spoken[0]?.rate, 1.25);
		end(test.spoken[0]!);
		assert.equal(test.state.chunk, 2);
		assert.deepEqual(test.spoken.map((utterance) => utterance.text), ["First", "Second"]);
		end(test.spoken[1]!);
		assert.deepEqual(test.state, IDLE_SPEECH);
	});
	it("pauses across an end event and resumes the remaining chunk", () => {
		const test = setup();
		test.player.start("a", ["First", "Second"], voice, 1);
		test.player.pause();
		end(test.spoken[0]!);
		assert.equal(test.state.status, "paused");
		assert.equal(test.spoken.length, 1);
		test.player.resume();
		assert.equal(test.spoken.length, 2);
		assert.equal(test.state.status, "speaking");
	});
	it("resumes an existing utterance without queuing a duplicate", () => {
		const test = setup();
		test.player.start("a", ["First"], voice, 1);
		test.player.pause(); test.player.resume();
		assert.equal(test.spoken.length, 1);
		assert.equal(test.paused, 1);
		assert.equal(test.resumed, 2);
	});
	it("ignores stale callbacks after Stop or replacing the message", () => {
		const test = setup();
		test.player.start("a", ["Old", "Must not play"], voice, 1);
		const old = test.spoken[0]!;
		test.onCancel(() => { end(old); error(old); });
		test.player.start("b", ["New"], voice, 1);
		end(old); error(old);
		assert.equal(test.state.owner, "b");
		assert.equal(test.state.error, null);
		assert.deepEqual(test.spoken.map((utterance) => utterance.text), ["Old", "New"]);
		test.player.stop();
		end(test.spoken[1]!);
		assert.deepEqual(test.state, IDLE_SPEECH);
	});
	it("ignores duplicate end events from an earlier chunk", () => {
		const test = setup();
		test.player.start("a", ["First", "Second", "Third"], voice, 1);
		end(test.spoken[0]!); end(test.spoken[0]!);
		assert.equal(test.spoken.length, 2);
		assert.equal(test.state.chunk, 2);
	});
	it("reports failures and allows a new attempt", () => {
		const test = setup();
		test.player.start("a", ["First", "Second"], voice, 1);
		error(test.spoken[0]!);
		assert.equal(test.state.status, "idle");
		assert.equal(test.state.owner, "a");
		assert.ok(test.state.error);
		test.player.start("a", ["Retry"], voice, 1);
		assert.equal(test.state.error, null);
		assert.equal(test.state.status, "speaking");
	});
	it("refuses remote voices instead of falling back to an external service", () => {
		const test = setup();
		test.player.start("a", ["Private lesson"], { ...voice, localService: false }, 1);
		assert.equal(test.spoken.length, 0);
		assert.ok(test.state.error);
	});
});
