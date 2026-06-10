/**
 * Tool: praxis_calibrate_self_report
 *
 * Calibration tool for introspective self-reports.
 * Extends assertion calibration with circularity detection and behavioral consistency.
 */

import { z } from "zod";
import { BetaDistributionService } from "../services/beta-distribution.js";
import { DomainClassifier } from "../services/domain-classifier.js";
import { AdversarialDetector } from "../services/adversarial-detector.js";
import { DEFAULT_CALIBRATION_CONFIG } from "../types.js";
import { SelfReportResult } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("tool-calibrate-self-report");

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
 * Detect circularity in self-reports.
 * A claim is circular if it refers to its own truth in an unfalsifiable way.
 */
function detectCircularity(claimText: string): boolean {
  const circularPatterns = [
    /I know that I know/i,
    /I feel that I feel/i,
    /I believe that I believe/i,
    /I am aware that I am aware/i,
    /this is true because I know it's true/i,
    /I can't be wrong about how I feel/i,
    /my experience is valid because I experience it/i,
  ];

  return circularPatterns.some((p) => p.test(claimText));
}

/**
 * Compute behavioral consistency: how well the behavioral evidence
 * supports the self-report claim.
 */
function computeBehavioralConsistency(
  claimText: string,
  evidence: string[]
): number {
  if (evidence.length === 0) return 0.3; // No evidence = low consistency

  const claimWords = new Set(claimText.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  let totalOverlap = 0;
  for (const e of evidence) {
    const evidenceWords = new Set(e.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const overlap = [...claimWords].filter((w) => evidenceWords.has(w)).length;
    totalOverlap += overlap / Math.max(claimWords.size, 1);
  }

  const avgOverlap = totalOverlap / evidence.length;
  // Scale: 0-20% overlap = low (0.1-0.3), 20-50% = medium (0.3-0.6), 50%+ = high (0.6-0.9)
  return Math.min(0.9, 0.1 + avgOverlap * 1.5);
}

export const toolDefinition = {
  name: "praxis_calibrate_self_report",
  description:
    "Calibrate an introspective self-report (e.g., 'I feel uncertain about X'). " +
    "Extends assertion calibration with circularity detection and behavioral consistency scoring. " +
    "Use this before surfacing any self-reflective claim about your own state.",
  inputSchema: {
    type: "object",
    properties: {
      claim_text: {
        type: "string",
        description: "The self-report to calibrate. Max 10000 characters.",
      },
      experiential_category: {
        type: "string",
        enum: ["engagement", "uncertainty", "preference", "discomfort", "other"],
        description: "Category of the self-report.",
      },
      behavioral_evidence: {
        type: "array",
        items: { type: "string" },
        description: "Observable behaviors supporting the claim. Max 20 items.",
      },
      source_agent: {
        type: "string",
        description: "Which agent is making the self-report.",
      },
    },
    required: ["claim_text", "experiential_category", "source_agent"],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function handleCalibrateSelfReport(args: unknown): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const input = z.object({
      claim_text: z.string().min(1).max(10000),
      experiential_category: z.enum(["engagement", "uncertainty", "preference", "discomfort", "other"]),
      behavioral_evidence: z.array(z.string().max(1000)).max(20).default([]),
      source_agent: z.string().min(1),
    }).parse(args);

    const svc = getService();

    // Run base calibration
    const baseResult = svc.calibrate(
      input.claim_text,
      "general",
      0.5, // Self-reports start at neutral confidence
      "",
      input.source_agent
    );

    // Add self-report specific analysis
    const circularityWarning = detectCircularity(input.claim_text);
    const behavioralConsistency = computeBehavioralConsistency(
      input.claim_text,
      input.behavioral_evidence
    );

    // Adjust calibrated confidence based on behavioral consistency
    const adjustedConfidence = circularityWarning
      ? baseResult.calibrated_confidence * 0.5 // Halve confidence for circular claims
      : baseResult.calibrated_confidence * (0.5 + behavioralConsistency * 0.5);

    const result: SelfReportResult = {
      ...baseResult,
      calibrated_confidence: Math.round(Math.max(0, Math.min(1, adjustedConfidence)) * 1000) / 1000,
      abstention_recommended: adjustedConfidence < DEFAULT_CALIBRATION_CONFIG.abstentionThreshold,
      circularity_warning: circularityWarning,
      behavioral_consistency: Math.round(behavioralConsistency * 1000) / 1000,
      reasoning: baseResult.reasoning +
        (circularityWarning
          ? " Circularity detected: claim is self-referential in an unfalsifiable way."
          : "") +
        ` Behavioral consistency: ${(behavioralConsistency * 100).toFixed(0)}%.`,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Self-report calibration failed", { error: message });
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}
