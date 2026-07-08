#!/usr/bin/env node
/**
 * Publish @templara/* packages in dependency order.
 * Workaround for @changesets/cli@2.31.0 crashing on pnpm 11 E403 JSON
 * (missing error.summary → TypeError in isAlreadyPublishedError).
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Topological publish order — dependents come after dependencies. */
const ORDER = [
  "core",
  "renderer",
  "assets",
  "react-renderer",
  "pdf",
  "templates",
  "cli",
  "editor",
];

function readVersion(pkgDir) {
  const json = JSON.parse(readFileSync(join(root, "packages", pkgDir, "package.json"), "utf8"));
  return { name: json.name, version: json.version };
}

function isOnNpm(name, version) {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0 && result.stdout.trim() === version;
}

function publishArgs() {
  const args = ["publish", "--access", "public", "--no-git-checks"];
  const otp = process.env.NPM_OTP || process.env.npm_config_otp;
  if (otp) args.push("--otp", otp);
  return args;
}

function publish(pkgDir) {
  const { name, version } = readVersion(pkgDir);
  if (isOnNpm(name, version)) {
    console.log(`⏭  ${name}@${version} already on npm`);
    return;
  }
  console.log(`\n📦 Publishing ${name}@${version}...`);
  const result = spawnSync("pnpm", publishArgs(), {
    cwd: join(root, "packages", pkgDir),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`
Publish failed for ${name}.

If npm says 2FA is required:
  1. Enable 2FA: https://www.npmjs.com/settings/~/tfa
     (choose "Authorization and publishing" mode)
  2. Re-login: npm login
  3. Publish with a one-time code from your authenticator app:

     NPM_OTP=123456 pnpm publish:packages
`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓  ${name}@${version}`);
}

console.log("npm user:", execSync("npm whoami", { encoding: "utf8" }).trim());

for (const pkgDir of ORDER) {
  publish(pkgDir);
}

console.log("\nDone. Verify: npm view @templara/core version");
