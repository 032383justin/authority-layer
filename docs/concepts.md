# Concepts

← [Back to README](../README.md)

---

## The Problem

Autonomous agents introduce a risk surface that traditional applications don't have:

- **Unbounded token spend** — a looping agent can burn thousands of dollars before you notice
- **Infinite tool loops** — agents can get stuck calling the same tool repeatedly
- **Retry storms** — failed API calls retried indefinitely with no ceiling
- **Cascading API calls** — one agent spawns sub-calls, which spawn more
- **Silent cost explosions** — spend accumulates across runs with no enforced ceiling

Most systems rely on warnings, dashboard alerts, or provider-level quotas — all of which react *after* the damage is done.

AuthorityLayer enforces hard limits directly in your execution loop. When a boundary is crossed, execution stops immediately.

---

## How AuthorityLayer Works

AuthorityLayer is a local enforcement SDK. It sits inside your agent's execution loop and monitors for limit breaches in real time. There is no cloud component, no telemetry, and no external dependency.

Everything runs in-process.

You wrap your agent run in `authority.wrap()` and route all external tool calls through `authority.tool()`. That's the entire integration surface. AuthorityLayer checks limits on each call and halts execution before any tool function runs if a limit has already been breached.

---

## Local-First Enforcement

Enforcement happens entirely inside the Node.js process. AuthorityLayer never makes outbound network requests unless you explicitly wire it up to an alert destination yourself. It functions fully offline.

This is intentional. Adding a network dependency to enforcement creates a class of failure modes where the enforcement layer itself becomes unavailable — exactly what a safety primitive must never do.

---

## Fail-Closed by Default

When a limit is breached in `strict` mode, AuthorityLayer throws an `EnforcementHalt` and execution stops. There are no warning-only defaults. An unacknowledged breach is never silently ignored.

This is the fail-closed posture: the system defaults to halting rather than continuing.

---

## Structured Halts

AuthorityLayer never crashes the host process with an unexpected error. All enforcement results are structured objects of type `HaltResult`:

```typescript
{
  status: "halted",
  reason: "budget_exceeded",
  limit: 50,
  spent: 52.14,
  event_id: "evt_3f9a2c1b..."
}
```

Access this via `err.enforcement` on the caught `EnforcementHalt`. Do not parse the error message string — it is for human readability only and is not stable API.

---

## Mode: strict vs warn

`mode: "strict"` (default) — limits halt execution immediately via `EnforcementHalt`.

`mode: "warn"` — limits emit a warning to `console.warn` and allow execution to continue. **Note: warn mode is stubbed in V1.** The config option is accepted without error so you can prepare your config for future releases, but the behavior in V1 is equivalent to a console warning with no halt suppression.

---

## What AuthorityLayer Is Not

- Not a governance platform
- Not an observability suite
- Not a FinOps analytics tool
- Not a workflow orchestrator

It is a primitive. It enforces boundaries. Nothing more.
