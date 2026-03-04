// ─────────────────────────────────────────────────────────────────────────────
// Minimal Agent Example
//
// Demonstrates all three enforcement primitives in a simulated agent loop.
// Run:  npx ts-node example.ts  (from this directory, after installing deps)
//
// What this shows:
//   - Budget cap: recordSpend() accumulates and halts when exceeded
//   - Loop guard: tool() counts calls per run, halts at maxToolCallsPerRun
//   - Tool throttle: tool() enforces a per-minute rate cap
//   - EnforcementHalt: structured halt object accessible at err.enforcement
//   - Chain integrity: verifyChain() confirms no events were tampered with
// ─────────────────────────────────────────────────────────────────────────────

import { AuthorityLayer, EnforcementHalt } from "../../packages/core/dist/index";

// ── Configure the authority layer ─────────────────────────────────────────────

const authority = new AuthorityLayer({
    mode: "strict", // Default — execution halts immediately on breach

    budget: {
        dailyUSD: 0.05, // Very tight limit so this example triggers it quickly
    },

    loopGuard: {
        maxToolCallsPerRun: 5, // Halt after 5 tool calls in a single run
    },

    toolThrottle: {
        maxCallsPerMinute: 20, // Sliding-window rate cap
    },
});

// ── Simulated tool functions ──────────────────────────────────────────────────

/** Pretend LLM call that costs a small amount per invocation. */
async function callLLM(prompt: string): Promise<string> {
    // Simulate latency
    await new Promise((r) => setTimeout(r, 10));
    return `LLM response to: "${prompt}"`;
}

/** Pretend external API call (e.g. web search, database, external service). */
async function searchWeb(query: string): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 10));
    return [`Result 1 for "${query}"`, `Result 2 for "${query}"`];
}

// ── Agent run ─────────────────────────────────────────────────────────────────

async function main() {
    console.log("Starting agent run...\n");

    try {
        await authority.wrap(async () => {
            // Iteration 1
            const answer1 = await authority.tool("llm.chat", () =>
                callLLM("What is 2 + 2?")
            );
            console.log("[Tool 1] LLM:", answer1);
            // Report the cost of this LLM call (host calculates cost from token counts)
            authority.recordSpend(0.01);

            // Iteration 2
            const results = await authority.tool("web.search", () =>
                searchWeb("TypeScript enforcement patterns")
            );
            console.log("[Tool 2] Search:", results[0]);
            authority.recordSpend(0.01);

            // Iteration 3
            const answer2 = await authority.tool("llm.chat", () =>
                callLLM("Summarize the search results")
            );
            console.log("[Tool 3] LLM:", answer2);
            authority.recordSpend(0.01);

            // Iteration 4
            const answer3 = await authority.tool("llm.chat", () =>
                callLLM("Any follow-up questions?")
            );
            console.log("[Tool 4] LLM:", answer3);
            authority.recordSpend(0.01);

            // Iteration 5
            const answer4 = await authority.tool("llm.chat", () =>
                callLLM("Final answer")
            );
            console.log("[Tool 5] LLM:", answer4);

            // This spend push will cross the $0.05 budget cap → halts here
            authority.recordSpend(0.02);

            // This line will never be reached
            console.log("This should not print.");
        });
    } catch (err) {
        if (err instanceof EnforcementHalt) {
            // ✅ Access the structured enforcement object directly — no string parsing
            console.error("\n⛔ Execution halted by AuthorityLayer\n");
            console.error(JSON.stringify(err.enforcement, null, 2));
        } else {
            // Unexpected runtime error — rethrow
            throw err;
        }
    }

    // ── Chain audit ─────────────────────────────────────────────────────────────

    console.log("\n── Enforcement Event Chain ──────────────────────────────────");
    const chain = authority.getChain();
    for (const event of chain) {
        console.log(`  [${event.type}] ${event.event_id} @ ${event.timestamp}`);
    }

    const intact = authority.verifyChain();
    console.log(`\nChain integrity: ${intact ? "✅ verified" : "❌ TAMPERED"}`);
    console.log(`Total events: ${chain.length}`);
}

main().catch(console.error);
