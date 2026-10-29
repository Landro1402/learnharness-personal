// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UpdateSettings } from "../components/settings/update-settings.tsx";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

it("keeps original authorship and AGPL while identifying the independent fork", () => {
	const pkg = JSON.parse(read("package.json"));
	assert.equal(pkg.author.name, "Amos Blomqvist");
	assert.equal(pkg.license, "AGPL-3.0-only");
	assert.equal(pkg.homepage, "https://github.com/Landro1402/learnharness-personal");
	assert.match(read("NOTICE.md"), /2026-10-29/);
	assert.match(read("docs/compaction-accounting.md"), /Copyright \(c\) Mario Zechner/);
});

it("personal packages include legal notices and cannot use the upstream publishing identity", () => {
	const config = yaml.load(read("electron-builder.personal.yml"));
	assert.equal(config.appId, "com.learnharness.personal");
	assert.equal(config.publish, null);
	assert(config.extraResources.some((entry: { from: string }) => entry.from === "LICENSE"));
	assert(config.extraResources.some((entry: { from: string }) => entry.from === "NOTICE.md"));
	assert.match(read("scripts/build-fork-windows.mjs"), /"--publish", "never"/);
});

it("active Windows automation is manual, read-only and uploads artifacts rather than releases", () => {
	const workflow = yaml.load(read(".github/workflows/personal-windows.yml"));
	assert.equal(workflow.on, "workflow_dispatch");
	assert.equal(workflow.permissions.contents, "read");
	assert(!read(".github/workflows/personal-windows.yml").includes("GH_TOKEN"));
	assert(!fs.existsSync(new URL("../.github/workflows/release.yml", import.meta.url)));
});

it("the personal version surface offers attribution, source, license and warranty information", () => {
	const html = renderToStaticMarkup(<UpdateSettings autoUpdate={false} onAutoUpdateChange={() => {}} version="0.3.9-personal.3" homepage="https://github.com/Landro1402/learnharness-personal" />);
	assert.match(html, /Amos Blomqvist/); assert.match(html, /Landro1402/);
	assert.match(html, /AGPL-3.0-only/); assert.match(html, /No warranty/);
	assert.match(html, /Source code/); assert.match(html, /google-voice-fork\/LICENSE/);
});
