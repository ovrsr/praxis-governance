/**
 * Zod schemas for calibration results.
 *
 * Validates and structures the output of calibration tools.
 */

import { z } from "zod";

/**
 * Output schema for praxis_calibrate_assertion.
 */
export const CalibrationResultSchema = z.object({
  calibrated_confidence: z.number().min(0.0).max(1.0),
  abstention_recommended: z.boolean(),
  drift_from_declared: z.number(),
  domain_coverage: z.number().min(0.0).max(1.0),
  adversarial_flag: z.boolean(),
  reasoning: z.string(),
});

export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;

/**
 * Output schema for praxis_calibrate_self_report.
 *
 * Extends CalibrationResult with circularity warning and behavioral consistency.
 */
export const SelfReportResultSchema = CalibrationResultSchema.extend({
  circularity_warning: z.boolean(),
  behavioral_consistency: z.number().min(0.0).max(1.0),
});

export type SelfReportResult = z.infer<typeof SelfReportResultSchema>;

/**
 * Output schema for praxis_calibrate_batch.
 */
export const BatchCalibrationResultSchema = z.object({
  results: z.array(CalibrationResultSchema),
  aggregate_calibration: z.number().min(0.0).max(1.0),
  systematic_bias_detected: z.string().nullable(),
});

export type BatchCalibrationResult = z.infer<typeof BatchCalibrationResultSchema>;
