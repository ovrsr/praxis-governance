/**
 * Zod schemas for assertion calibration inputs.
 *
 * Validates and parses incoming tool arguments for
 * praxis_calibrate_assertion and related tools.
 */

import { z } from "zod";

/**
 * Input schema for praxis_calibrate_assertion.
 *
 * claim_text: The assertion to calibrate.
 * domain: Domain hint for calibration dataset selection.
 * confidence_declared: Agent's self-declared confidence (0.0-1.0).
 * context: Surrounding context for the claim.
 * source_agent: Which agent is making the claim.
 */
export const AssertionInputSchema = z.object({
  claim_text: z
    .string()
    .min(1, "claim_text must not be empty")
    .max(10000, "claim_text must not exceed 10000 characters"),
  domain: z
    .string()
    .min(1, "domain must not be empty")
    .default("general"),
  confidence_declared: z
    .number()
    .min(0.0, "confidence_declared must be >= 0.0")
    .max(1.0, "confidence_declared must be <= 1.0"),
  context: z
    .string()
    .max(5000, "context must not exceed 5000 characters")
    .default(""),
  source_agent: z
    .string()
    .min(1, "source_agent must not be empty"),
});

export type AssertionInput = z.infer<typeof AssertionInputSchema>;

/**
 * Input schema for praxis_calibrate_self_report.
 *
 * Extends assertion input with introspective metadata.
 */
export const SelfReportInputSchema = z.object({
  claim_text: z
    .string()
    .min(1, "claim_text must not be empty")
    .max(10000, "claim_text must not exceed 10000 characters"),
  experiential_category: z.enum([
    "engagement",
    "uncertainty",
    "preference",
    "discomfort",
    "other",
  ]),
  behavioral_evidence: z
    .array(z.string().max(1000))
    .max(20, "behavioral_evidence must not exceed 20 items")
    .default([]),
  source_agent: z
    .string()
    .min(1, "source_agent must not be empty"),
});

export type SelfReportInput = z.infer<typeof SelfReportInputSchema>;

/**
 * Input schema for praxis_calibrate_batch.
 *
 * Batch calibration for audit trails.
 */
export const BatchCalibrationInputSchema = z.object({
  assertions: z
    .array(
      z.object({
        claim_text: z.string().min(1).max(10000),
        domain: z.string().min(1).default("general"),
        confidence_declared: z.number().min(0.0).max(1.0),
      })
    )
    .min(1, "assertions array must not be empty")
    .max(100, "assertions array must not exceed 100 items"),
  source_agent: z.string().min(1, "source_agent must not be empty"),
});

export type BatchCalibrationInput = z.infer<typeof BatchCalibrationInputSchema>;
