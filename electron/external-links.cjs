// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
"use strict";
function safeExternalURL(target) {
	if (typeof target !== "string" || /[\x00-\x20\x7f]/.test(target)) return false;
	try {
		const url = new URL(target);
		return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
	} catch { return false; }
}
async function openSafeExternal(target, shell) {
	if (!safeExternalURL(target)) return false;
	try { await shell.openExternal(target); return true; } catch { return false; }
}
module.exports = { safeExternalURL, openSafeExternal };
