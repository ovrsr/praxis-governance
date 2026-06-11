/**
 * Tool: praxis_calibrate_assertion
 *
 * Primary calibration tool for all confident external assertions.
 * Adjusts declared confidence based on domain coverage and claim characteristics.
 */

import { z } from "zod";
import { BetaDistributionService } from "../services/beta-distribution.js";
import { DomainClassifier } from "../services/domain-classifier.js";
import { AdversarialDetector } from "../services/adversarial-detector.js";
import { DEFAULT_CALIBRATION_CONFIG } from "../types.js";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("tool-calibrate-assertion");

// Singleton services (stateless, reusable)
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

export const inputSchema = {
  claim_text: z.string().min(1).max(10000).describe("The assertion to calibrate. Max 10000 characters."),
  domain: z.string().min(1).default("general").describe('Domain hint (e.g., "medical", "technical", "governance"). Default: "general".'),
  confidence_declared: z.number().min(0).max(1).describe("Agent's self-declared confidence (0.0-1.0)."),
  context: z.string().max(5000).default("").describe("Surrounding context for the claim. Max 5000 characters."),
  source_agent: z.string().min(1).describe("Which agent is making the claim."),
};

export const toolDefinition = {
  name: "praxis_calibrate_assertion",
  description:
    "Calibrate a confident external assertion. Returns calibrated confidence, " +
    "abstention recommendation, and adversarial detection flag. " +
    "Use this before surfacing any confident claim to other agents or humans.",
  inputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function handleCalibrateAssertion(args: unknown): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const input = z.object({
      claim_text: z.string().min(1).max(10000),
      domain: z.string().min(1).default("general"),
      confidence_declared: z.number().min(0).max(1),
      context: z.string().max(5000).default(""),
      source_agent: z.string().min(1),
    }).parse(args);

    const svc = getService();
    const result = svc.calibrate(
      input.claim_text,
      input.domain,
      input.confidence_declared,
      input.context,
      input.source_agent
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Calibration failed", { error: message });
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}
