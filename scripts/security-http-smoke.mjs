// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
/** Exercise the built server with a disposable profile and synthetic credentials only. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { probeEnv } from "./smoke-demo-runtime.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const home = fs.mkdtempSync(path.join(os.tmpdir(), "lh-security-http-"));
const capability = "a".repeat(64);
const syntheticKey = "not-a-real-api-key-private-fork-smoke";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let child;
try {
	fs.mkdirSync(path.join(home, "data", "chats"), { recursive: true });
	fs.writeFileSync(path.join(home, "auth.json"), JSON.stringify({ GEMINI_TTS_API_KEY: syntheticKey }), { mode: 0o600 });
	fs.writeFileSync(path.join(home, "data", "chats", "chat_security.json"), JSON.stringify({ id: "chat_security", version: 1, title: "Synthetic", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }));
	const port = await new Promise((resolve) => { const socket = net.createServer(); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
	const origin = `http://127.0.0.1:${port}`;
	child = spawn(process.execPath, [path.join(root, ".next", "standalone", "server.js")], {
		env: { ...probeEnv(process.env, home), PORT: String(port), HOSTNAME: "127.0.0.1", LH_DESKTOP_SERVER: "1", LH_DESKTOP_API_SECRET: capability }, stdio: "ignore",
	});
	async function request(url, { headers = {}, method = "GET", body } = {}) {
		return new Promise((resolve, reject) => {
			const req = http.request(origin + url, { method, headers }, (res) => { let text = ""; res.setEncoding("utf8"); res.on("data", (part) => { text += part; }); res.on("end", () => resolve({ status: res.statusCode, text })); });
			req.on("error", reject); req.setTimeout(5000, () => req.destroy(new Error("HTTP probe timeout")));
			req.end(body);
		});
	}
	let ready = false;
	for (let i = 0; i < 60; i++) {
		if (child.exitCode !== null) throw new Error("Standalone server exited");
		try { if ((await request("/api/keys")).status === 403) { ready = true; break; } } catch {}
		await wait(250);
	}
	assert(ready, "Standalone server did not start");
	const trusted = { "x-learnharness-desktop": capability, Origin: origin };
	const allowed = await request("/api/keys", { headers: trusted });
	assert.equal(allowed.status, 200); assert(!allowed.text.includes(syntheticKey));
	assert.equal((await request("/api/keys", { headers: { ...trusted, Origin: "https://attacker.invalid" } })).status, 403);
	assert.equal((await request("/chat/chat_security", { headers: { Host: "attacker.invalid" } })).status, 403);
	assert.equal((await request("/API/keys")).status, 403);
	assert.equal((await request("/%61pi/keys")).status, 403);
	assert.equal((await request("/chat/chat_security")).status, 200);
	assert.equal((await request("/api/speech", { headers: { ...trusted, "Content-Type": "application/json" }, method: "POST", body: "x".repeat(20_001) })).status, 413);
	console.log("PASS: built-server capability checks, cross-origin and hostile Host rejection, encoded API paths, key redaction and bounded speech body; no provider requests.");
} finally {
	if (child && child.exitCode === null) {
		child.kill();
		await Promise.race([new Promise((resolve) => child.once("exit", resolve)), wait(3000)]);
	}
	fs.rmSync(home, { recursive: true, force: true });
}
