// AuthorityLayer — live enforcement demonstration
//
// Runs a simulated agent loop that deliberately breaches the budget cap.
// Shows the structured EnforcementHalt object and the hash-linked event chain.
//
// Run from repo root: npm run example

"use strict";

const path = require("path");
const { AuthorityLayer, EnforcementHalt } = require(
    path.join(__dirname, "../packages/core/dist/index")
);

const authority = new AuthorityLayer({
    mode: "strict",
    budget: { dailyUSD: 0.05 },          // $0.05 hard cap
    loopGuard: { maxToolCallsPerRun: 10 },
    toolThrottle: { maxCallsPerMinute: 20 },
});

// Simulated tool — pretend LLM call
async function callLLM(prompt) {
    await new Promise(r => setTimeout(r, 20));
    return `Response to: "${prompt}"`;
}

async function main() {
    console.log("╔══════════════════════════════════════╗");
    console.log("║   AuthorityLayer — live demo         ║");
    console.log("╚══════════════════════════════════════╝\n");
    console.log("Config: $0.05 budget cap, 10 calls/run max\n");

    try {
        await authority.wrap(async () => {

            for (let i = 1; i <= 5; i++) {
                const reply = await authority.tool("llm.chat", () => callLLM(`Question ${i}`));
                const spend = 0.01;
                authority.recordSpend(spend);
                console.log(`  [call ${i}] ${reply.slice(0, 40)}  spend: $${spend.toFixed(2)}`);
            }

            // This final spend push crosses $0.05 → triggers budget_exceeded halt
            console.log("\n  [call 6] Reporting $0.02 spend — this will exceed the cap...");
            authority.recordSpend(0.02);

            console.log("  (this line never prints)");
        });

    } catch (err) {
        if (err instanceof EnforcementHalt) {
            console.log("\n⛔  Execution halted\n");
            console.log(JSON.stringify(err.enforcement, null, 2));
        } else {
            throw err;
        }
    }

    // Audit
    const chain = authority.getChain();
    const intact = authority.verifyChain();

    console.log("\n── Event chain ─────────────────────────");
    chain.forEach(e => console.log(`  ${e.type.padEnd(20)} ${e.event_id}`));
    console.log(`\nChain integrity : ${intact ? "✅  verified" : "❌  TAMPERED"}`);
    console.log(`Total events    : ${chain.length}`);
}

main().catch(err => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
