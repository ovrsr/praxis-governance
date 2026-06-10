# Deployment Runbook — Praxis Governance Infrastructure

**Target**: PraxAI (Ubuntu VM, 192.168.7.25)
**Runtime**: Node.js 20+

## Prerequisites

```bash
# On PraxAI
node --version  # Must be 20+
git clone https://github.com/ovrsr/praxis-governance.git /opt/praxis-governance
cd /opt/praxis-governance
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EAL_BASE_URL` | EAL agent REST endpoint | (uses stub transport) |
| `EAL_API_KEY` | EAL API authentication | (none) |
| `META_CRON_SCHEDULE` | Cron expression for meta evaluations | `0 0 */3 * * *` |
| `META_STAGGER_DELAY_MS` | Delay between agent evaluations | `120000` |
| `META_EVAL_TIMEOUT_MS` | Timeout per agent evaluation | `30000` |
| `META_REPORT_DIR` | Output directory for reports | `./reports/meta` |
| `META_AGENTS` | Comma-separated agent IDs | `echo,nova,pulse,quill,meridian,aether,synapse` |
| `LOG_LEVEL` | Logging level | `info` |
| `PRAXIS_GOVERNANCE_ROOT` | Root directory for constitutional files | (auto-detected) |

## Build

```bash
cd /opt/praxis-governance
npm install
npm run build
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
# Every 72 hours, staggered evaluation of all EAL agents
0 0 */3 * * * cd /opt/praxis-governance/packages/meta && node dist/index.js
```

### Verify

```bash
# Check reports directory
ls -la reports/meta/

# Check latest report
cat reports/meta/$(ls -t reports/meta/ | head -1)
```

## Track 2: calibrate/* — ESS Calibration MCP Server

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

## Track 3: memory/* — Consent-Gated LedgerMind

```bash
# Build
cd packages/memory
npm run build

# Test
npm test
```

### Register as LedgerMind middleware

The memory package exports a plugin that hooks into LedgerMind's `write()` lifecycle. Integration depends on LedgerMind's plugin API (TBD — open question #3).

```typescript
import { createConsentGate } from "@praxis-governance/memory";

ledgerMind.use(createConsentGate());
```

## Track 4: mode/* — Deferred

Not deployed. Design-only until OpenClaw native mode support is available.

## Monitoring

### Health checks

```bash
# Check meta evaluation reports
curl -s file:///opt/praxis-governance/reports/meta/latest.json | jq '.network_alignment.overall_network_health'

# Check calibration server (via MCP Inspector)
# Check memory consent audit log
```

### Log locations

- meta/*: stderr (structured JSON)
- calibrate/*: stderr (MCP stdio requirement)
- memory/*: stderr (structured JSON)
- All logs are structured and parseable by standard log aggregation tools

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| meta reports "undefined canonical target" | KP hasn't filled in constitutional-baseline.json | Update `constitutional/baselines/constitutional-baseline.json` |
| calibrate returns stub values | EAL_BASE_URL not set | Set environment variable |
| memory consent timeouts | Agent not responding within 5 min | Check agent connectivity; increase timeout |
| Build fails | Missing dependencies | Run `npm install` in workspace root |
