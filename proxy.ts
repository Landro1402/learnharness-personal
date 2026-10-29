// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import { NextResponse, type NextRequest } from "next/server";
import { desktopAPIAuthorized } from "./src/server/desktop-access.ts";
import { localAPIAuthorized } from "./src/server/local-api-access.ts";

/** Applies to every API method, including SSE and spending/settings routes.
 * No public callback or worker bypass: internal jobs call server functions,
 * and any legitimate self-HTTP request must carry the private capability. */
export function proxy(request: NextRequest) {
	if (!localAPIAuthorized(request.headers, request.url)) {
		return NextResponse.json({ error: "API access is limited to this local app." }, { status: 403, headers: { "Cache-Control": "no-store" } });
	}
	let pathname = request.nextUrl.pathname;
	try {
		for (let i = 0; i < 3; i++) {
			const decoded = decodeURIComponent(pathname);
			if (decoded === pathname) break;
			pathname = decoded;
		}
	} catch { return NextResponse.json({ error: "Invalid request path." }, { status: 400 }); }
	const api = /^\/api(?:\/|$)/i.test(pathname.replaceAll("\\", "/").replace(/\/{2,}/g, "/"));
	if (api && !desktopAPIAuthorized(request.headers)) {
		return NextResponse.json(
			{ error: "Desktop API access requires the trusted LearnHarness window." },
			{ status: 403, headers: { "Cache-Control": "no-store" } },
		);
	}
	return NextResponse.next();
}

// Server-rendered pages also contain private records: check their Host/Origin too.
export const config = { matcher: "/:path*" };
