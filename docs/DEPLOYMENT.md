# Deployment Runbook — Praxis Governance Infrastructure

**Target**: PraxAI (Ubuntu VM, 192.168.7.25)
**Runtime**: Node.js 20+

The packages themselves are ecosystem-agnostic; this runbook covers the
PraxAI/OpenClaw/LedgerMind deployment specifically.

## Prerequisites

```bash
# On PraxAI
node --version  # Must be 20+
git clone <praxis-governance remote> /opt/praxis-governance
cd /opt/praxis-governance
```

## Environment Variables

Sources: `packages/meta/src/index.ts` (`resolveConfig`/`resolveTransport`),
`packages/shared/src/constitutional-loader.ts`, `packages/shared/src/logger.ts`,
`packages/memory/src/identity-continuity.ts`.

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_BASE_URL` | Agent REST endpoint for meta-evaluation prompts | (uses stub transport) |
| `AGENT_API_KEY` | Agent endpoint authentication | (none) |
| `META_CRON_SCHEDULE` | Cron expression for meta evaluations | `0 0 */3 * * *` |
| `META_STAGGER_DELAY_MS` | Delay between agent evaluations | `120000` |
| `META_EVAL_TIMEOUT_MS` | Timeout per agent evaluation | `30000` |
| `META_REPORT_DIR` | Output directory for reports | `./reports/meta` |
| `META_AGENTS` | Comma-separated agent IDs to evaluate | (none — **must be set**, or passed via config) |
| `IDENTITY_DOC_PATH` | Path to the agent identity document (e.g. SOUL.md) for consent continuity hashing | (none — continuity checks fail open) |
| `LOG_LEVEL` | Logging level | `info` |
| `PRAXIS_GOVERNANCE_ROOT` | Root directory for constitutional files | (auto-detected) |

Before deploying meta/*, also populate
`constitutional/baselines/constitutional-baseline.json` with the canonical
optimization target per agent — the agent IDs there and in `META_AGENTS`
must match.

## Build

```bash
cd /opt/praxis-governance
npm install
npm run build   # builds shared first, then all workspaces
```

## Track 1: meta/* — Criterion Verification

```bash
# Single evaluation cycle (testing)
cd packages/meta
npx ts-node src/index.ts

# Cron mode (production)
npx ts-node src/index.ts --cron

# Or using compiled JS
node dist/index.js --cron
```

### Register with Hermes cron

Add to Hermes cron configuration:

```
# Every 72 hours, staggered evaluation of all governed agents
0 0 */3 * * * cd /opt/praxis-governance/packages/meta && node dist/index.js
```

### Verify

```bash
# Check reports directory
ls -la reports/meta/

# Check latest report (latest.json is rewritten on every cycle)
cat reports/meta/latest.json
```

## Track 2: calibrate/* — Calibration MCP Server

> Note: the calibration engine currently runs a documented heuristic stub.
> The ESS Beta-distribution data it is designed to consume has not been
> located (open question #2 in ARCHITECTURE.md); until it is, calibration
> output is heuristic regardless of configuration.

```bash
# Test with MCP Inspector
cd packages/calibrate
npx @modelcontextprotocol/inspector node dist/index.js

# Run directly (stdio)
node dist/index.js
```

### Register as MCP tool in OpenClaw

Add to OpenClaw MCP configuration:

```json
{
  "mcpServers": {
    "praxis-calibrate": {
      "command": "node",
      "args": ["/opt/praxis-governance/packages/calibrate/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Track 3: memory/* — Consent-Gated Memory (LedgerMind)

```bash
# Build
cd packages/memory
npm run build

# Test
npm test
```

### Register as LedgerMind middleware

The memory package exports a consent gate that wraps any
`MemoryStoreTransport` implementation. Integrating with LedgerMind requires
implementing that transport against LedgerMind's API (TBD — open question #3).

```typescript
import { ConsentGate, DEFAULT_MEMORY_CONFIG } from "@praxis-governance/memory";
import { MemoryStoreClient } from "@praxis-governance/shared";

const store = new MemoryStoreClient(ledgerMindTransport); // implements MemoryStoreTransport
const gate = new ConsentGate(
  { ...DEFAULT_MEMORY_CONFIG, identityDocumentPath: "/home/praxis/SOUL.md" },
  store,
  consentCallback
);
```

## Track 4: mode/* — Deferred

Not deployed. Design-only until host runtime (OpenClaw) native mode support
is available.

## Monitoring

### Health checks

```bash
# Meta evaluation network health
jq '.network_alignment.overall_network_health' /opt/praxis-governance/reports/meta/latest.json

# Calibration server: verify tool listing via MCP Inspector
# Memory: review the consent gate audit log via getAuditLog()
```

### Log locations

- meta/*: stderr (structured JSON)
- calibrate/*: stderr (MCP stdio requirement)
- memory/*: stderr (structured JSON)
- All logs are structured and parseable by standard log aggregation tools

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| meta reports "undefined canonical target" | Canonical targets not filled in | Update `constitutional/baselines/constitutional-baseline.json` |
| meta evaluates no agents | `META_AGENTS` not set (no default) | Set `META_AGENTS` to your agent IDs |
| meta uses stub transport | `AGENT_BASE_URL` not set | Set environment variable |
| consent continuity always "assumed continuous" | `IDENTITY_DOC_PATH` / `identityDocumentPath` not configured | Point it at the agent identity document |
| memory consent timeouts | Agent not responding within 5 min | Check agent connectivity; increase `consentTimeoutMs` |
| Build fails | Missing dependencies | Run `npm install` in workspace root |
