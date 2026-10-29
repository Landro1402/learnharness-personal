# Attribution and modification notice

LearnHarness Personal is an independently maintained fork of LearnHarness by Amos Blomqvist and its contributors:
https://github.com/amosblomqvist/learnharness

Base: version 0.3.9, commit 3dd52110bbcbcba81645453ce0a8fdc230594c47.
Fork maintainer: Landro1402 — https://github.com/Landro1402
Modification date: 2026-10-29.

Changes add Google Gemini read-aloud, English/Italian tutor delivery, per-passage playback for historical replies, local audio caching and independent desktop identity. Fork packaging, documentation and CI have been adjusted for source publication. Original copyright, authorship and license notices remain in force; this notice does not claim authorship of the upstream application.

The combined work is distributed under GNU Affero General Public License version 3 only (AGPL-3.0-only). See LICENSE for the full terms, redistribution rights and warranty disclaimer. Retain this notice, LICENSE and other applicable notices with copies. Source for a distributed executable must correspond to that executable; publish each binary with its exact source tag and build instructions.

## Third-party notices

Retain the MIT attribution to Mario Zechner in docs/compaction-accounting.md for the bounded Pi cutoff/estimator adaptation. npm dependencies retain their own licenses and copyright notices. Electron distributions include Electron and Chromium license files; do not remove them from built artifacts. No Google models or model weights are bundled: Google speech is a user-configured external service.

The upstream README and release guides are retained as references. Upstream logos and screenshots remain upstream assets; the fork landing page uses a distinct text title rather than presenting itself as an official download.

## Modified and added code

- `app/api/speech/route.ts`
- `components/answered-card.tsx`
- `components/chat.tsx`
- `components/google-speech-playback.ts`
- `components/practice-cards.tsx`
- `components/practice-dock.tsx`
- `components/question-dock.tsx`
- `components/read-aloud.tsx`
- `components/settings/keys-section.tsx`
- `components/settings/update-settings.tsx`
- `components/speech-playback.ts`
- `electron/main.cjs`
- `scripts/build-fork-windows.mjs`
- `scripts/smoke-read-aloud.cjs`
- `scripts/test.mjs`
- `src/core/auth-keys.ts`
- `src/core/google-speech.ts`
- `src/core/index.ts`
- `src/core/read-aloud.ts`
- `src/server/google-speech.ts`
- `src/server/index.ts`
- `src/server/speech-handler.ts`
- `tests/auth-keys.test.ts`
- `tests/automatic-updates.test.ts`
- `tests/chatgpt-connection-ui.test.tsx`
- `tests/desktop-platform.test.ts`
- `tests/google-speech.test.ts`
- `tests/read-aloud.test.ts`
- `tests/settings-pure.test.ts`
- `tests/speech-handler.test.ts`
- `tests/public-fork.test.tsx`
- `tests/verify-release.test.ts`
- `app/api/stt/token/route.ts`
- `electron/external-links.cjs`
- `proxy.ts`
- `src/server/limited-body.ts`
- `src/server/local-api-access.ts`
- `tests/desktop-api.test.ts`
- `tests/fork-security.test.ts`

## Security hardening (2026-10-29)

Patched known vulnerable dependencies; removed unused ansi-to-react. Added loopback Host/Origin checks for pages and APIs, restricted external browser links to HTTP(S), masked short legacy secrets completely, bounded speech request bytes while streaming, and removed provider diagnostic bodies from dictation errors. CI now checks npm advisories and does not persist checkout credentials.

- `scripts/security-http-smoke.mjs`
