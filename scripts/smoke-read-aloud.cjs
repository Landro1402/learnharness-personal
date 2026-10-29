// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
/** UI smoke with a synthetic speech engine; never calls a model or paid TTS API. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const root = path.resolve(__dirname, "..");
const base = process.env.LH_SMOKE_URL || "http://127.0.0.1:3100";
const executablePath = process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const prefix = `chat_voice_smoke_${Date.now()}`;
const dataDir = path.join(root, "data", "chats");
const fixturePaths = [];
const timestamp = Date.now();
function fixture(id, kind, content) {
	const file = path.join(dataDir, `${id}.json`);
	fs.mkdirSync(dataDir, { recursive: true });
	fs.writeFileSync(file, JSON.stringify({
		id, title: `Speech smoke ${kind}`, kind, version: 1,
		createdAt: new Date(timestamp).toISOString(), updatedAt: new Date(timestamp).toISOString(),
		messages: [
			{ id: `user_${id}`, role: "user", content: "Prova della lettura vocale.", timestamp },
			{ id: `assistant_${id}`, role: "assistant", content, api: "openai-responses", provider: "openai", model: "speech-smoke",
				stopReason: "stop", timestamp: timestamp + 1,
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			},
			...(kind === "practice" ? [{ id: `result_${id}`, role: "toolResult", toolCallId: "voice_problem", toolName: "problem",
				content: [{ type: "text", text: "Problem posed — the turn ends here; the learner's thinking traces and answer commits arrive as labeled messages." }],
				details: null, isError: false, timestamp: timestamp + 2,
			}] : []),
		],
	}));
	fixturePaths.push(file);
}

(async () => {
	let browser;
	let page;
	const googleRequests = [];
	try {
		fixture(prefix, "teach", [
			{ type: "thinking", thinking: "PRIVATE_REASONING_NOT_FOR_SPEECH" },
			{ type: "text", text: "## La lettura vocale\n\n" + "Questa spiegazione descrive un processo e le sue relazioni. ".repeat(12) },
			{ type: "toolCall", id: "voice_probe", name: "probe", arguments: {
				question: "Quale opzione vuoi ascoltare?", options: [{ label: "Prima opzione" }, { label: "Seconda opzione" }],
				correctAnswer: "Prima opzione", explanation: "PRIVATE_EXPLANATION_NOT_FOR_SPEECH",
			} },
		]);
		fixture(`${prefix}_practice`, "practice", [{ type: "toolCall", id: "voice_problem", name: "problem", arguments: {
			statement: "Ricostruisci il processo con le informazioni disponibili.", mode: "recall", modelSolution: "PRIVATE_SOLUTION_NOT_FOR_SPEECH",
		} }]);
		browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-first-run", "--no-default-browser-check"] });
		page = await browser.newPage();
		page.setDefaultTimeout(30000);
		await page.setViewport({ width: 1100, height: 900 });
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.evaluateOnNewDocument(() => {
			if (!localStorage.getItem("lh:read-aloud:v1")) localStorage.setItem("lh:read-aloud:v1", JSON.stringify({ provider: "device", voiceURI: "", rate: 1 }));
			const events = new EventTarget();
			const local = { voiceURI: "local-it", name: "Italian test voice", lang: "it-IT", localService: true, default: false };
			const remote = { ...local, voiceURI: "remote-it", localService: false, default: true };
			window.__speech = { utterances: [], canceled: 0, paused: 0, resumed: 0, ready: false, local, remote };
			Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
				getVoices: () => window.__speech.ready ? [remote, local] : [],
				speak: (utterance) => window.__speech.utterances.push(utterance),
				cancel: () => { window.__speech.canceled++; },
				pause: () => { window.__speech.paused++; },
				resume: () => { window.__speech.resumed++; },
				addEventListener: events.addEventListener.bind(events),
				removeEventListener: events.removeEventListener.bind(events),
			} });
			window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
			window.__loadVoices = () => { window.__speech.ready = true; events.dispatchEvent(new Event("voiceschanged")); };
		});
		const go = async (id) => {
			await page.goto(`${base}/chat/${id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
			await page.waitForSelector('[data-testid="read-aloud"] button:not([disabled])');
			await page.evaluate(() => window.__loadVoices());
			await page.waitForFunction(() => document.querySelector('select[aria-label="Reading voice"]')?.options.length === 1);
		};
		await go(prefix);
		assert.equal(await page.$eval('select[aria-label="Reading voice"]', (select) => select.options[0].value), "local-it");
		await page.locator('[data-testid="read-aloud"] summary').click();
		await page.select('select[aria-label="Reading speed"]', "1.25");
		await page.locator('[data-testid="read-aloud"] button').click();
		await page.waitForFunction(() => window.__speech.utterances.length === 1);
		assert.equal(await page.evaluate(() => window.__speech.utterances[0].rate), 1.25);
		await page.locator('[data-testid="read-aloud"] button').click();
		await page.waitForFunction(() => window.__speech.paused === 1);
		await page.locator('[data-testid="read-aloud"] button').click();
		assert.equal(await page.evaluate(() => window.__speech.utterances.length), 1);
		await page.evaluate(() => {
			let count = 0;
			while (count < window.__speech.utterances.length && count < 30) window.__speech.utterances[count++].onend?.({});
		});
		await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="read-aloud"]')].some((node) => node.textContent.includes("Stop")));
		const heard = await page.evaluate(() => window.__speech.utterances.map((utterance) => utterance.text).join(" "));
		assert.match(heard, /Questa spiegazione/);
		assert.doesNotMatch(heard, /PRIVATE_|```|##/);
		const beforeQuestion = await page.evaluate(() => window.__speech.utterances.length);
		await page.locator('[data-testid="question-dock"] [data-testid="read-aloud"] button').click();
		await page.waitForFunction((count) => window.__speech.utterances.length > count, {}, beforeQuestion);
		const question = await page.evaluate((count) => window.__speech.utterances.slice(count).map((utterance) => utterance.text).join(" "), beforeQuestion);
		assert.match(question, /Quale opzione/);
		assert.match(question, /Prima opzione/);
		assert.doesNotMatch(question, /PRIVATE_/);
		await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
		await page.waitForFunction(() => !document.querySelector('[data-testid="question-dock"] [data-testid="read-aloud"]').textContent.includes("Stop"));
		await go(`${prefix}_practice`);
		assert.equal(await page.$eval('select[aria-label="Reading speed"]', (select) => select.value), "1.25");
		await page.locator('[data-testid="practice-dock"] [data-testid="read-aloud"] button').click();
		await page.waitForFunction(() => window.__speech.utterances.length > 0);
		const practice = await page.evaluate(() => window.__speech.utterances.map((utterance) => utterance.text).join(" "));
		assert.match(practice, /Ricostruisci il processo/);
		assert.doesNotMatch(practice, /PRIVATE_/);
		await page.screenshot({ path: path.join(root, "data", "read-aloud-smoke.png"), fullPage: false });
		// Google UI uses a synthetic HTMLAudioElement and intercepted app requests: no key or quota consumed.
		let quota = false;
		await page.setRequestInterception(true);
		page.on("request", (request) => {
			if (new URL(request.url()).pathname !== "/api/speech") { void request.continue(); return; }
			if (request.method() === "GET") { void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }); return; }
			googleRequests.push(JSON.parse(request.postData()));
			void request.respond(quota
				? { status: 429, contentType: "application/json", body: JSON.stringify({ error: "Google speech quota reached. Saved audio can still be replayed." }) }
				: { status: 200, contentType: "audio/wav", headers: { "X-Speech-Cache": "hit" }, body: Buffer.from("synthetic-audio") });
		});
		await page.evaluateOnNewDocument(() => {
			window.__audios = [];
			window.Audio = class {
				constructor() { this.src = ""; this.playbackRate = 1; this.onended = null; this.onerror = null; this.paused = true; window.__audios.push(this); }
				async play() { this.paused = false; }
				pause() { this.paused = true; }
				load() {}
			};
		});
		await page.evaluate(() => localStorage.setItem("lh:read-aloud:v1", JSON.stringify({ provider: "google", rate: 1 })));
		await page.goto(`${base}/chat/${prefix}`, { waitUntil: "domcontentloaded" });
		const googleClick = async (label) => {
			await page.waitForFunction((label) => [...document.querySelector('[data-testid="read-aloud"]').querySelectorAll("button")].some((button) => button.textContent.trim() === label && !button.disabled), {}, label);
			await page.evaluate((label) => [...document.querySelector('[data-testid="read-aloud"]').querySelectorAll("button")].find((button) => button.textContent.trim() === label).click(), label);
		};
		await page.waitForSelector('select[aria-label="Google reading voice"]');
		assert.equal(await page.$eval('select[aria-label="Google reading voice"]', (select) => select.value), "Sulafat");
		await page.locator('[data-testid="read-aloud"] summary').click();
		await googleClick("Read aloud");
		await page.waitForFunction(() => window.__audios.length === 1 && !window.__audios[0].paused);
		assert.equal(googleRequests.length, 1);
		assert.equal(googleRequests[0].model, "gemini-3.8-flash-tts");
		assert.equal(googleRequests[0].voice, "Sulafat");
		assert.doesNotMatch(googleRequests[0].text, /PRIVATE_|```|##/);
		await googleClick("Pause");
		await page.select('select[aria-label="Reading speed"]', "1.5");
		assert.equal(await page.evaluate(() => window.__audios[0].playbackRate), 1.5);
		await googleClick("Resume");
		await page.waitForFunction(() => !window.__audios[0].paused);
		assert.equal(googleRequests.length, 1);
		await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
		await page.waitForFunction(() => !document.querySelector('[data-testid="read-aloud"]').textContent.includes("Stop"));
		quota = true;
		await googleClick("Read aloud");
		await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some((node) => node.textContent.includes("quota reached")));
		assert.equal(googleRequests.length, 2);
		await page.evaluate(() => [...document.querySelectorAll('[data-testid="read-aloud"] button')].find((button) => button.textContent === "Add Google key").click());
		await page.waitForSelector('[data-testid="key-gemini_tts_api_key-input"]');
		assert.equal(await page.$eval('[data-testid="key-gemini_tts_api_key-input"]', (input) => input.type), "password");
		assert.deepEqual(errors, [], "No browser runtime errors");
		console.log("PASS: device and Google controls, playback speed without regeneration, hidden-answer exclusion, page lifecycle, preference persistence, quota errors and protected Google key field. No Google API calls.");
	} catch (error) {
		console.error("Speech smoke diagnostics:", JSON.stringify({ googleRequests, page: await page?.evaluate(() => ({ audioCount: window.__audios?.length, audios: window.__audios?.map((a) => ({ paused: a.paused, src: a.src })), widgets: [...document.querySelectorAll('[data-testid="read-aloud"]')].map((node) => node.textContent) })).catch(() => null) }));
		throw error;
	} finally {
		await browser?.close();
		for (const file of fixturePaths) fs.rmSync(file, { force: true });
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
