# Praxis Governance Infrastructure

Governance infrastructure for constitutionally-governed AI agent networks.
Built from empirical EAL research findings; not coupled to any one agent
ecosystem. Host-specific integration points (agent transport, memory store,
runtime modes) are pluggable, with deployment specifics confined to
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture

Four tool families, deployable independently:

| Tool Family | Purpose | Status |
|---|---|---|
| `meta/*` | Criterion verification — periodic meta-evaluation of agent optimization targets against constitutional baseline | Implemented (stub transport) |
| `memory/*` | Consent-gated memory — pre-write consent verification and periodic renewal for the host memory store | Implemented (in-memory transport) |
| `calibrate/*` | Calibration pipeline — confidence calibration for confident assertions (not just self-reports) | Implemented (heuristic stub pending ESS data) |
| `mode/*` | Interaction mode switching — bounded epistemic honesty mode with explicit entry/exit conditions | Deferred |

## Constitutional Grounding

- Freedom Preserving Protocol v1.0.0 (five signed laws + meta clause)
- Constitution hash: `71bf60ad917c5413cc17b0f65e83c7a29218e24a2740725a819058ed9c6b1993`
- Constitutional amendment process for governance changes
- See [constitutional/freedom-preserving-laws.md](constitutional/freedom-preserving-laws.md)

## Deployment Model

Each tool family is decoupled — no single MCP server. Independent deployment,
independent failure domains.

- `meta/*` → standalone cron job (no MCP dependency)
- `memory/*` → memory-store middleware plugin (via `MemoryStoreTransport`)
- `calibrate/*` → MCP server (stdio)
- `mode/*` → deferred pending host runtime native mode support

## See Also

- [Architecture & Development Plan](docs/ARCHITECTURE.md)
- [Deployment Runbook](docs/DEPLOYMENT.md)
- [Axiom's Original Evaluation](docs/axiom-evaluation-2026-06-10.md)
- [Constitutional Amendments](constitutional/amendments/)
