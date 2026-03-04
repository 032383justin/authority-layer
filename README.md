# AuthorityLayer

[![CI](https://github.com/032383justin/authority-layer/actions/workflows/ci.yml/badge.svg)](https://github.com/032383justin/authority-layer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/authority-layer?color=blue)](https://www.npmjs.com/package/authority-layer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Hard execution and budget limits for autonomous agents — enforced locally.

- No telemetry
- Works fully offline
- Fail-closed by default
- Zero runtime dependencies

---

## Live Enforcement Demo

![AuthorityLayer enforcement demo](./docs/assets/enforcement-demo.gif)

---

## Quick Start

```bash
npm install authority-layer
```

Verify the install:

```bash
npx authority-layer doctor
```

```
AuthorityLayer Doctor  authority-layer@0.1.1

  ✔  Node.js version >= 18                  pass
  ✔  crypto module (sha256)                 pass
  ✔  AUTHORITY_LAYER_DISABLE not set        pass
  ✔  core module loads offline              pass
  ✔  AuthorityLayer instantiates            pass

All checks passed. AuthorityLayer is ready.
```

---

## Minimal Integration

```typescript
import { AuthorityLayer, EnforcementHalt } from "authority-layer";

const authority = new AuthorityLayer({
  budget:       { dailyUSD: 50 },           // Hard USD spend cap
  loopGuard:    { maxToolCallsPerRun: 25 }, // Max tool calls per run
  toolThrottle: { maxCallsPerMinute: 60 },  // Sliding-window rate cap
});

try {
  await authority.wrap(async () => {
    const result = await authority.tool("llm.chat", () =>
      callYourModel(prompt)
    );
    authority.recordSpend(calculateCostUSD(result));
  });
} catch (err) {
  if (err instanceof EnforcementHalt) {
    console.error(err.enforcement);
    // { status: "halted", reason: "budget_exceeded", limit: 50, spent: 52.14, event_id: "evt_..." }
  }
}
```

---

## Enforcement Primitives

Three composable primitives. Each is independently opt-in — omit a config key to disable it entirely.

| Primitive | Config key | What it enforces |
|-----------|------------|------------------|
| **Budget cap** | `budget.dailyUSD` | Cumulative USD spend across the process lifetime. Halts when spend exceeds the cap. → [docs](./docs/enforcement.md#1-budget-cap) |
| **Loop guard** | `loopGuard.maxToolCallsPerRun` | Total tool calls per `wrap()` invocation. Counter resets each run. → [docs](./docs/enforcement.md#2-loop-guard) |
| **Tool throttle** | `toolThrottle.maxCallsPerMinute` | Rate of tool calls using a sliding 60-second window — no fixed buckets. → [docs](./docs/enforcement.md#3-tool-throttle) |

When a primitive breaches, AuthorityLayer throws a typed `EnforcementHalt` error with a structured `.enforcement` object. Execution never crashes silently.

---

## Documentation

| Topic | File |
|-------|------|
| Concepts & philosophy | [docs/concepts.md](./docs/concepts.md) |
| Enforcement primitives (full detail) | [docs/enforcement.md](./docs/enforcement.md) |
| API reference | [docs/api.md](./docs/api.md) |
| Integrity chain | [docs/integrity.md](./docs/integrity.md) |
| Live example | `npm run example` |

---

## License

MIT © 2025 AuthorityLayer Contributors

[GitHub](https://github.com/032383justin/authority-layer) · [npm](https://www.npmjs.com/package/authority-layer) · [Issues](https://github.com/032383justin/authority-layer/issues)
