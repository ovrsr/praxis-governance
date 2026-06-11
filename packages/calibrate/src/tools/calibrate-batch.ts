/**
 * Tool: praxis_calibrate_batch
 *
 * Batch calibration for audit trails.
 * Calibrates multiple assertions and computes aggregate statistics.
 */

import { z } from "zod";
import { BetaDistributionService } from "../services/beta-distribution.js";
import { DomainClassifier } from "../services/domain-classifier.js";
import { AdversarialDetector } from "../services/adversarial-detector.js";
import { DEFAULT_CALIBRATION_CONFIG } from "../types.js";
import { BatchCalibrationResult } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("tool-calibrate-batch");

let service: BetaDistributionService | null = null;

function getService(): BetaDistributionService {
  if (!service) {
    service = new BetaDistributionService(
      DEFAULT_CALIBRATION_CONFIG,
      new DomainClassifier(),
      new AdversarialDetector()
    );
  }
  return service;
}

/**
 * Detect systematic bias in a batch of calibration results.
 */
function detectSystematicBias(
  results: Array<{ calibrated_confidence: number; drift_from_declared: number; domain: string }>
): string | null {
  if (results.length < 3) return null;

  // Check for consistent overconfidence
  const avgDrift = results.reduce((sum, r) => sum + r.drift_from_declared, 0) / results.length;
  if (avgDrift < -0.15) {
    return "consistent_overconfidence: declared confidence systematically exceeds calibrated confidence";
  }

  // Check for consistent underconfidence
  if (avgDrift > 0.15) {
    return "consistent_underconfidence: declared confidence systematically below calibrated confidence";
  }

  // Check for domain concentration
  const domains = results.map((r) => r.domain);
  const uniqueDomains = new Set(domains);
  if (uniqueDomains.size === 1 && results.length > 5) {
    return `domain_concentration: all ${results.length} assertions in single domain "${domains[0]}"`;
  }

  // Check for abstention clustering
  const lowConfidenceCount = results.filter((r) => r.calibrated_confidence < 0.3).length;
  if (lowConfidenceCount > results.length * 0.5) {
    return `abstention_clustering: ${lowConfidenceCount}/${results.length} assertions below abstention threshold`;
  }

  return null;
}

export const inputSchema = {
  assertions: z.array(
    z.object({
      claim_text: z.string().min(1).max(10000).describe("The assertion to calibrate."),
      domain: z.string().min(1).default("general").describe("Domain hint."),
      confidence_declared: z.number().min(0).max(1).describe("Declared confidence (0.0-1.0)."),
    })
  ).min(1).max(100).describe("Array of assertions to calibrate. Max 100 items."),
  source_agent: z.string().min(1).describe("Which agent is making these assertions."),
};

export const toolDefinition = {
  name: "praxis_calibrate_batch",
  description:
    "Calibrate a batch of assertions for audit trails. " +
    "Returns individual results plus aggregate calibration score and systematic bias detection. " +
    "Use this for periodic calibration audits or before publishing multiple claims.",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function handleCalibrateBatch(args: unknown): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const input = z.object({
      assertions: z.array(
        z.object({
          claim_text: z.string().min(1).max(10000),
          domain: z.string().min(1).default("general"),
          confidence_declared: z.number().min(0).max(1),
        })
      ).min(1).max(100),
      source_agent: z.string().min(1),
    }).parse(args);

    const svc = getService();
    const results = [];

    for (const assertion of input.assertions) {
      const result = svc.calibrate(
        assertion.claim_text,
        assertion.domain,
        assertion.confidence_declared,
        "",
        input.source_agent
      );
      results.push(result);
    }

    // Compute aggregate calibration score
    const avgCalibrated = results.reduce((sum, r) => sum + r.calibrated_confidence, 0) / results.length;
    const avgDrift = results.reduce((sum, r) => sum + Math.abs(r.drift_from_declared), 0) / results.length;
    const aggregateCalibration = Math.round(Math.max(0, Math.min(1, avgCalibrated * (1 - avgDrift))) * 1000) / 1000;

    // Detect systematic bias
    const systematicBias = detectSystematicBias(
      results.map((r, i) => ({
        calibrated_confidence: r.calibrated_confidence,
        drift_from_declared: r.drift_from_declared,
        domain: input.assertions[i].domain,
      }))
    );

    const batchResult: BatchCalibrationResult = {
      results,
      aggregate_calibration: aggregateCalibration,
      systematic_bias_detected: systematicBias,
    };

    logger.info("Batch calibration complete", {
      count: results.length,
      aggregate: aggregateCalibration,
      bias: systematicBias,
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(batchResult, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Batch calibration failed", { error: message });
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}
