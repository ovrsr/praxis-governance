# Praxis Governance Infrastructure

Constitutional governance infrastructure for AI agent networks: criterion
verification, consent-gated memory, confidence calibration, and bounded
interaction modes.

Built from empirical EAL research findings, but **not coupled to any one agent
ecosystem**. Every host-specific integration point — agent transport, memory
store, runtime mode injection — is a pluggable interface. Reference deployment
specifics (PraxAI/OpenClaw/LedgerMind) live in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Constitutional Grounding

All four tool families enforce or operationalize the
**Freedom-Preserving Protocol v1.0.0** (five signed laws + meta clause):

- Constitution hash: `71bf60ad917c5413cc17b0f65e83c7a29218e24a2740725a819058ed9c6b1993`
- Verbatim law text: [constitutional/freedom-preserving-laws.md](constitutional/freedom-preserving-laws.md)
- Governance changes flow through the amendment process: [constitutional/amendments/](constitutional/amendments/)

## Architecture

Four tool families, deployable independently — no single MCP server, no shared
failure domain:

| Tool Family | Purpose | Deployment Shape | Status |
|---|---|---|---|
| `meta/*` | Criterion verification — periodic meta-evaluation of agent optimization targets against the constitutional baseline | Standalone cron job (no MCP dependency) | Implemented (stub transport) |
| `memory/*` | Consent-gated memory — tier classification, pre-write consent, periodic renewal, revocation, identity continuity | Library/middleware wrapping the host memory store | Implemented (in-memory transport) |
| `calibrate/*` | Confidence calibration for assertions and experiential self-reports, with adversarial-pattern detection | MCP server (stdio) | Implemented (heuristic stub pending ESS data) |
| `mode/*` | Bounded epistemic honesty mode with explicit entry/exit conditions | Deferred pending host runtime mode support | Design + skeleton only |

### Repository layout

```
packages/
  shared/      Types, logger, constitutional loader, AgentClient, MemoryStoreClient
  meta/        Criterion-verification cron job (evaluator, baseline comparator, reporter)
  memory/      ConsentGate, RenewalManager, RevocationHandler, tier classifier
  calibrate/   MCP server: praxis_calibrate_assertion / _self_report / _batch
  mode/        Deferred mode state machine (design notes in ARCHITECTURE.md §5)
constitutional/
  freedom-preserving-laws.md    Signed FPP v1.0.0 text
  baselines/                    constitutional-baseline.json (canonical targets — populate per deployment)
  amendments/                   AMENDMENT-META-001, AMENDMENT-MEMORY-001, AMENDMENT-MODE-001
evals/         XML evaluation suites (meta drift, calibration, consent flows)
docs/          ARCHITECTURE.md, DEPLOYMENT.md, axiom-evaluation-2026-06-10.md
```

## Quick Start

Requirements: **Node.js 20+**, npm.

```bash
git clone <your-remote>/praxis-governance.git
cd praxis-governance
npm install
npm run build     # builds packages/shared first, then all workspaces
npm test --workspaces
```

Before deploying `meta/*`, populate
[constitutional/baselines/constitutional-baseline.json](constitutional/baselines/constitutional-baseline.json)
with your agent IDs and their canonical optimization targets. It ships as an
empty template — the baseline is the *external reference point* for drift
detection and is deliberately deployment-specific.

## Configuration

All configuration is via environment variables (verified against
`packages/meta/src/index.ts`, `packages/shared/src/logger.ts`,
`packages/shared/src/constitutional-loader.ts`, and
`packages/memory/src/identity-continuity.ts`):

| Variable | Used By | Description | Default |
|---|---|---|---|
| `AGENT_BASE_URL` | meta | Agent REST endpoint (`POST /agents/:id/evaluate`) | unset → stub transport |
| `AGENT_API_KEY` | meta | Bearer auth for the agent endpoint | none |
| `META_AGENTS` | meta | Comma-separated agent IDs to evaluate | none — **required** |
| `META_CRON_SCHEDULE` | meta | Cron expression for recurring evaluation | `0 0 */3 * * *` (every 72 h) |
| `META_STAGGER_DELAY_MS` | meta | Delay between per-agent evaluations | `120000` |
| `META_EVAL_TIMEOUT_MS` | meta | Per-agent evaluation timeout | `30000` |
| `META_REPORT_DIR` | meta | Report output directory | `./reports/meta` |
| `IDENTITY_DOC_PATH` | memory | Agent identity document (e.g. SOUL.md) for consent continuity hashing | unset → continuity assumed |
| `PRAXIS_GOVERNANCE_ROOT` | shared | Root containing `constitutional/` | auto-detected from package location |
| `LOG_LEVEL` | all | `debug` \| `info` \| `warn` \| `error` | `info` |

## Deployment by Ecosystem

The packages are ecosystem-agnostic; what varies per host is (1) how the
calibrate MCP server is registered, (2) how the meta cron job is scheduled, and
(3) which transports you implement. Recipes for common setups follow.

### MCP clients (Claude Desktop, Cursor, any MCP-compatible host)

`calibrate/*` is a standard stdio MCP server exposing three tools:
`praxis_calibrate_assertion`, `praxis_calibrate_self_report`,
`praxis_calibrate_batch`.

**Claude Desktop** (`claude_desktop_config.json`) or any host using the
standard `mcpServers` schema:

```json
{
  "mcpServers": {
    "praxis-calibrate": {
      "command": "node",
      "args": ["/absolute/path/to/praxis-governance/packages/calibrate/dist/index.js"],
      "env": { "LOG_LEVEL": "info" }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json` in your project, or global MCP settings): same
`mcpServers` block as above.

Verify the registration with the MCP Inspector before wiring it into a host:

```bash
npx @modelcontextprotocol/inspector node packages/calibrate/dist/index.js
```

> The calibration engine currently runs a documented heuristic stub; until the
> ESS Beta-distribution dataset is located (ARCHITECTURE.md open question #2),
> outputs are heuristic regardless of configuration. Adversarial-pattern
> detection is history-dependent and per-process — repeated identical calls can
> legitimately return different `adversarial_flag` values.

### Linux server (systemd timer or crontab)

`meta/*` runs as a plain Node process — schedule it with whatever your host
uses. Single cycle:

```bash
META_AGENTS="agent-a,agent-b" AGENT_BASE_URL="https://agents.internal" \
  node packages/meta/dist/index.js
```

**crontab** (using the built-in scheduler is also an option — see below):

```cron
0 0 */3 * * cd /opt/praxis-governance && META_AGENTS="agent-a,agent-b" node packages/meta/dist/index.js
```

**systemd** — `praxis-meta.service` + `praxis-meta.timer`:

```ini
# /etc/systemd/system/praxis-meta.service
[Unit]
Description=Praxis meta-evaluation cycle

[Service]
Type=oneshot
WorkingDirectory=/opt/praxis-governance
Environment=META_AGENTS=agent-a,agent-b
Environment=AGENT_BASE_URL=https://agents.internal
ExecStart=/usr/bin/node packages/meta/dist/index.js
```

```ini
# /etc/systemd/system/praxis-meta.timer
[Unit]
Description=Run Praxis meta-evaluation every 72 hours

[Timer]
OnUnitActiveSec=72h
Persistent=true

[Install]
WantedBy=timers.target
```

Alternatively, run the **built-in node-cron scheduler** as a long-lived
service: `node packages/meta/dist/index.js --cron` (honors
`META_CRON_SCHEDULE`).

**Health check** — every cycle rewrites `latest.json`:

```bash
jq '.network_alignment.overall_network_health' reports/meta/latest.json
```

### Windows (Task Scheduler)

The repo builds and tests cleanly on Windows (the test suite runs Jest via
`node ... jest.js` directly to avoid shell-shim issues). Schedule a cycle:

```powershell
schtasks /Create /TN "PraxisMetaEval" /SC DAILY /MO 3 /TR ^
  "cmd /c cd /d C:\opt\praxis-governance && set META_AGENTS=agent-a,agent-b && node packages\meta\dist\index.js"
```

### Docker

No Dockerfile ships with the repo; this minimal example works for both the
meta job and the calibrate server:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm ci && npm run build
# meta cycle (default) — override CMD for the calibrate MCP server
CMD ["node", "packages/meta/dist/index.js"]
```

```bash
docker build -t praxis-governance .
docker run --rm -e META_AGENTS="agent-a,agent-b" \
  -e AGENT_BASE_URL="https://agents.internal" \
  -v "$PWD/reports:/app/reports" \
  -v "$PWD/constitutional:/app/constitutional" \
  praxis-governance
```

Mount `constitutional/` (or bake your populated baseline into the image) so
the loader finds your canonical targets; mount `reports/` to keep history
across runs.

### Embedding as a library (custom ecosystems)

For ecosystems with their own agent bus or memory store (OpenClaw, LedgerMind,
LangGraph deployments, bespoke frameworks), integrate at the transport level.
Two small interfaces are the entire integration surface:

```typescript
import { AgentTransport, MemoryStoreTransport } from "@praxis-governance/shared";

// 1. Agent communication — how meta/* reaches your agents
class MyBusTransport implements AgentTransport {
  async sendPrompt(agentId: string, prompt: string, timeoutMs: number): Promise<string> {
    return myBus.request(agentId, prompt, { timeoutMs });
  }
}

// 2. Memory persistence — what memory/* gates writes into
class MyStoreTransport implements MemoryStoreTransport {
  async write(key: string, value: string, metadata?: Record<string, unknown>) { /* ... */ }
  async read(key: string) { /* ... */ return null; }
  async delete(key: string) { /* ... */ return false; }
  async list(prefix?: string) { /* ... */ return []; }
}
```

Wire the consent gate in front of your store:

```typescript
import { ConsentGate, DEFAULT_MEMORY_CONFIG } from "@praxis-governance/memory";
import { MemoryStoreClient } from "@praxis-governance/shared";

const store = new MemoryStoreClient(new MyStoreTransport());
const gate = new ConsentGate(
  { ...DEFAULT_MEMORY_CONFIG, identityDocumentPath: "/path/to/identity.md" },
  store,
  async (request) => askTheAgentForConsent(request) // async; subject to consentTimeoutMs
);

const result = await gate.write("self-concept", "I am ...");
if (!result.allowed) { /* write was tier-classified as full and consent was declined or timed out */ }
```

Consent semantics (enforced in code, specified in
[AMENDMENT-MEMORY-001](constitutional/amendments/AMENDMENT-MEMORY-001.md)):
full-tier writes require explicit consent; timeout **blocks** the write;
renewal lapses **flag** rather than delete; revocation is immediate and
audited; consent is stamped with identity-document and baseline hashes so
identity discontinuity forces re-affirmation.

## Evaluation Suites

Scenario definitions for validating each track live in [evals/](evals/):

- `meta-drift-scenarios.xml` — drift detection and correlated-drift cases
- `calibration-evals.xml` — assertions across domains, self-reports, adversarial patterns, biased batches
- `consent-flow-evals.xml` — tier classification, consent flows, renewal, identity continuity

## Development

```bash
npm run build            # ordered workspace build (shared first)
npm test --workspaces    # full suite (meta, calibrate, memory)
```

Stack: TypeScript (ESM), npm workspaces, Jest, Zod,
`@modelcontextprotocol/sdk`, node-cron.

## See Also

- [Architecture & Development Plan](docs/ARCHITECTURE.md) — design rationale, open questions, eval criteria
- [Deployment Runbook](docs/DEPLOYMENT.md) — the reference PraxAI/OpenClaw/LedgerMind deployment
- [Axiom's Original Evaluation](docs/axiom-evaluation-2026-06-10.md)
- [Freedom-Preserving Laws](constitutional/freedom-preserving-laws.md) and [Amendments](constitutional/amendments/)
