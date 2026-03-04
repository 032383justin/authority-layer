// ─────────────────────────────────────────────────────────────────────────────
// BudgetGuard — Hard USD Spend Cap
//
// Tracks cumulative USD spend across a run and halts execution when it
// exceeds the configured dailyUSD limit.
//
// Spend is reported explicitly by the host via AuthorityLayer.recordSpend().
// This keeps the core framework-agnostic — different model providers expose
// pricing differently, so the host is responsible for conversion.
// ─────────────────────────────────────────────────────────────────────────────

import type { BudgetConfig, GuardResult } from "../types";

export class BudgetGuard {
    private spent = 0;
    private readonly limit: number;

    constructor(config: BudgetConfig) {
        this.limit = config.dailyUSD;
    }

    /**
     * Record additional spend and check against the hard limit.
     * Returns a PendingHalt if the cumulative spend now exceeds the limit.
     */
    record(amountUSD: number): GuardResult {
        this.spent += amountUSD;

        if (this.spent > this.limit) {
            return {
                status: "halted",
                reason: "budget_exceeded",
                limit: this.limit,
                spent: this.spent,
            };
        }

        return { status: "ok" };
    }

    getSpent(): number {
        return this.spent;
    }

    getLimit(): number {
        return this.limit;
    }
}
