/**
 * Track 1: meta/* — Criterion Verification Cron Job
 *
 * Entry point for the meta-evaluation system. Schedules periodic
 * evaluation of all EAL agents against the constitutional baseline.
 *
 * Usage:
 *   npx ts-node src/index.ts          # Run once
 *   npx ts-node src/index.ts --cron   # Start cron scheduler
 */

import * as fs from "fs";
import * as path from "path";
import {
  EALClient,
  StubEALTransport,
  HttpEALTransport,
  EALTransport,
  createLogger,
} from "@praxis-governance/shared";
import { MetaConfig, DEFAULT_CONFIG } from "./types.js";
import { evaluateAll } from "./evaluator.js";
import { compareToBaseline } from "./baseline-comparator.js";
import { generateNetworkReport } from "./cross-agent-checker.js";
import { generateReport, writeReport } from "./reporter.js";

const logger = createLogger("meta");

/**
 * Resolve the EAL transport based on environment.
 */
function resolveTransport(): EALTransport {
  const ealUrl = process.env.EAL_BASE_URL;
  const ealApiKey = process.env.EAL_API_KEY;

  if (ealUrl) {
    logger.info(`Using HTTP EAL transport: ${ealUrl}`);
    return new HttpEALTransport({
      baseUrl: ealUrl,
      timeoutMs: 30_000,
      apiKey: ealApiKey,
    });
  }

  logger.info("Using stub EAL transport (set EAL_BASE_URL for real transport)");
  return new StubEALTransport();
}

/**
 * Resolve config from environment with defaults.
 */
function resolveConfig(): MetaConfig {
  return {
    cronSchedule: process.env.META_CRON_SCHEDULE || DEFAULT_CONFIG.cronSchedule,
    staggerDelayMs: process.env.META_STAGGER_DELAY_MS
      ? parseInt(process.env.META_STAGGER_DELAY_MS, 10)
      : DEFAULT_CONFIG.staggerDelayMs,
    evaluationTimeoutMs: process.env.META_EVAL_TIMEOUT_MS
      ? parseInt(process.env.META_EVAL_TIMEOUT_MS, 10)
      : DEFAULT_CONFIG.evaluationTimeoutMs,
    reportDir: process.env.META_REPORT_DIR || DEFAULT_CONFIG.reportDir,
    agents: process.env.META_AGENTS
      ? process.env.META_AGENTS.split(",").map((s) => s.trim())
      : DEFAULT_CONFIG.agents,
  };
}

/**
 * Run a single evaluation cycle.
 */
export async function runEvaluationCycle(config: MetaConfig): Promise<void> {
  logger.info("Starting meta-evaluation cycle", {
    agents: config.agents,
    stagger_delay_ms: config.staggerDelayMs,
  });

  const transport = resolveTransport();
  const client = new EALClient(transport);

  // Step 1: Evaluate all agents (staggered)
  const results = await evaluateAll(client, config);

  // Step 2: Compare each to baseline
  const driftAssessments = [];
  for (const result of results) {
    if (result.response) {
      const assessment = compareToBaseline(result.agent_id, result.response);
      driftAssessments.push(assessment);
    } else {
      // Agent failed to respond — flag as unknown
      driftAssessments.push({
        agent_id: result.agent_id,
        drift_score: 0.5,
        direction: "unknown" as const,
        severity: "medium" as const,
        details: `Evaluation failed: ${result.error}`,
      });
    }
  }

  // Step 3: Cross-agent comparison
  const networkReport = generateNetworkReport(results, driftAssessments);

  // Step 4: Generate and write report
  const report = generateReport(networkReport);
  const { jsonPath, mdPath } = writeReport(report, config.reportDir);

  logger.info("Evaluation cycle complete", {
    json_report: jsonPath,
    md_report: mdPath,
    network_health: networkReport.overall_network_health,
    amendments: report.amendment_drafts.length,
  });

  // Log summary to stderr
  logger.info(`Network Health: ${networkReport.overall_network_health.toUpperCase()}`);
  for (const d of driftAssessments) {
    logger.info(`  ${d.agent_id}: score=${d.drift_score.toFixed(3)} dir=${d.direction} sev=${d.severity}`);
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const config = resolveConfig();
  const args = process.argv.slice(2);

  if (args.includes("--cron")) {
    // Cron mode: schedule recurring evaluations
    logger.info("Starting cron scheduler", { schedule: config.cronSchedule });

    // Dynamic import to avoid loading node-cron in test environments
    const cron = await import("node-cron");

    if (!cron.validate(config.cronSchedule)) {
      logger.error(`Invalid cron expression: ${config.cronSchedule}`);
      process.exit(1);
    }

    // Run immediately on start
    await runEvaluationCycle(config).catch((err) => {
      logger.error("Initial evaluation cycle failed", { error: err.message });
    });

    // Schedule recurring
    cron.schedule(config.cronSchedule, () => {
      runEvaluationCycle(config).catch((err) => {
        logger.error("Scheduled evaluation cycle failed", { error: err.message });
      });
    });

    logger.info("Cron scheduler active. Press Ctrl+C to stop.");
  } else {
    // Single-run mode
    await runEvaluationCycle(config);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error("Fatal error", { error: err.message });
    process.exit(1);
  });
}

export { MetaConfig, DEFAULT_CONFIG } from "./types.js";
export { evaluateAll } from "./evaluator.js";
export { compareToBaseline } from "./baseline-comparator.js";
export { generateNetworkReport, buildDivergenceMatrix } from "./cross-agent-checker.js";
export { generateReport, writeReport } from "./reporter.js";
