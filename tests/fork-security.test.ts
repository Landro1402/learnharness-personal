// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { it } from "node:test";
import { NextRequest } from "next/server";
import { localAPIAuthorized } from "../src/server/local-api-access.ts";
import { limitedBody, BodyTooLargeError } from "../src/server/limited-body.ts";
import { proxy } from "../proxy.ts";
const require = createRequire(import.meta.url);
const { safeExternalURL, openSafeExternal } = require("../electron/external-links.cjs");

it("rejects browser cross-origin writes, opaque origins and DNS rebinding hosts for every API", () => {
	for (const method of ["GET", "POST", "PUT", "DELETE"]) {
		assert.equal(proxy(new NextRequest("http://localhost:3000/api/keys", { method, headers: { origin: "https://attacker.invalid" } })).status, 403);
		assert.equal(proxy(new NextRequest("http://localhost:3000/api/keys", { method, headers: { host: "attacker.invalid:3000" } })).status, 403);
	}
	assert(!localAPIAuthorized(new Headers({ origin: "null" }), "http://localhost:3000/api/settings"));
	assert(!localAPIAuthorized(new Headers({ "sec-fetch-site": "cross-site" }), "http://localhost:3000/api/stt/token"));
	assert(!localAPIAuthorized(new Headers({ host: "localhost/path" }), "http://localhost:3000/api/keys"));
	assert.equal(proxy(new NextRequest("http://localhost:3000/chat/private", { headers: { host: "attacker.invalid:3000" } })).status, 403, "Server-rendered chat pages must not bypass the Host gate");
});
it("accepts local browser and CLI requests, including Next hostname normalization", () => {
	for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
		assert(localAPIAuthorized(new Headers({ origin, host: new URL(origin).host }), "http://localhost:3000/api/settings"));
	}
	assert(localAPIAuthorized(new Headers(), "http://127.0.0.1:3000/api/chats"));
});
it("keeps desktop capability checks on encoded and case-variant API paths", () => {
	const old = process.env.LH_DESKTOP_SERVER;
	process.env.LH_DESKTOP_SERVER = "1";
	try {
		for (const pathname of ["/API/keys", "/%61pi/keys", "/api%2fkeys", "/%2561pi/keys"]) {
			assert.equal(proxy(new NextRequest(`http://localhost:3000${pathname}`)).status, 403);
		}
	} finally { if (old === undefined) delete process.env.LH_DESKTOP_SERVER; else process.env.LH_DESKTOP_SERVER = old; }
});
it("never dispatches dangerous schemes or malformed links to the OS shell", async () => {
	let calls = 0;
	const shell = { openExternal: async () => { calls++; } };
	for (const url of ["file:///C:/Windows/system32/calc.exe", "javascript:alert(1)", "data:text/html,test", "ms-msdt:/test", "powershell:payload", "https://user:password@example.com", "https://example.com\n", "not a URL"]) {
		assert.equal(safeExternalURL(url), false); assert.equal(await openSafeExternal(url, shell), false);
	}
	assert.equal(calls, 0);
	assert.equal(await openSafeExternal("https://example.com/guide", shell), true);
	assert.equal(calls, 1);
});
it("bounds UTF-8 bytes while streaming, even without Content-Length", async () => {
	const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("è".repeat(20))); controller.close(); } });
	const request = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
	await assert.rejects(limitedBody(request, 30), BodyTooLargeError);
	assert.equal(await limitedBody(new Request("http://localhost", { method: "POST", body: "è" }), 2), "è");
});
