// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import path from "node:path";
import { PATHS } from "../../config.ts";
import { GOOGLE_SPEECH_KEY } from "../core/google-speech.ts";
import { createGoogleSpeechService, GoogleSpeechError } from "./google-speech.ts";
import { keyValue } from "./keys.ts";
import { limitedBody, BodyTooLargeError } from "./limited-body.ts";

const service = createGoogleSpeechService({ cacheDir: path.join(PATHS.data, "speech"), key: () => keyValue(GOOGLE_SPEECH_KEY) });
export function speechStatus() {
	return Response.json({ configured: Boolean(keyValue(GOOGLE_SPEECH_KEY)) }, { headers: { "Cache-Control": "no-store" } });
}
export async function speechResponse(request: Request) {
	// Reject cross-origin browser requests before any synthesis or use of the key.
	const origin = request.headers.get("origin");
	// Next can normalize request.url to localhost even when the browser uses 127.0.0.1.
	const self = new URL(request.url);
	const host = request.headers.get("host");
	if (host) self.host = host;
	if (origin && origin !== self.origin) return Response.json({ error: "Speech requests must come from this app." }, { status: 403 });
	try {
		const raw = await limitedBody(request, 20_000);
		let body: unknown;
		try { body = JSON.parse(raw); } catch { return Response.json({ error: "Expected JSON." }, { status: 400 }); }
		const result = await service.synthesize(body);
		return new Response(new Uint8Array(result.audio), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Speech-Cache": result.cached ? "hit" : "miss" } });
	} catch (error) {
		if (error instanceof BodyTooLargeError) return Response.json({ error: "Speech request is too large." }, { status: 413, headers: { "Cache-Control": "no-store" } });
		return Response.json({ error: error instanceof GoogleSpeechError ? error.message : "Could not generate or save speech audio." }, { status: error instanceof GoogleSpeechError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
	}
}
