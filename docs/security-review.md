# Pre-publication security review — 2026-10-29

Scope: the prepared LearnHarness Personal source branch, the complete reachable upstream/fork Git history, known local maintainer credentials, npm dependency advisories, local HTTP boundaries, desktop external navigation, speech requests, key status projection, CI configuration, and retained licensing/attribution. This is a targeted review and regression check, not a formal penetration test or a guarantee that the software has no vulnerabilities.

## Privacy and attribution

No conversation records, learning ledgers, credentials, audio caches, private backups, installed executables or machine-specific migration files are included in the publication checkout. Known local API keys and subscription tokens were compared to the source and reachable Git objects without printing their values or sending them to external services. The maintainer's public GitHub username and GitHub noreply address are used for the publication commit; inherited public upstream authorship is retained.

The original AGPL LICENSE files remain unchanged. Original authorship is retained in package metadata and README. NOTICE.md identifies the upstream commit, maintainer, modifications and date; modified code carries notices. The existing MIT Pi attribution remains intact. Personal desktop packaging includes LICENSE, NOTICE and the Pi notice. Dependency notices and corresponding source must be retained when distributing binaries. Review the actual native Windows artifact and its bundled license notices before a public binary release.

## Findings and fixes

- npm initially reported **14 affected dependency entries** (4 critical, 9 high, 1 moderate). Compatible updates and removal of unused `ansi-to-react` brought the final npm audit to **0 reported advisories**, including development dependencies, at the time of this check. Counts describe npm's report, not independently demonstrated exploits. Notable versions: Next 16.4.3, DOMPurify 3.4.17, Undici 7.30.1 and Electron 44.10.0. The Electron version was separately updated within major 44; npm audit does not assess every Chromium/OS vulnerability.
- Browser development/start defaults now bind to 127.0.0.1. All pages and APIs check loopback Host and browser Origin/Fetch Metadata, including server-rendered chat pages, to reduce cross-site and DNS-rebinding exposure. The desktop capability is still required on API requests, including case/encoding variants.
- Desktop external links are restricted to HTTP(S); file, script, OS command and custom protocols are rejected. Existing context isolation, renderer sandboxing, disabled Node integration and frame-bound capability injection are retained.
- Short legacy/unknown secret values are now fully masked rather than exposing their complete value in key-status responses.
- Dictation errors no longer relay provider response bodies. Google speech errors were already sanitized, the provider endpoint is fixed, cache filenames are hashes, and credentials remain server-side.
- Speech request size is limited while reading bytes, not after allocating the complete body.
- CI checkout credentials are not persisted, active Actions are pinned to verified upstream commits, token permissions are read-only, and npm high/critical advisories fail checks. The Windows workflow remains manually triggered and uploads test artifacts only; it does not publish releases or use maintainer API keys.

## Verification

The full unit suite and production build passed after dependency updates and request guards; tests cover cross-origin requests, hostile Hosts, encoded API paths, external-link scheme rejection, body limits, key masking, cached speech, and legal notices. A built-server smoke check with a disposable profile verified actual HTTP enforcement and confirmed that its synthetic key was not returned. It made no provider requests.

## Remaining boundaries

This is a local, single-user application. It has no complete user-account authorization model for a public web deployment; do not expose its server via a LAN binding, tunnel or reverse proxy. Host/Origin checks are not user authentication. Keys and subscription tokens are local files protected by OS permissions, not an encrypted vault; malware with the same OS account can access them. Untrusted generated content and dependencies require continued review. A zero npm report does not prove absence of unknown, unreported, browser-engine or configuration vulnerabilities.

The independent Windows package still needs its manual native build and artifact review. Publishing this source branch does not update older private installations automatically. No evidence of compromise was established by this review; dependency advisories alone are not evidence that a key has been stolen.
