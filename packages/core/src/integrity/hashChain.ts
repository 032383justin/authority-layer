// ─────────────────────────────────────────────────────────────────────────────
// HashChain — Tamper-Evident Enforcement Event Log
//
// Stores enforcement events in memory as a hash-linked chain. Each event
// includes a SHA-256 hash chained to the previous event's hash, making it
// detectable if any event is retroactively altered or removed.
//
// V1: in-memory only. No disk persistence or cloud anchoring.
// Future: optional disk flush and independent cloud anchor.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from "crypto";
import type { EnforcementEvent } from "../types";

/** Sentinel value used as the previousHash for the first event in the chain. */
const GENESIS_HASH = "genesis";

export class HashChain {
    private readonly chain: EnforcementEvent[] = [];
    private previousHash: string = GENESIS_HASH;

    /**
     * Append a new event to the chain.
     *
     * The hash covers the serialized event fields (event_id, type, timestamp,
     * data) concatenated with the previous event's hash. This means you cannot
     * alter any event — or its position in the chain — without invalidating all
     * subsequent hashes.
     */
    append(type: string, data: Record<string, unknown>): EnforcementEvent {
        const event_id = `evt_${randomBytes(8).toString("hex")}`;
        const timestamp = new Date().toISOString();

        // Hash covers content + chain position (previousHash)
        const payload = JSON.stringify({ event_id, type, timestamp, data });
        const hash = createHash("sha256")
            .update(payload + this.previousHash)
            .digest("hex");

        const event: EnforcementEvent = {
            event_id,
            type,
            timestamp,
            data,
            hash,
            previousHash: this.previousHash,
        };

        this.chain.push(event);
        this.previousHash = hash;

        return event;
    }

    /**
     * Return an immutable copy of the full event chain.
     */
    getChain(): ReadonlyArray<EnforcementEvent> {
        return Object.freeze([...this.chain]);
    }

    /**
     * Verify the integrity of the entire chain locally.
     *
     * Re-derives each event's hash from its fields and previousHash, then
     * compares against the stored hash. Returns false if any event has been
     * tampered with or if the linkage is broken.
     */
    verify(): boolean {
        let prev = GENESIS_HASH;

        for (const event of this.chain) {
            if (event.previousHash !== prev) {
                return false;
            }

            const payload = JSON.stringify({
                event_id: event.event_id,
                type: event.type,
                timestamp: event.timestamp,
                data: event.data,
            });

            const expected = createHash("sha256")
                .update(payload + prev)
                .digest("hex");

            if (expected !== event.hash) {
                return false;
            }

            prev = event.hash;
        }

        return true;
    }
}
