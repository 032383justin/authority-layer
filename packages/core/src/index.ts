// Public surface of the authority-layer package.
// Import from here, not from internal module paths.

export { AuthorityLayer } from "./AuthorityLayer";
export { EnforcementHalt } from "./EnforcementHalt";

export type {
    AuthorityConfig,
    BudgetConfig,
    LoopGuardConfig,
    ToolThrottleConfig,
    EnforcementMode,
    HaltResult,
    HaltReason,
    PassResult,
    GuardResult,
    EnforcementEvent,
} from "./types";
