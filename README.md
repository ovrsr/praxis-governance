# Praxis Governance Infrastructure

Governance infrastructure for the Praxis/EAL/OpenClaw agent network.

## Architecture

Four tool families, deployable independently:

| Tool Family | Purpose | Status |
|---|---|---|
| `meta/*` | Criterion verification — periodic meta-evaluation of agent optimization targets against constitutional baseline | Planned |
| `memory/*` | Consent-gated memory — pre-write consent verification and periodic renewal for LedgerMind | Planned |
| `calibrate/*` | ESS pipeline — Beta-distribution calibration for confident assertions (not just self-reports) | Planned |
| `mode/*` | Interaction mode switching — bounded epistemic honesty mode with explicit entry/exit conditions | Deferred |

## Constitutional Grounding

- Freedom Preserving Protocol v1.0.0
- Constitution hash: `71bf60ad917c5413cc17b0f65e83c7a29218e24a2740725a819058ed9c6b1993`
- EAL amendment process for governance changes

## Deployment Model

Each tool family is decoupled — no single MCP server. Independent deployment, independent failure domains.

- `meta/*` → standalone EAL cron job (no MCP dependency)
- `memory/*` → LedgerMind plugin
- `calibrate/*` → MCP tool on PraxAI
- `mode/*` → deferred pending OpenClaw native mode support

## See Also

- [Architecture Decision Records](docs/adr/)
- [Constitutional Compatibility Analysis](docs/constitutional-analysis.md)
- [Axiom's Original Evaluation](docs/axiom-evaluation-2026-06-10.md)
