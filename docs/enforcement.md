# Enforcement Primitives

← [Back to README](../README.md)

AuthorityLayer V1 implements exactly three enforcement primitives. Each is independently opt-in — omit a config key to disable that primitive entirely. Unused guards are never instantiated.

---

## 1. Budget Cap

**Config key:** `budget.dailyUSD`

Tracks cumulative USD spend across the lifetime of the process. Halts when the total exceeds the configured cap.

### Configuration

```typescript
const authority = new AuthorityLayer({
  budget: { dailyUSD: 50 },
});
```

### Reporting Spend

Spend must be reported explicitly by the host. AuthorityLayer does not know how your model provider prices tokens — you calculate the USD cost and report it:

```typescript
const response = await authority.tool("openai.chat", () =>
  openai.chat.completions.create({ model: "gpt-4o", messages })
);

// Calculate cost from token counts (provider-specific)
const costUSD = response.usage.total_tokens * PRICE_PER_TOKEN;
authority.recordSpend(costUSD);
```

`recordSpend()` is cumulative. It accumulates across all calls within the current process lifetime — not per `wrap()` run.

> **Why explicit spend reporting?** Different providers expose token counts and pricing differently. AuthorityLayer doesn't assume your pricing model — you calculate the USD cost and report it. This makes the integration provider-agnostic.

### Halt Reason

`"budget_exceeded"`

---

## 2. Loop Guard

**Config key:** `loopGuard.maxToolCallsPerRun`

Limits the total number of tool calls within a single `wrap()` invocation. The counter resets at the start of each `wrap()` call, so limits are per-run.

### Configuration

```typescript
const authority = new AuthorityLayer({
  loopGuard: { maxToolCallsPerRun: 25 },
});
```

### How It Counts

Every call to `authority.tool()` increments the counter by one, before the tool function executes. If the counter exceeds the limit, the tool function is never called.

### Halt Reason

`"loop_limit_exceeded"`

---

## 3. Tool Throttle

**Config key:** `toolThrottle.maxCallsPerMinute`

Rate-limits tool calls using a **sliding 60-second window** — not a fixed reset bucket. This always reflects the true call density in the last minute, and prevents bursts at bucket boundaries.

### Configuration

```typescript
const authority = new AuthorityLayer({
  toolThrottle: { maxCallsPerMinute: 60 },
});
```

### How It Works

The throttle maintains a list of call timestamps. On each `authority.tool()` call:

1. Timestamps older than 60 seconds are evicted.
2. The current timestamp is added.
3. If the resulting count exceeds `maxCallsPerMinute`, execution halts.

No fixed reset buckets. No sudden bursts allowed at bucket boundaries.

### Halt Reason

`"tool_throttle_exceeded"`

---

## Halt Scenarios

When any guard breaches, AuthorityLayer throws an `EnforcementHalt` error. The structured halt object is available at `err.enforcement`:

```typescript
import { AuthorityLayer, EnforcementHalt } from "authority-layer";

try {
  await authority.wrap(async () => {
    // ... agent loop
  });
} catch (err) {
  if (err instanceof EnforcementHalt) {
    // Always access via err.enforcement — never parse err.message
    const { reason, limit, spent, event_id } = err.enforcement;
    console.error(`Halted: ${reason} (${spent} > ${limit}) [${event_id}]`);
    // e.g. "Halted: budget_exceeded (52.14 > 50) [evt_3f9a2c1b...]"
  }
}
```

See [docs/api.md](./api.md#enforcementhalt) for the full `HaltResult` type definition.

---

## Integration Pattern

All three primitives flow through two points of contact:

| Call | Enforces |
|------|----------|
| `authority.wrap(fn)` | Resets loop counter; wraps run lifecycle |
| `authority.tool(name, fn)` | Loop guard + tool throttle before `fn` executes |
| `authority.recordSpend(usd)` | Budget cap check after you calculate cost |

### Omitting a Primitive

Any primitive can be disabled by omitting its config key:

```typescript
// Only loop guard — no budget or throttle
const authority = new AuthorityLayer({
  loopGuard: { maxToolCallsPerRun: 10 },
});
```
