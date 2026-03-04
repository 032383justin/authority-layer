// ─────────────────────────────────────────────────────────────────────────────
// EnforcementHalt — Typed Enforcement Error
//
// Thrown by AuthorityLayer in strict mode when a guard limit is breached.
//
// IMPORTANT: always access halt details via the `.enforcement` property,
// not by parsing the error message. The structured object is stable API;
// the message string is not.
//
// @example
// try {
//   await authority.wrap(async () => { ... });
// } catch (err) {
//   if (err instanceof EnforcementHalt) {
//     console.log(err.enforcement);
//     // { status: "halted", reason: "budget_exceeded", limit: 50, spent: 52.14, event_id: "evt_..." }
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────

import type { HaltResult } from "./types";

export class EnforcementHalt extends Error {
    /**
     * The full, structured enforcement result.
     * This is the canonical way to inspect why execution was halted.
     */
    readonly enforcement: HaltResult;

    constructor(result: HaltResult) {
        super(
            `[AuthorityLayer] Execution halted — ${result.reason} ` +
            `(limit: ${result.limit}, spent: ${result.spent}, event: ${result.event_id})`
        );
        this.name = "EnforcementHalt";
        this.enforcement = result;

        // Restore prototype chain for instanceof checks across transpilation targets
        Object.setPrototypeOf(this, EnforcementHalt.prototype);
    }
}
