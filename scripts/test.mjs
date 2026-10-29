// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const tests = fs.readdirSync(path.join(root, "tests")).filter((name) => /\.test\.tsx?$/.test(name)).sort().map((name) => path.join("tests", name));
const result = spawnSync(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "--test", "--test-concurrency=4", ...tests], { cwd: root, env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
