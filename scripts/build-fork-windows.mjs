// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const steps = [
 ["node_modules/next/dist/bin/next", "build"],
 ["scripts/smoke-provider-runtime.mjs"],
 ["scripts/build-server.mjs"],
 ["scripts/security-http-smoke.mjs"],
 ["scripts/smoke-server.mjs", "--electron"],
 ["node_modules/electron-builder/cli.js", "--config", "electron-builder.personal.yml", "--win", "--x64", "--publish", "never"],
];
if (process.argv.includes("--plan")) console.log(JSON.stringify(steps, null, 2));
else {
 if (process.platform !== "win32") throw new Error("Build the Windows payload on Windows, or run the manual Personal Windows artifact workflow.");
 fs.rmSync(path.join(root, ".next", "standalone"), { recursive: true, force: true });
 for (const args of steps) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
 }
}
