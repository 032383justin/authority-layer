# Integrity Chain

← [Back to README](../README.md)

Every enforcement action in an agent run is logged to an in-memory hash-linked event chain. The chain provides a tamper-evident audit log of everything that happened during execution.

---

## Hash-Linked Event Chain

Each event is cryptographically linked to its predecessor via SHA-256. The chain works as follows:

1. The first event is initialized with `previousHash: "genesis"`.
2. Each subsequent event computes its `hash` as `SHA-256(serialized event fields + previousHash)`.
3. The resulting chain is tamper-evident — altering, reordering, or removing any event invalidates all subsequent hashes.

This structure means you can verify the integrity of the entire log with a single call:

```typescript
const intact = authority.verifyChain(); // true | false
```

If this returns `false`, at least one event in the chain has been modified since it was appended.

---

## Event Types

| Type | When it fires |
|------|---------------|
| `run.start` | At the beginning of each `authority.wrap()` call |
| `tool.call` | Each time `authority.tool()` is invoked |
| `enforcement.halt` | When any guard limit is breached |
| `run.complete` | When `wrap()` resolves without error |
| `run.error` | When an unexpected error (not `EnforcementHalt`) is thrown inside `wrap()` |

---

## Inspecting the Chain

```typescript
const events = authority.getChain();
// ReadonlyArray<EnforcementEvent>

for (const event of events) {
  console.log(`[${event.type}] ${event.event_id} @ ${event.timestamp}`);
}
```

Example output from a budget-exceeded run:

```
[run.start]        evt_a1b2c3d4... @ 2025-01-01T00:00:00.000Z
[tool.call]        evt_e5f6g7h8... @ 2025-01-01T00:00:00.012Z
[tool.call]        evt_i9j0k1l2... @ 2025-01-01T00:00:00.024Z
[tool.call]        evt_m3n4o5p6... @ 2025-01-01T00:00:00.036Z
[enforcement.halt] evt_q7r8s9t0... @ 2025-01-01T00:00:00.037Z
```

---

## `EnforcementEvent` Type

```typescript
interface EnforcementEvent {
  /** Unique identifier: "evt_<random hex>" */
  event_id: string;

  /** Semantic event type */
  type: string;

  /** ISO-8601 timestamp */
  timestamp: string;

  /** Arbitrary structured payload for this event type */
  data: Record<string, unknown>;

  /** SHA-256 of (event fields + previousHash) */
  hash: string;

  /** Hash of the preceding event, or "genesis" for the first event */
  previousHash: string;
}
```

---

## Chain Verification

```typescript
const intact = authority.verifyChain();

if (!intact) {
  console.error("Chain integrity failed — events may have been tampered with.");
}
```

Verification recomputes every hash in the chain from scratch and compares against the stored values. It runs in O(n) time where n is the number of events in the chain.

---

## Security Guarantees

| Property | Detail |
|----------|--------|
| **Tamper detection** | Any modification to any field of any event, or reordering/removal of events, is detectable via `verifyChain()` |
| **No external anchoring** | In V1, the chain lives in memory only — it is not written to disk or anchored remotely |
| **No network dependency** | Hashing uses Node.js's built-in `crypto` module (`sha256`) — no external requests |
| **Deterministic verification** | Given the same events, `verifyChain()` always produces the same result |

> **V1 note:** The chain is not persisted between process restarts. Persistence and remote anchoring are planned for a future release. If you need to retain the log, call `authority.getChain()` after the run and serialize it yourself.

---

## Example: Full Run with Chain Audit

```typescript
import { AuthorityLayer, EnforcementHalt } from "authority-layer";

const authority = new AuthorityLayer({
  budget: { dailyUSD: 0.05 },
  loopGuard: { maxToolCallsPerRun: 5 },
});

try {
  await authority.wrap(async () => {
    await authority.tool("step.one", () => doWork());
    authority.recordSpend(0.02);

    await authority.tool("step.two", () => doMoreWork());
    authority.recordSpend(0.02);

    // Third call — spend now at $0.04; this next recordSpend will breach $0.05
    await authority.tool("step.three", () => doFinalWork());
    authority.recordSpend(0.02); // → enforcement.halt fires here
  });
} catch (err) {
  if (err instanceof EnforcementHalt) {
    console.error("Halted:", err.enforcement.reason);
  }
}

// Audit the chain after the run
const events = authority.getChain();
console.log(`${events.length} events recorded`);
console.log(`Chain intact: ${authority.verifyChain()}`);
```
