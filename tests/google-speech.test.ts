// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createGoogleSpeechService, GoogleSpeechError } from "../src/server/google-speech.ts";
import { DEFAULT_GOOGLE_SPEECH } from "../src/core/google-speech.ts";
import { GoogleSpeechPlayback } from "../components/google-speech-playback.ts";
import { IDLE_SPEECH, type SpeechPlaybackState } from "../components/speech-playback.ts";

const dirs: string[] = [];
after(async () => { await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))); });
const pcm = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
const request = { ...DEFAULT_GOOGLE_SPEECH, text: "A clear mental model helps you predict the next step." };
const audioResponse = () => Response.json({ steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/L16;codec=pcm;rate=24000", data: pcm.toString("base64") }] }] });
async function setup(fetcher: typeof fetch = async () => audioResponse()) {
	const dir = await mkdtemp(path.join(os.tmpdir(), "lh-google-speech-")); dirs.push(dir);
	let key: string | undefined = "test-key-never-returned";
	const service = createGoogleSpeechService({ cacheDir: dir, key: () => key, fetcher });
	return { dir, service, setKey: (next: string | undefined) => { key = next; } };
}

describe("Google speech requests and persistent replay", () => {
	it("styles Italian speech separately, preserves the exact transcript and keeps language caches distinct", async () => {
		const styles: string[] = [];
		const test = await setup(async (_url, init) => {
			const body = JSON.parse(String(init?.body));
			assert.equal(body.input[0].content[0].text, "Una spiegazione chiara.");
			styles.push(body.input[0].content[0].annotations[0].style);
			return audioResponse();
		});
		const italian = { ...request, text: "Una spiegazione chiara.", language: "it" };
		assert.equal((await test.service.synthesize(italian)).cached, false);
		assert.equal((await test.service.synthesize(italian)).cached, true);
		assert.equal((await test.service.synthesize({ ...italian, language: "en" })).cached, false);
		assert.match(styles[0]!, /Natural Italian/); assert.doesNotMatch(styles[0]!, /American English/);
		assert.match(styles[1]!, /American English/);
	});
	it("replays English recordings created before the language option without contacting Google", async () => {
		const test = await setup(async () => { throw new Error("Old audio must be reused"); });
		const legacyStyle = "Natural American English, a warm, engaged tutor speaking to one learner. Relaxed conversational pace, gentle emphasis and short pauses between ideas.";
		const options = { model: request.model, voice: request.voice };
		const digest = createHash("sha256").update(JSON.stringify(["google-speech-v1", legacyStyle, options, request.text])).digest("hex");
		await writeFile(path.join(test.dir, `${digest}.wav`), Buffer.from("old saved audio"));
		test.setKey(undefined);
		assert.equal((await test.service.synthesize(request)).cached, true);
	});
	it("sends style separately from the transcript, wraps PCM and reuses disk cache even without a key", async () => {
		let calls = 0;
		const test = await setup(async (url, init) => {
			calls++;
			assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/interactions");
			const body = JSON.parse(String(init?.body));
			assert.equal(body.store, false);
			assert.equal(body.input[0].content[0].text, request.text);
			assert.match(body.input[0].content[0].annotations[0].style, /warm/);
			assert.equal(body.generation_config.speech_config[0].voice, "Sulafat");
			assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-key-never-returned");
			return audioResponse();
		});
		const first = await test.service.synthesize(request);
		assert.equal(first.cached, false);
		assert.equal(first.audio.toString("ascii", 0, 4), "RIFF");
		assert.equal(first.audio.readUInt32LE(24), 24000);
		assert.deepEqual(first.audio.subarray(44), pcm);
		test.setKey(undefined);
		const second = await test.service.synthesize(request);
		assert.equal(second.cached, true); assert.deepEqual(second.audio, first.audio); assert.equal(calls, 1);
		const restarted = createGoogleSpeechService({ cacheDir: test.dir, key: () => undefined, fetcher: async () => { throw new Error("must not call Google"); } });
		assert.equal((await restarted.synthesize(request)).cached, true);
		assert.equal((await readdir(test.dir)).length, 1);
	});
	it("changes cache identity with voice and model, and uses the legacy audio schema for 2.5", async () => {
		let calls = 0;
		const test = await setup(async (url, init) => {
			calls++;
			if (String(url).includes(":generateContent")) {
				const body = JSON.parse(String(init?.body));
				assert.deepEqual(body.generationConfig.responseModalities, ["AUDIO"]);
				assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Sulafat");
				return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcm.toString("base64") } }] } }] });
			}
			return audioResponse();
		});
		await test.service.synthesize(request);
		await test.service.synthesize({ ...request, voice: "Achernar" });
		await test.service.synthesize({ ...request, model: "gemini-2.5-flash-preview-tts" });
		assert.equal(calls, 3);
	});
	it("deduplicates simultaneous requests for the same passage", async () => {
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const test = await setup(async () => { calls++; await gate; return audioResponse(); });
		const first = test.service.synthesize(request);
		const second = test.service.synthesize(request);
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(calls, 1); release();
		assert.deepEqual((await first).audio, (await second).audio);
	});
	it("rejects malformed requests and missing keys without contacting Google", async () => {
		let calls = 0;
		const test = await setup(async () => { calls++; return audioResponse(); });
		for (const bad of [null, {}, { ...request, text: "" }, { ...request, text: "a".repeat(1801) }, { ...request, voice: "unknown" }, { ...request, model: "paid-unlisted-model" }]) {
			await assert.rejects(test.service.synthesize(bad), (e: unknown) => e instanceof GoogleSpeechError && e.status === 400);
		}
		test.setKey(undefined);
		await assert.rejects(test.service.synthesize(request), (e: unknown) => e instanceof GoogleSpeechError && e.status === 503);
		assert.equal(calls, 0);
	});
	it("stops on quota errors without retry, cache entry or leaking provider diagnostics", async () => {
		let calls = 0;
		const test = await setup(async () => { calls++; return Response.json({ error: "test-key-never-returned" }, { status: 429 }); });
		await assert.rejects(test.service.synthesize(request), (e: unknown) => {
			assert.ok(e instanceof GoogleSpeechError); assert.equal(e.status, 429);
			assert.match(e.message, /quota/); assert.doesNotMatch(e.message, /test-key/); return true;
		});
		assert.equal(calls, 1); assert.deepEqual(await readdir(test.dir), []);
	});
	it("does not cache empty or malformed successful responses", async () => {
		const test = await setup(async () => Response.json({ steps: [] }));
		await assert.rejects(test.service.synthesize(request), /no playable audio/);
		assert.deepEqual(await readdir(test.dir), []);
	});
});

function playback(fetcher?: typeof fetch) {
	let state: SpeechPlaybackState = IDLE_SPEECH;
	const audios: HTMLAudioElement[] = [];
	let calls = 0; const revoked: string[] = [];
	const player = new GoogleSpeechPlayback((value) => { state = value; }, () => {
		const audio = { src: "", playbackRate: 1, onended: null, onerror: null, play: async () => {}, pause: () => {}, load: () => {} } as unknown as HTMLAudioElement;
		audios.push(audio); return audio;
	}, async (...args) => { calls++; return fetcher ? fetcher(...args) : new Response(new Uint8Array(pcm), { headers: { "Content-Type": "audio/wav", "X-Speech-Cache": "hit" } }); },
	{ createObjectURL: () => `blob:test-${audios.length}`, revokeObjectURL: (url) => revoked.push(url) });
	return { player, audios, revoked, get state() { return state; }, get calls() { return calls; } };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
function ended(audio: HTMLAudioElement) { audio.onended?.call(audio, new Event("ended")); }

describe("Google audio playback lifecycle", () => {
	it("requests only the current chunk, reuses audio for pause/rate/resume and then advances", async () => {
		const test = playback();
		test.player.start("a", ["First.", "Second."], DEFAULT_GOOGLE_SPEECH, 1);
		assert.equal(test.state.status, "loading"); await settle();
		assert.equal(test.calls, 1); assert.equal(test.state.status, "speaking"); assert.equal(test.state.cached, true);
		test.player.pause(); test.player.setRate(1.5);
		assert.equal(test.audios[0]!.playbackRate, 1.5);
		test.player.resume(); await settle(); assert.equal(test.calls, 1);
		ended(test.audios[0]!); await settle(); assert.equal(test.calls, 2); assert.equal(test.state.chunk, 2);
		ended(test.audios[1]!); assert.deepEqual(test.state, IDLE_SPEECH); assert.equal(test.revoked.length, 2);
	});
	it("can pause while waiting for Google and resume the same recording without another request", async () => {
		let release!: (response: Response) => void;
		const test = playback(() => new Promise((resolve) => { release = resolve; }));
		test.player.start("a", ["First."], DEFAULT_GOOGLE_SPEECH, 1); test.player.pause();
		release(new Response(new Uint8Array(pcm))); await settle();
		assert.equal(test.state.status, "paused"); assert.equal(test.audios.length, 1);
		test.player.resume(); await settle(); assert.equal(test.state.status, "speaking"); assert.equal(test.calls, 1);
		test.player.stop();
	});
	it("ignores late downloads after Stop and aborts obsolete requests", async () => {
		let release!: (response: Response) => void; let signal: AbortSignal | undefined;
		const test = playback((_url, init) => { signal = init?.signal ?? undefined; return new Promise((resolve) => { release = resolve; }); });
		test.player.start("a", ["First.", "Never request."], DEFAULT_GOOGLE_SPEECH, 1);
		test.player.stop(); assert.equal(signal?.aborted, true);
		release(new Response(new Uint8Array(pcm))); await settle();
		assert.equal(test.audios.length, 0); assert.equal(test.calls, 1); assert.deepEqual(test.state, IDLE_SPEECH);
	});
	it("ignores stale ended callbacks after replacing the message", async () => {
		const test = playback(); test.player.start("a", ["Old.", "Never."], DEFAULT_GOOGLE_SPEECH, 1); await settle();
		const stale = test.audios[0]!.onended;
		test.player.start("b", ["New."], DEFAULT_GOOGLE_SPEECH, 1); await settle();
		stale?.call(test.audios[0]!, new Event("ended")); await settle();
		assert.equal(test.calls, 2); assert.equal(test.state.owner, "b"); test.player.stop();
	});
	it("surfaces quota errors without retrying or playing other providers", async () => {
		const test = playback(async () => Response.json({ error: "Quota reached" }, { status: 429 }));
		test.player.start("a", ["First.", "Never."], DEFAULT_GOOGLE_SPEECH, 1); await settle();
		assert.equal(test.calls, 1); assert.equal(test.state.status, "idle"); assert.equal(test.state.error, "Quota reached"); assert.equal(test.audios.length, 0);
	});
});
