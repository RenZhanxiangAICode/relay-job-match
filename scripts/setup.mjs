import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args) {
  const result = spawnSync(npm, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nRelay setup: installing dependencies...");
run(["install"]);
console.log("\nRelay setup: generating database migration...");
run(["run", "db:generate"]);
console.log("\nRelay setup: verifying production build...");
run(["run", "build"]);
console.log("\n✓ Relay is ready. Run `npm run dev` to start locally.\n");
