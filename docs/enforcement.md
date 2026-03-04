# Enforcement Primitives

AuthorityLayer V1 implements exactly three enforcement primitives.

---

## 1. Budget Cap

**Config key:** `budget.dailyUSD`

Tracks cumulative USD spend across a run. Halts execution when the total exceeds the configured cap.

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

`recordSpend()` is cumulative. It accumulates across all calls within the current process lifetime (not per-run).

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

Rate-limits tool calls using a sliding 60-second window. Unlike a fixed-bucket approach, this always reflects the true call density in the last minute.

### Configuration

```typescript
const authority = new AuthorityLayer({
  toolThrottle: { maxCallsPerMinute: 10 },
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

## The HaltResult Object

When any guard breaches, execution halts and an `EnforcementHalt` error is thrown. The structured halt object is available at `err.enforcement`:

```typescript
interface HaltResult {
  status: "halted";
  reason: "budget_exceeded" | "loop_limit_exceeded" | "tool_throttle_exceeded";
  limit: number;   // The configured limit that was breached
  spent: number;   // The value that exceeded it (USD, call count, etc.)
  event_id: string; // Unique ID from the enforcement event chain
}
```

### Catching a Halt

```typescript
import { AuthorityLayer, EnforcementHalt } from "authority-layer";

try {
  await authority.wrap(async () => {
    // ... agent loop
  });
} catch (err) {
  if (err instanceof EnforcementHalt) {
    // Access structured object — do not parse err.message
    console.log(err.enforcement);
    // { status: "halted", reason: "budget_exceeded", limit: 50, spent: 52.14, event_id: "evt_..." }
  }
}
```

---

## Integration Pattern

All three primitives are enforced through two points of contact:

| Call | Enforces |
|---|---|
| `authority.wrap(fn)` | Resets loop counter; wraps run lifecycle |
| `authority.tool(name, fn)` | Loop guard + tool throttle before fn executes |
| `authority.recordSpend(usd)` | Budget cap check after you calculate cost |

### Minimal Integration

```typescript
import { AuthorityLayer, EnforcementHalt } from "authority-layer";

const authority = new AuthorityLayer({
  budget: { dailyUSD: 50 },
  loopGuard: { maxToolCallsPerRun: 25 },
  toolThrottle: { maxCallsPerMinute: 10 },
});

try {
  await authority.wrap(async () => {
    const result = await authority.tool("llm.chat", () =>
      callYourModel(prompt)
    );
    authority.recordSpend(calculateCost(result));
  });
} catch (err) {
  if (err instanceof EnforcementHalt) {
    console.error("Halted:", err.enforcement);
  }
}
```

### Omitting a Primitive

Any primitive can be disabled by omitting its config key. Unused guards are never instantiated.

```typescript
// Only loop guard — no budget or throttle
const authority = new AuthorityLayer({
  loopGuard: { maxToolCallsPerRun: 10 },
});
```

---

## Audit Chain

After any run, inspect what happened:

```typescript
const events = authority.getChain();
// ReadonlyArray<EnforcementEvent>

const intact = authority.verifyChain();
// true if no events have been tampered with
```

Each event includes `event_id`, `type`, `timestamp`, `data`, `hash`, and `previousHash`.
