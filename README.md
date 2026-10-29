# LearnHarness Personal

Independent fork of [LearnHarness](https://github.com/amosblomqvist/learnharness), originally developed by **Amos Blomqvist**. Maintained by [Landro1402](https://github.com/Landro1402).

Based on upstream **0.3.9**, commit [`3dd5211`](https://github.com/amosblomqvist/learnharness/commit/3dd52110bbcbcba81645453ce0a8fdc230594c47). Modifications dated **2026-10-29**. Distributed under **AGPL-3.0-only**; see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

## Added in this fork

- Google Gemini text-to-speech with English and Italian tutor delivery.
- Read-aloud controls on individual assistant passages, including earlier responses grouped in the transcript.
- Voice/model selection, pause/resume/stop and local playback speed.
- Recordings cached locally to avoid repeated generation requests. Existing English recordings remain compatible.
- A separate desktop identity and profile, **LearnHarness Personal**. Official upstream updates are disabled for this variant.

The teaching engine, questions, practice and knowledge graph come from LearnHarness. See the [upstream overview](docs/UPSTREAM-README.md). This repository publishes source code; no fork installer is advertised as released or validated yet.

## Run from source

Use **Node.js 24.22 or later** and npm. Clone this fork, then:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Configure your own teaching model or subscription connection through Settings. A browser-only development session is separate from a packaged desktop profile.

For the Electron development shell, use `npm run desktop:dev`. For speech setup, see [Google speech](docs/google-speech.md).

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

## Your keys and learning data

Every user supplies their own Google API key. Under **Settings → Providers → Read aloud**, add a Gemini key from [Google AI Studio](https://aistudio.google.com/api-keys). Check the project's billing tier and quotas there. This application does not activate billing or guarantee a free allowance.

Speech sends the selected visible text to Google when a recording is needed. Cached replays and speed changes do not call Google. Google use is subject to its service terms. The text-generation model and its billing are configured separately.

Chats, progress, audio, credentials and backups stay local and must not be committed. Runtime data is ignored by Git. See [SECURITY.md](SECURITY.md). Read-aloud uses the original text; selecting Italian delivery does not translate an English lesson.

## Desktop builds and existing history

The fork uses a separate **LearnHarness Personal** profile. It does not automatically import another installation's data. Close the apps and retain a backup before any manual migration; the machine-specific migration tools used during development are not part of this repository.

For a Windows build from source, see [the fork build guide](docs/fork-desktop.md). The manual GitHub Actions workflow produces a test artifact only; it does not publish a GitHub Release. Upstream build instructions are historical references, not the release procedure for this fork.

## Security review

See [the review scope and findings](docs/security-review.md). This is a local single-user application, not an authenticated public web service. Keep it bound to loopback; do not expose its development or standalone server to a network.

## Support and license

Report fork-specific problems in [this fork's issue tracker](https://github.com/Landro1402/learnharness-personal/issues). Keep upstream acknowledgments and dependency license notices when redistributing.

Original LearnHarness copyright remains with its respective contributors. This fork is maintained independently; the original author is not responsible for these modifications. You may modify and redistribute this work under **AGPL-3.0-only**, which also requires corresponding source when distributing binaries and a source offer for applicable remote network use. The software is provided **without warranty**, as described in [LICENSE](LICENSE).
