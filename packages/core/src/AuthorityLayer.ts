// ─────────────────────────────────────────────────────────────────────────────
// AuthorityLayer — Main Enforcement Class
//
// This is the single public surface of the SDK. Instantiate once, pass config,
// then route all agent execution through wrap() and all tool calls through
// tool(). recordSpend() is the only other public method — it exists because
// token pricing is framework-specific and must be reported explicitly.
//
// Design decisions:
//
//   1. Guards are instantiated only when their config section is present.
//      Omitting a config key disables that primitive entirely — no silent
//      defaults that appear inactive but still run.
//
//   2. tool() is the single composable hook for all external tool calls.
//      It bundles loop guard + throttle in one call, keeping adoption simple
//      and preventing the misuse that separate checkLoop() / checkThrottle()
//      methods would invite (forgetting to call one, calling them twice, etc.).
//
//   3. EnforcementHalt is a typed error, not a raw throw. Its .enforcement
//      property carries the full structured HaltResult so callers never need
//      to parse error messages.
//
//   4. mode: "warn" is stubbed in V1. The config option is accepted and stored
//      so existing configs won't break when warn mode is implemented.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuthorityConfig, HaltResult, GuardResult, EnforcementMode } from "./types";
import { BudgetGuard } from "./enforcement/budgetGuard";
import { LoopGuard } from "./enforcement/loopGuard";
import { ToolThrottle } from "./enforcement/toolThrottle";
import { HashChain } from "./integrity/hashChain";
import { EnforcementHalt } from "./EnforcementHalt";

export class AuthorityLayer {
    private readonly mode: EnforcementMode;
    private readonly budgetGuard?: BudgetGuard;
    private readonly loopGuard?: LoopGuard;
    private readonly toolThrottle?: ToolThrottle;
    private readonly chain: HashChain;

    constructor(config: AuthorityConfig) {
        this.mode = config.mode ?? "strict";
        this.chain = new HashChain();

        if (config.budget) {
            this.budgetGuard = new BudgetGuard(config.budget);
        }
        if (config.loopGuard) {
            this.loopGuard = new LoopGuard(config.loopGuard);
        }
        if (config.toolThrottle) {
            this.toolThrottle = new ToolThrottle(config.toolThrottle);
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    /**
     * Convert a guard's PendingHalt into a logged HaltResult, then either
     * throw an EnforcementHalt (strict) or emit a console warning (warn/stub).
     */
    private enforce(
        result: GuardResult,
        context?: Record<string, unknown>
    ): void {
        if (result.status !== "halted") return;

        const event = this.chain.append("enforcement.halt", {
            reason: result.reason,
            limit: result.limit,
            spent: result.spent,
            ...context,
        });

        const haltResult: HaltResult = {
            status: "halted",
            reason: result.reason,
            limit: result.limit,
            spent: result.spent,
            event_id: event.event_id,
        };

        if (this.mode === "strict") {
            throw new EnforcementHalt(haltResult);
        } else {
            // V1 stub: warn mode is accepted in config but not yet implemented.
            // In a future release this will emit a structured warning and continue.
            console.warn("[AuthorityLayer] WARN (warn mode stub):", haltResult);
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    /**
     * Wrap an agent run with enforcement.
     *
     * - Resets per-run counters (loop guard).
     * - Logs run.start and run.complete events to the chain.
     * - Re-throws EnforcementHalt cleanly; logs unexpected errors to the chain
     *   before re-throwing so they appear in the audit log.
     *
     * @example
     * await authority.wrap(async () => {
     *   const result = await authority.tool("openai.chat", () => openai.chat(...));
     *   authority.recordSpend(result.usage.cost);
     * });
     */
    async wrap(fn: () => Promise<void>): Promise<void> {
        // Per-run reset
        this.loopGuard?.reset();

        this.chain.append("run.start", { timestamp: new Date().toISOString() });

        try {
            await fn();
            this.chain.append("run.complete", { timestamp: new Date().toISOString() });
        } catch (err) {
            if (err instanceof EnforcementHalt) {
                // Already logged by enforce() — just propagate.
                throw err;
            }

            // Unexpected error — log it to the chain for auditability, then rethrow.
            this.chain.append("run.error", {
                message: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }
    }

    /**
     * Wrap a single tool call with loop guard and throttle enforcement.
     *
     * This is the sole mechanism for calling external tools within wrap().
     * Both guards are checked before the tool function executes — the tool
     * function is never called if a limit has already been breached.
     *
     * @param name   Human-readable tool name, logged to the event chain.
     * @param fn     Async function that performs the actual tool call.
     * @returns      The resolved return value of fn().
     *
     * @example
     * const data = await authority.tool("stripe.charge", () =>
     *   stripe.charges.create({ amount: 100, currency: "usd" })
     * );
     */
    async tool<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const ctx = { tool: name };

        if (this.loopGuard) {
            this.enforce(this.loopGuard.tick(), ctx);
        }

        if (this.toolThrottle) {
            this.enforce(this.toolThrottle.tick(), ctx);
        }

        this.chain.append("tool.call", { name });

        return fn();
    }

    /**
     * Report token or API spend in USD.
     *
     * Call this after each model or billable API call. AuthorityLayer does not
     * intercept pricing automatically — different providers expose cost
     * differently, so the host is responsible for calculating the USD amount.
     *
     * @example
     * const response = await openai.chat.completions.create({ ... });
     * const costUSD = response.usage.total_tokens * PRICE_PER_TOKEN;
     * authority.recordSpend(costUSD);
     */
    recordSpend(amountUSD: number): void {
        if (!this.budgetGuard) return;
        this.enforce(this.budgetGuard.record(amountUSD));
    }

    // ── Audit / integrity ───────────────────────────────────────────────────────

    /**
     * Return a read-only copy of the enforcement event chain.
     * Useful for inspecting what happened during a run or persisting to disk.
     */
    getChain() {
        return this.chain.getChain();
    }

    /**
     * Verify the integrity of the in-memory event chain.
     * Returns false if any event has been tampered with.
     */
    verifyChain(): boolean {
        return this.chain.verify();
    }
}
