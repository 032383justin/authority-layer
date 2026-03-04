# AuthorityLayer

Hard execution and budget limits for autonomous agents — enforced locally.

AuthorityLayer prevents runaway spend, infinite tool loops, and uncontrolled external calls in agentic systems. It enforces strict boundaries inside your runtime and halts execution safely when limits are breached.

No telemetry.  
No cloud dependency.  
Fail-closed by default.

---

## Why AuthorityLayer Exists

Autonomous agents introduce a new risk surface:

- Unbounded token spend  
- Infinite tool loops  
- Retry storms  
- Cascading API calls  
- Silent cost explosions  

Most systems rely on warnings or provider-level quotas.

AuthorityLayer enforces hard limits directly in your execution loop.

When a boundary is crossed, execution stops.

---

## Core Guarantees

- Local-first enforcement (works offline)
- Fail-closed by default
- Structured halts (never crashes the process)
- Tamper-evident hash-linked event chain
- Zero outbound calls unless explicitly configured

---

## Installation

```bash
npm install authority-layer
```
