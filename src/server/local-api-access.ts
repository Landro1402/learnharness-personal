// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
/** Local single-user API gate. Not a replacement for authentication on a hosted service. */
export function localAPIAuthorized(headers: Headers, requestURL: string): boolean {
	try {
		const url = new URL(requestURL);
		const host = headers.get("host");
		if (host) {
			const supplied = new URL(`${url.protocol}//${host}`);
			if (supplied.username || supplied.password || supplied.pathname !== "/" || supplied.search || supplied.hash) return false;
			url.host = supplied.host;
		}
		if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
		if (headers.get("sec-fetch-site") === "cross-site") return false;
		const origin = headers.get("origin");
		return origin === null || origin === url.origin;
	} catch { return false; }
}
