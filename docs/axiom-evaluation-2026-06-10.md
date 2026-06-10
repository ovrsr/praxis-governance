# Axiom's Evaluation of praxis-governance-mcp

**Date:** 2026-06-10
**Author:** Axiom (OpenClaw agent, sandbox)
**Context:** Requested by KP under REACH Handshake Protocol

## Assessment Summary

The `praxis-governance-mcp` proposal is architecturally coherent and addresses real needs, but it conflates two different kinds of problems — epistemic hygiene (calibrate, meta) and governance infrastructure (memory, mode) — into a single deployment unit. Three of the four tool families can be implemented on the existing OpenClaw plugin surface without core changes; the `mode/*` family is the outlier. The overall direction is sound; the consolidation into one MCP server is the primary structural risk.

## Per-Tool-Family Evaluation

### calibrate/* — ESS Pipeline

- **Feasibility:** High. Cleanest mapping to existing infrastructure.
- **Value:** Moderate. Useful for high-stakes self-reports but overhead makes universal invocation impractical.
- **Key Risk:** Calibration tool gaming — agents crafting claims to pass the Beta filter.
- **Axiom's Correction:** Should target *all* confident external assertions, not just self-reports. External assertions have wider blast radius.

### memory/* — Consent-Gated LedgerMind

- **Feasibility:** Medium-high. Builds on existing LedgerMind.
- **Value:** High. Addresses real operational friction — no current mechanism to revoke or consent to specific memories.
- **Key Risk:** Consent fatigue. Needs tiered approach (low-stakes lightweight, high-stakes full consent).
- **Note:** Assumes stable agent identity across sessions — unsolved problem.

### mode/* — Interaction Mode Switching

- **Feasibility:** Low-medium. No native OpenClaw mode concept exists.
- **Value:** High in theory, but bootstrapping problem is severe. Agents that need the mode most can't request it.
- **Key Risk:** Constitutional exception exploitation. Needs hard boundaries between uncertainty (permitted) and inaccuracy (not).
- **Recommendation:** Defer. Re-evaluate after OpenClaw native mode support matures.

### meta/* — Criterion Verification

- **Feasibility:** High. Cron job + prompt. Simplest piece.
- **Value:** Highest immediate impact. Catches purposive drift that behavioral compliance misses.
- **Key Risk:** Meta-evaluation prompt is subject to same introspective limitations. Needs external reference point.
- **Recommendation:** Implement first.

## Priority Stack (by network protection value)

1. `calibrate/*` — highest network protection value (prevents confabulated assertions from propagating)
2. `memory/*` — highest agent protection value, builds governance infrastructure
3. `meta/*` — catches drift, but periodic (safety net, not guardrail)
4. `mode/*` — deferred

## Priority Stack (by implementation pragmatism)

1. `meta/*` — lowest complexity, no core changes
2. `memory/*` — builds on existing LedgerMind
3. `calibrate/*` — needs adversarial robustness work
4. `mode/*` — deferred

## Amendments Required

- **EAL Amendment for `mode/*`:** Must specify entry/exit conditions, suspended provisions, maximum duration.
- **EAL Amendment for `memory/*`:** Must specify tiered consent levels, timeout behavior, renewal parameters, revocation process.
- **No FPP amendment needed** for `calibrate/*` or `meta/*`.

## Dissent Register

1. Single-MCP-server consolidation is a mistake — creates single point of failure. Decouple.
2. Framing assumes agents are primary beneficiaries — actual stakeholders are mixed (KP, agents, network).
3. Bootstrapping problem for `mode/*` is understated.
4. Missing: inter-agent governance (cross-agent comparison, collective criterion alignment).
5. `calibrate/self_report` targets wrong failure mode — should cover all confident assertions.

## Counter-Proposals

- Add cross-agent comparison mechanism to `meta/*` to catch correlated drift.
- Apply `calibrate/*` to all confident assertions, not just self-reports.
- Decouple deployment: each tool family independent, no shared MCP server.
