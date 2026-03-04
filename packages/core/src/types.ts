// ─────────────────────────────────────────────────────────────────────────────
// AuthorityLayer — Shared Types
//
// All interfaces used across enforcement primitives and the core class live
// here. Keeping them in one file makes cross-module consistency easy to audit.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enforcement mode.
 *   "strict" — limits halt execution immediately (default, V1 implemented)
 *   "warn"   — limits emit a warning but allow continuation (V1 stubbed)
 */
export type EnforcementMode = "strict" | "warn";

// ── Per-primitive configuration ───────────────────────────────────────────────

export interface BudgetConfig {
  /** Hard daily spend cap in USD. Execution halts if cumulative spend exceeds this. */
  dailyUSD: number;
}

export interface LoopGuardConfig {
  /** Maximum number of tool calls allowed per wrap() invocation. */
  maxToolCallsPerRun: number;
}

export interface ToolThrottleConfig {
  /** Maximum number of tool calls allowed within any 60-second sliding window. */
  maxCallsPerMinute: number;
}

// ── Top-level config ──────────────────────────────────────────────────────────

export interface AuthorityConfig {
  /**
   * Enforcement mode. Defaults to "strict".
   * In V1, only "strict" is fully implemented. "warn" is stubbed.
   */
  mode?: EnforcementMode;

  /** Enable hard USD budget cap. Omit to disable. */
  budget?: BudgetConfig;

  /** Enable loop/call-count guard per run. Omit to disable. */
  loopGuard?: LoopGuardConfig;

  /** Enable tool call rate throttle. Omit to disable. */
  toolThrottle?: ToolThrottleConfig;
}

// ── Guard result types ────────────────────────────────────────────────────────

export type HaltReason =
  | "budget_exceeded"
  | "loop_limit_exceeded"
  | "tool_throttle_exceeded";

/**
 * Internal guard result before the event chain assigns an event_id.
 * Guards return this; AuthorityLayer promotes it to HaltResult after logging.
 */
export interface PendingHalt {
  status: "halted";
  reason: HaltReason;
  /** The configured limit that was breached. */
  limit: number;
  /** The value that exceeded the limit (spend, call count, etc.). */
  spent: number;
}

/**
 * The public enforcement halt object. Returned on the EnforcementHalt error
 * and also accessible via .enforcement on that error instance.
 *
 * Always prefer accessing this via `error.enforcement` rather than parsing
 * the error message string.
 */
export interface HaltResult extends PendingHalt {
  /** Unique event ID assigned by the hash-linked event chain. */
  event_id: string;
}

export interface PassResult {
  status: "ok";
}

/** Union returned by all guard check methods. */
export type GuardResult = PendingHalt | PassResult;

// ── Integrity chain types ─────────────────────────────────────────────────────

/**
 * A single entry in the enforcement event chain.
 * Each event is hash-linked to its predecessor, forming a tamper-evident log.
 */
export interface EnforcementEvent {
  /** Unique identifier (evt_<random hex>). */
  event_id: string;
  /** Semantic event type, e.g. "enforcement.halt", "tool.call", "run.start". */
  type: string;
  /** ISO-8601 timestamp of the event. */
  timestamp: string;
  /** Arbitrary structured data for this event. */
  data: Record<string, unknown>;
  /** SHA-256 of (serialized event fields + previousHash). */
  hash: string;
  /** Hash of the preceding event ("genesis" for the first event). */
  previousHash: string;
}
