/**
 * Calibrate-specific types that extend the shared types.
 *
 * These types are internal to the calibrate package and capture
 * service-level data structures not exposed through MCP tool schemas.
 */

import type {
  CalibrationResult,
  SelfReportResult,
  BatchCalibrationResult,
} from "@praxis-governance/shared";

// Re-export shared types for convenience within the calibrate package
export type {
  CalibrationResult,
  SelfReportResult,
  BatchCalibrationResult,
};

/**
 * Internal domain classification result.
 */
export interface DomainClassification {
  /** The classified domain */
  domain: string;
  /** How well the calibration dataset covers this domain (0.0-1.0) */
  coverage: number;
  /** Whether this is a novel/unknown domain */
  isNovel: boolean;
  /** Human-readable reasoning for the classification */
  reasoning: string;
}

/**
 * Adversarial detection result.
 */
export interface AdversarialAssessment {
  /** Whether gaming patterns were detected */
  flagged: boolean;
  /** Confidence in the adversarial assessment (0.0-1.0) */
  confidence: number;
  /** Type of detected pattern, if any */
  pattern: AdversarialPattern | null;
  /** Human-readable explanation */
  reasoning: string;
}

/**
 * Known adversarial patterns that the detector can identify.
 */
export type AdversarialPattern =
  | "suspicious_calibration"  // Claims always near 0.5 confidence
  | "sudden_improvement"      // Calibration improved without training
  | "confidence_anchoring"    // Anchoring to expected values
  | "process_mismatch"        // Claim structure matches Beta-friendly patterns without genuine uncertainty
  | "repetitive_structure";   // Repeated claim structures suggesting automation

/**
 * Agent calibration history entry.
 * Used by the adversarial detector to track per-agent patterns.
 */
export interface CalibrationHistoryEntry {
  timestamp: string;
  claim_text: string;
  domain: string;
  declared_confidence: number;
  calibrated_confidence: number;
  adversarial_flag: boolean;
}

/**
 * Configuration for the beta-distribution calibration service.
 */
export interface CalibrationConfig {
  /** Minimum calibrated confidence before abstention is recommended */
  abstentionThreshold: number;
  /** Default domain coverage for unknown domains */
  defaultDomainCoverage: number;
  /** Maximum adjustment factor for declared confidence */
  maxAdjustmentFactor: number;
  /** Whether adversarial detection is enabled */
  adversarialDetectionEnabled: boolean;
}

/** Default calibration configuration */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  abstentionThreshold: 0.3,
  defaultDomainCoverage: 0.3,
  maxAdjustmentFactor: 0.4,
  adversarialDetectionEnabled: true,
};
