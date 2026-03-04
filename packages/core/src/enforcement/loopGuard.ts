// ─────────────────────────────────────────────────────────────────────────────
// LoopGuard — Per-Run Tool Call Limiter
//
// Prevents infinite tool loops within a single agent run by counting every
// call routed through authority.tool(). The counter resets at the start of
// each wrap() invocation, so limits apply per-run, not globally.
// ─────────────────────────────────────────────────────────────────────────────

import type { LoopGuardConfig, GuardResult } from "../types";

export class LoopGuard {
    private count = 0;
    private readonly limit: number;

    constructor(config: LoopGuardConfig) {
        this.limit = config.maxToolCallsPerRun;
    }

    /**
     * Reset the call counter. Called by AuthorityLayer at the start of wrap().
     */
    reset(): void {
        this.count = 0;
    }

    /**
     * Increment the counter and check against the per-run limit.
     * Returns a PendingHalt once the count exceeds the limit.
     */
    tick(): GuardResult {
        this.count += 1;

        if (this.count > this.limit) {
            return {
                status: "halted",
                reason: "loop_limit_exceeded",
                limit: this.limit,
                spent: this.count,
            };
        }

        return { status: "ok" };
    }

    getCount(): number {
        return this.count;
    }
}
