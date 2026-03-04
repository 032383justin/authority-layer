# API Reference

← [Back to README](../README.md)

---

## `new AuthorityLayer(config)`

The single entry point. Instantiate once and reuse across runs.

```typescript
import { AuthorityLayer } from "authority-layer";

const authority = new AuthorityLayer({
  mode?:         "strict" | "warn",  // Default: "strict"
  budget?:       { dailyUSD: number },
  loopGuard?:    { maxToolCallsPerRun: number },
  toolThrottle?: { maxCallsPerMinute: number },
});
```

### `AuthorityConfig`

```typescript
interface AuthorityConfig {
  /**
   * Enforcement mode. Defaults to "strict".
   * "warn" is stubbed in V1 — accepted but not yet fully implemented.
   */
  mode?: "strict" | "warn";

  /** Hard USD spend cap. Omit to disable. */
  budget?: { dailyUSD: number };

  /** Max tool calls per wrap() invocation. Omit to disable. */
  loopGuard?: { maxToolCallsPerRun: number };

  /** Max tool calls per 60-second sliding window. Omit to disable. */
  toolThrottle?: { maxCallsPerMinute: number };
}
```

| Mode | Behavior |
|------|----------|
| `"strict"` | Throws `EnforcementHalt` immediately when a limit is breached (default) |
| `"warn"` | Emits `console.warn` — **stubbed in V1**, full implementation planned |

Omitting a config key fully disables that primitive. No hidden guards run.

---

## `authority.wrap(fn)`

Wraps an agent run with enforcement.

- Resets the loop guard counter at the start of each invocation.
- Logs `run.start` and `run.complete` events to the audit chain.
- Re-throws `EnforcementHalt` cleanly.
- Logs unexpected errors to the chain as `run.error` before re-throwing.

```typescript
await authority.wrap(async () => {
  // your agent loop
});
```

**Signature:**

```typescript
wrap(fn: () => Promise<void>): Promise<void>
```

---

## `authority.tool(name, fn)`

The single hook for all external tool calls. Checks loop guard and throttle *before* calling `fn`. If either limit is breached, `fn` is never invoked.

```typescript
const data = await authority.tool("stripe.charge", () =>
  stripe.charges.create({ amount: 100, currency: "usd" })
);
```

**Signature:**

```typescript
tool<T>(name: string, fn: () => Promise<T>): Promise<T>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Human-readable label logged to the event chain |
| `fn` | `() => Promise<T>` | The actual tool call — never called if a limit is breached |

---

## `authority.recordSpend(amountUSD)`

Report token or API spend in USD. Accumulates across all calls in the current process lifetime (not per-run). Call this after each model or billable API response.

```typescript
const response = await authority.tool("openai.chat", () =>
  openai.chat.completions.create({ model: "gpt-4o", messages })
);
const costUSD = response.usage.total_tokens * PRICE_PER_TOKEN;
authority.recordSpend(costUSD);
```

**Signature:**

```typescript
recordSpend(amountUSD: number): void
```

If no `budget` config is set, this is a no-op.

---

## `authority.getChain()`

Returns a read-only snapshot of the in-memory enforcement event chain. Useful for inspecting what happened during a run, persisting to disk, or debugging.

```typescript
const events = authority.getChain();
// ReadonlyArray<EnforcementEvent>
```

**Signature:**

```typescript
getChain(): ReadonlyArray<EnforcementEvent>
```

See [docs/integrity.md](./integrity.md) for the full `EnforcementEvent` type and chain semantics.

---

## `authority.verifyChain()`

Verifies the integrity of the in-memory event chain. Returns `false` if any event has been tampered with, reordered, or removed.

```typescript
const intact = authority.verifyChain(); // true | false
```

**Signature:**

```typescript
verifyChain(): boolean
```

---

## `EnforcementHalt`

A typed error thrown when any enforcement primitive breaches in `strict` mode. Never catch by message — always use `instanceof` and access `.enforcement`.

```typescript
import { EnforcementHalt } from "authority-layer";

try {
  await authority.wrap(async () => { /* ... */ });
} catch (err) {
  if (err instanceof EnforcementHalt) {
    console.error(err.enforcement);
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `enforcement` | `HaltResult` | Structured halt details |
| `message` | `string` | Human-readable string — not stable API, do not parse |

---

## `HaltResult`

The structured object attached to every `EnforcementHalt` at `err.enforcement`.

```typescript
interface HaltResult {
  status:   "halted";
  reason:   "budget_exceeded" | "loop_limit_exceeded" | "tool_throttle_exceeded";
  limit:    number;   // The configured limit that was breached
  spent:    number;   // The value that exceeded it (USD, call count, etc.)
  event_id: string;   // Unique ID from the enforcement event chain
}
```

**Example:**

```typescript
{
  status:   "halted",
  reason:   "budget_exceeded",
  limit:    50,
  spent:    52.14,
  event_id: "evt_3f9a2c1b7d9e..."
}
```

---

## `EnforcementEvent`

Each entry in the audit chain. Access via `authority.getChain()`.

```typescript
interface EnforcementEvent {
  event_id:     string;                    // "evt_<random hex>"
  type:         string;                    // "run.start" | "tool.call" | "enforcement.halt" | ...
  timestamp:    string;                    // ISO-8601
  data:         Record<string, unknown>;   // Event-specific payload
  hash:         string;                    // SHA-256 of this event + previousHash
  previousHash: string;                    // Hash of the preceding event ("genesis" for first)
}
```

See [docs/integrity.md](./integrity.md) for full chain documentation.
