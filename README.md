# AuthorityLayer

[![RepoScore](https://repoforge.dev/badge/repoforge-dev/authority-layer)](https://repoforge.dev/repos/repoforge-dev/authority-layer)

AuthorityLayer provides runtime guardrails for AI agents that enforce token budgets, loop limits, and tool rate limits locally.

## What This Project Does

AuthorityLayer gives developers a small runtime control layer for autonomous or tool-using agents. It wraps an execution loop, records spend, throttles tools, and throws a typed halt when a run crosses an explicit boundary.

The library is intended for developers building internal agent runtimes, automation tools, or LLM-backed services that need hard controls instead of after-the-fact observability. If a run should stop after a budget threshold, after too many tool calls, or after a rate cap is exceeded, AuthorityLayer enforces that behavior directly in code.

## Why It Exists

Most agent failures are operational before they are theoretical. A tool loop keeps retrying. A model call path burns more budget than intended. A workflow keeps calling an external system because nothing inside the runtime says stop. Dashboards can describe the failure after it happened, but they do not prevent it.

AuthorityLayer exists to make those controls explicit and local. It treats budgets, loop guards, and tool throttles as runtime invariants. That keeps the package small, reviewable, and practical for teams that want AI runtime controls without adopting a full orchestration platform.

## Quickstart

```bash
npm install authority-layer
npx authority-layer doctor
```

If the doctor command passes, create an `AuthorityLayer` instance and wrap the part of your runtime that must stay within budget and call limits.

## Example

```typescript
import { AuthorityLayer, EnforcementHalt } from "authority-layer";

const authority = new AuthorityLayer({
  budget: { dailyUSD: 25 },
  loopGuard: { maxToolCallsPerRun: 12 },
  toolThrottle: { maxCallsPerMinute: 30 },
});

try {
  await authority.wrap(async () => {
    const result = await authority.tool("llm.chat", () => callModel(prompt));
    authority.recordSpend(calculateCostUSD(result));
  });
} catch (error) {
  if (error instanceof EnforcementHalt) {
    console.error(error.enforcement);
  }
}
```

Run the bundled demo with:

```bash
npm run example
```

## Configuration

AuthorityLayer exposes three control surfaces:

- `budget`: stop a run after a spend threshold
- `loopGuard`: stop repeated tool execution inside one run
- `toolThrottle`: enforce per-minute tool call limits

Configuration details are documented in [docs/configuration.md](./docs/configuration.md), and the runtime API is documented in [docs/api.md](./docs/api.md).

## How It Works

The repository is organized as a workspace so the published package, examples, and contributor docs stay close together.

- `packages/core/src/` contains the published runtime implementation, CLI entrypoint, enforcement primitives, integrity helpers, and exported types.
- `examples/` contains runnable demonstrations for local verification.
- `docs/` contains API, configuration, enforcement, and architecture notes.
- `tests/` contains workspace smoke tests.
- `src/` is a contributor-facing source map that points developers to the published implementation.

Each runtime control is opt-in. If a config block is omitted, that control is not instantiated. When a configured boundary is breached, AuthorityLayer throws `EnforcementHalt` with structured enforcement data instead of relying on log parsing.

## Use Cases

- Stop an internal agent after a daily spend budget is exhausted.
- Prevent a tool-using workflow from entering an unbounded retry loop.
- Enforce a maximum number of external tool calls per run.
- Rate-limit calls to a provider or internal service from an autonomous workflow.
- Add fail-closed controls to a prototype agent before exposing it to users.
- Demonstrate runtime guardrail behavior in a reproducible example or CI pipeline.

## Installation

For package consumers:

```bash
npm install authority-layer
```

For contributors:

```bash
git clone https://github.com/repoforge-dev/authority-layer.git
cd authority-layer
npm install
npm test
npm run -w authority-layer build
npm run -w authority-layer typecheck
```

## RepoScore

Badge:

```md
[![RepoScore](https://repoforge.dev/badge/repoforge-dev/authority-layer)](https://repoforge.dev/repos/repoforge-dev/authority-layer)
```

Analysis page:

[https://repoforge.dev/repos/repoforge-dev/authority-layer](https://repoforge.dev/repos/repoforge-dev/authority-layer)

## Contributing

Changes should keep the runtime surface explicit and easy to review. Favor typed interfaces, deterministic halt behavior, and examples that show enforcement behavior clearly.

Start with [CONTRIBUTING.md](./CONTRIBUTING.md). Supporting documentation lives in [docs/api.md](./docs/api.md), [docs/configuration.md](./docs/configuration.md), [docs/enforcement.md](./docs/enforcement.md), and [docs/architecture.md](./docs/architecture.md).

## License

MIT. See [LICENSE](./LICENSE).
