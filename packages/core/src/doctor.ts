#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// authority-layer doctor
//
// Runs a series of guardrail checks and prints results to stdout.
// Exit 0 = all checks pass. Exit 1 = one or more checks failed.
//
// Usage:
//   npx authority-layer doctor
//   authority-layer doctor   (if installed globally)
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";

const RESET = "\x1b[0m";
const GREEN = "\x1b[1;32m";
const RED = "\x1b[1;31m";
const YELLOW = "\x1b[1;33m";
const BOLD = "\x1b[1m";

interface CheckResult {
    name: string;
    ok: boolean;
    note?: string;
}

const results: CheckResult[] = [];

function check(name: string, ok: boolean, note?: string): void {
    results.push({ name, ok, note });
}

// ── Guardrail checks ──────────────────────────────────────────────────────────

// 1. Node version
const [major] = process.versions.node.split(".").map(Number);
check(
    "Node.js version >= 18",
    major >= 18,
    `found ${process.versions.node}`
);

// 2. crypto module (required by hash chain)
try {
    createHash("sha256").update("test").digest("hex");
    check("crypto module (sha256)", true);
} catch {
    check("crypto module (sha256)", false, "built-in crypto unavailable");
}

// 3. No AUTHORITY_LAYER_DISABLE env flag set
const disabled = process.env["AUTHORITY_LAYER_DISABLE"] === "1";
check(
    "AUTHORITY_LAYER_DISABLE not set",
    !disabled,
    disabled ? "enforcement is currently disabled via env" : undefined
);

// 4. Offline capable — confirm no network is required for import
try {
    // Dynamic require — avoids top-level import that would run before checks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./index");
    check("core module loads offline", true);
} catch (err) {
    check("core module loads offline", false, String(err));
}

// 5. Sanity: AuthorityLayer instantiates with a minimal config
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AuthorityLayer } = require("./index");
    const a = new AuthorityLayer({ budget: { dailyUSD: 1 } });
    const chain = a.getChain();
    check("AuthorityLayer instantiates", true, `chain length: ${chain.length}`);
} catch (err) {
    check("AuthorityLayer instantiates", false, String(err));
}

// ── Output ────────────────────────────────────────────────────────────────────

const pkg = require("../package.json") as { name: string; version: string };

console.log(`\n${BOLD}AuthorityLayer Doctor${RESET}  ${YELLOW}${pkg.name}@${pkg.version}${RESET}\n`);

let failed = 0;

for (const r of results) {
    const icon = r.ok ? `${GREEN}✔${RESET}` : `${RED}✘${RESET}`;
    const status = r.ok ? `${GREEN}pass${RESET}` : `${RED}FAIL${RESET}`;
    const note = r.note ? `  ${YELLOW}(${r.note})${RESET}` : "";
    console.log(`  ${icon}  ${r.name.padEnd(38)} ${status}${note}`);
    if (!r.ok) failed++;
}

console.log();

if (failed === 0) {
    console.log(`${GREEN}All checks passed.${RESET} AuthorityLayer is ready.\n`);
    process.exit(0);
} else {
    console.log(`${RED}${failed} check(s) failed.${RESET} Review the output above.\n`);
    process.exit(1);
}
