// ─────────────────────────────────────────────────────────────────────────────
// ToolThrottle — Sliding-Window Rate Limiter
//
// Caps the number of tool calls within any 60-second window using a sliding
// timestamp array. Unlike a fixed-bucket approach, this never resets abruptly
// mid-window — it always reflects the true call density in the last minute.
// ─────────────────────────────────────────────────────────────────────────────

import type { ToolThrottleConfig, GuardResult } from "../types";

const WINDOW_MS = 60_000; // 1-minute sliding window

export class ToolThrottle {
    /**
     * Stores the timestamp (ms since epoch) of each tool call inside the
     * current sliding window. Entries older than WINDOW_MS are pruned on
     * every tick so the array never grows unbounded.
     */
    private callTimestamps: number[] = [];
    private readonly limit: number;

    constructor(config: ToolThrottleConfig) {
        this.limit = config.maxCallsPerMinute;
    }

    /**
     * Record a tool call and check the rate against the configured limit.
     * Returns a PendingHalt if the call count in the last 60 seconds exceeds
     * maxCallsPerMinute.
     */
    tick(): GuardResult {
        const now = Date.now();

        // Evict calls that have slid out of the window
        this.callTimestamps = this.callTimestamps.filter(
            (t) => now - t < WINDOW_MS
        );

        this.callTimestamps.push(now);
        const callsInWindow = this.callTimestamps.length;

        if (callsInWindow > this.limit) {
            return {
                status: "halted",
                reason: "tool_throttle_exceeded",
                limit: this.limit,
                spent: callsInWindow,
            };
        }

        return { status: "ok" };
    }

    /** Returns the number of calls recorded in the current window (for diagnostics). */
    getWindowCount(): number {
        const now = Date.now();
        return this.callTimestamps.filter((t) => now - t < WINDOW_MS).length;
    }
}
