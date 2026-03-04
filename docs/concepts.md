# Concepts

## How AuthorityLayer Works

AuthorityLayer is a local enforcement SDK. It sits inside your agent's execution loop and monitors for limit breaches in real time. There is no cloud component, no telemetry, and no external dependency.

Everything runs in-process.

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

## Hash-Linked Event Chain

Every enforcement event — run starts, tool calls, halts, errors — is appended to an in-memory hash-linked chain. Each event contains:

- A unique `event_id`
- A SHA-256 hash of its own content concatenated with the previous event's hash

The chain is tamper-evident: altering any event, reordering events, or removing events will invalidate all subsequent hashes. Verify locally with `authority.verifyChain()`.

In V1, the chain lives in memory only. It is not persisted to disk or anchored remotely. Access it with `authority.getChain()`.

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
