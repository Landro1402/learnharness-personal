// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, it } from "node:test";

const dir = mkdtempSync(path.join(os.tmpdir(), "lh-speech-http-"));
process.env.LH_AUTH_FILE = path.join(dir, "auth.json");
process.env.LH_DATA_DIR = dir;
const { speechResponse } = await import("../src/server/speech-handler.ts");
after(() => rmSync(dir, { recursive: true, force: true }));

it("accepts the browser Host origin when Next normalizes request.url to localhost", async () => {
	const response = await speechResponse(new Request("http://localhost:3100/api/speech", {
		method: "POST", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" }, body: "invalid JSON",
	}));
	assert.equal(response.status, 400); // Passed origin gate; rejected before any provider request.
});
it("rejects cross-origin synthesis before parsing or accessing Google", async () => {
	const response = await speechResponse(new Request("http://localhost:3100/api/speech", {
		method: "POST", headers: { host: "127.0.0.1:3100", origin: "https://example.com" }, body: "invalid JSON",
	}));
	assert.equal(response.status, 403);
});
