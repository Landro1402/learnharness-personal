# Build this fork on Windows

Install Node.js 24.22 or later and Git. A clean checkout must not contain user data or provider credentials. Run `npm ci` on **Windows itself** so optional native packages match the target OS. No previous LearnHarness installation is needed.

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run desktop:personal
```

The desktop command builds Next, checks provider initialization, curates and checks the standalone server in Electron, then invokes electron-builder with **electron-builder.personal.yml**, Windows x64 and **--publish never**. Output ZIPs are under `dist/personal-packages`. `node scripts/build-fork-windows.mjs --plan` shows the sequence without executing it. Do not package a Linux or macOS server tree for Windows.

The separate Windows identity is `com.learnharness.personal`; the app name and profile are **LearnHarness Personal**. Official updates are disabled by the personal flag in package.json. Source publication does not update an already installed private app.

## First artifact verification

After publishing the source branch, enable Actions for your fork if GitHub asks. Select **Personal Windows artifact**, choose the prepared branch and run it manually. This workflow needs no repository secrets and has read-only contents permission. It uploads a test artifact, not a public release.

The independent Windows build pipeline has been prepared but has not yet run on GitHub. Download and exercise that artifact on Windows with a fresh profile before advertising a release. Check startup, speech setup, old/new message playback, both languages, and provider connections. Use your own keys locally; never include them in an artifact or issue. The earlier private runtime assembly is not a public build dependency or a public release artifact.

## Distributing a binary

Create a version tag at the exact tested commit. Attach the matching binary to a release for that tag and keep the corresponding source archive, NOTICE, LICENSE, dependency notices and these build instructions accessible alongside it. GitHub automatically supplies source archives for a release tag. Do not attach your private installed app, a profile backup, cached audio or a working directory ZIP. Preserve Electron/Chromium licenses and the Pi notice included by the personal packaging configuration. AGPL obligations are described in LICENSE; retain source availability for the versions you distribute.

## Data migration

A fresh personal profile is independent from upstream. This fork does not silently copy keys or credentials from another app. Back up the closed original profile before a manual migration and keep both installations separate. Do not overwrite a nonempty Personal profile to merge histories. No developer-specific migration or update scripts are shipped here.
