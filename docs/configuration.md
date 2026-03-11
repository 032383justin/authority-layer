# Configuration

AuthorityLayer exposes three runtime controls:

## Budget

Use `budget` to halt a run after a configured spend threshold.

```ts
budget: { dailyUSD: 25 }
```

## Loop Guard

Use `loopGuard` to stop repeated tool execution within a single run.

```ts
loopGuard: { maxToolCallsPerRun: 12 }
```

## Tool Throttle

Use `toolThrottle` to enforce per-minute limits for tool usage.

```ts
toolThrottle: { maxCallsPerMinute: 30 }
```

## Operational Notes

- Limits are opt-in and only apply when the corresponding configuration block is provided.
- `wrap()` defines the runtime boundary that is measured.
- `tool()` is the tracked execution path for tool calls and rate limits.
- `recordSpend()` applies explicit provider cost data to budget enforcement.
