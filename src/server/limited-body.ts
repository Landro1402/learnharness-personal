// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
export class BodyTooLargeError extends Error {}
/** Limit bytes while reading, rather than allocating an unrestricted request.text() first. */
export async function limitedBody(request: Request, maxBytes: number): Promise<string> {
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
	if (!request.body) return "";
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0, text = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) {
				void reader.cancel().catch(() => {});
				throw new BodyTooLargeError();
			}
			text += decoder.decode(value, { stream: true });
		}
		return text + decoder.decode();
	} finally { reader.releaseLock(); }
}
