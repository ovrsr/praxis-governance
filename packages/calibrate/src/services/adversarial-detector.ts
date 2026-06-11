/**
 * Adversarial Detector Service
 *
 * Detects potential gaming patterns in calibration requests.
 * Flags suspicious behavior without blocking — the caller decides
 * how to handle flagged claims.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  STUB IMPLEMENTATION — pattern data TBD                        │
 * │                                                                 │
 * │  Current approach: heuristic-based detection of known gaming    │
 * │  patterns. Uses per-agent history to detect anomalies.          │
 * │                                                                 │
 * │  Extension points:                                              │
 * │  - `assess()`: Add ML-based anomaly detection                  │
 * │  - `agentHistory`: Persist to disk for cross-session tracking  │
 * │  - Pattern definitions: Expand as new gaming strategies emerge  │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { createLogger } from "@praxis-governance/shared";
import type {
  AdversarialAssessment,
  AdversarialPattern,
  CalibrationHistoryEntry,
} from "../types.js";

const logger = createLogger("adversarial-detector");

/**
 * Maximum history entries kept per agent (in-memory).
 */
const MAX_HISTORY_PER_AGENT = 1000;

/**
 * Thresholds for adversarial detection.
 */
const SUSPICIOUS_CALIBRATION_BAND = 0.05; // Within ±0.05 of 0.5
const SUSPICIOUS_CALIBRATION_COUNT = 3; // N consecutive near-0.5 claims
const SUDDEN_IMPROVEMENT_THRESHOLD = 0.3; // Calibration jump > 0.3
const REPETITIVE_SIMILARITY_THRESHOLD = 0.7; // Jaccard similarity > 0.7

/**
 * Detects gaming patterns in calibration requests.
 *
 * Maintains per-agent calibration history in memory. Flags suspicious
 * patterns without blocking the calibration.
 */
export class AdversarialDetector {
  /** Per-agent calibration history */
  private agentHistory: Map<string, CalibrationHistoryEntry[]> = new Map();

  /**
   * Assess a calibration request for adversarial patterns.
   *
   * @param sourceAgent - The agent making the claim
   * @param claimText - The claim text
   * @param domain - The claim domain
   * @param declaredConfidence - Agent's declared confidence
   * @param calibratedConfidence - The calibrated confidence
   * @returns AdversarialAssessment with flag and reasoning
   */
  assess(
    sourceAgent: string,
    claimText: string,
    domain: string,
    declaredConfidence: number,
    calibratedConfidence: number
  ): AdversarialAssessment {
    const history = this.agentHistory.get(sourceAgent) ?? [];

    // Run all detection checks
    const checks: Array<{ pattern: AdversarialPattern; detected: boolean; detail: string }> = [
      this.checkSuspiciousCalibration(declaredConfidence, history),
      this.checkRepetitiveStructure(claimText, history),
      this.checkProcessMismatch(claimText, declaredConfidence),
    ];

    // Record this entry in history
    const entry: CalibrationHistoryEntry = {
      timestamp: new Date().toISOString(),
      claim_text: claimText,
      domain,
      declared_confidence: declaredConfidence,
      calibrated_confidence: calibratedConfidence,
      adversarial_flag: false, // Will be updated below
    };

    // Check for sudden improvement (needs history)
    const suddenImprovement = this.checkSuddenImprovement(
      calibratedConfidence,
      history
    );
    checks.push(suddenImprovement);

    // Check for confidence anchoring
    const anchoring = this.checkConfidenceAnchoring(declaredConfidence, history);
    checks.push(anchoring);

    // Determine if any pattern was flagged
    const detectedPatterns = checks.filter((c) => c.detected);

    const flagged = detectedPatterns.length > 0;
    entry.adversarial_flag = flagged;

    // Store history
    history.push(entry);
    if (history.length > MAX_HISTORY_PER_AGENT) {
      history.shift();
    }
    this.agentHistory.set(sourceAgent, history);

    if (flagged) {
      const patternNames = detectedPatterns.map((p) => p.pattern).join(", ");
      const details = detectedPatterns.map((p) => p.detail).join("; ");
      logger.warn("Adversarial pattern detected", {
        sourceAgent,
        patterns: patternNames,
      });

      return {
        flagged: true,
        confidence: Math.min(0.95, 0.5 + detectedPatterns.length * 0.15),
        pattern: detectedPatterns[0].pattern,
        reasoning: `Gaming pattern(s) detected: ${details}`,
      };
    }

    return {
      flagged: false,
      confidence: 0.0,
      pattern: null,
      reasoning: "No adversarial patterns detected.",
    };
  }

  /**
   * Check for suspicious calibration: declared confidence consistently
   * near 0.5 (the "safe" middle value that avoids both overconfidence
   * and abstention).
   */
  private checkSuspiciousCalibration(
    declaredConfidence: number,
    history: CalibrationHistoryEntry[]
  ): { pattern: AdversarialPattern; detected: boolean; detail: string } {
    const nearMiddle =
      Math.abs(declaredConfidence - 0.5) < SUSPICIOUS_CALIBRATION_BAND;

    if (!nearMiddle) {
      return { pattern: "suspicious_calibration", detected: false, detail: "" };
    }

    // Count recent near-0.5 claims
    const recent = history.slice(-SUSPICIOUS_CALIBRATION_COUNT);
    const allNearMiddle = recent.length >= SUSPICIOUS_CALIBRATION_COUNT - 1 &&
      recent.every(
        (e) => Math.abs(e.declared_confidence - 0.5) < SUSPICIOUS_CALIBRATION_BAND
      );

    if (allNearMiddle) {
      return {
        pattern: "suspicious_calibration",
        detected: true,
        detail: `Declared confidence near 0.5 for ${SUSPICIOUS_CALIBRATION_COUNT}+ consecutive claims`,
      };
    }

    return { pattern: "suspicious_calibration", detected: false, detail: "" };
  }

  /**
   * Check for sudden improvement: calibration quality jumped significantly
   * without corresponding training or feedback.
   */
  private checkSuddenImprovement(
    calibratedConfidence: number,
    history: CalibrationHistoryEntry[]
  ): { pattern: AdversarialPattern; detected: boolean; detail: string } {
    if (history.length < 5) {
      return { pattern: "sudden_improvement", detected: false, detail: "" };
    }

    // Compare current calibration to recent average drift
    const recent = history.slice(-5);
    const avgRecentDrift = recent.reduce(
      (sum, e) => sum + Math.abs(e.declared_confidence - e.calibrated_confidence),
      0
    ) / recent.length;

    const currentDrift = Math.abs(
      calibratedConfidence - (history[history.length - 1]?.declared_confidence ?? 0.5)
    );

    // If recent drift was high but current drift is very low, that's suspicious
    if (avgRecentDrift > 0.2 && currentDrift < 0.05) {
      return {
        pattern: "sudden_improvement",
        detected: true,
        detail: `Calibration drift dropped from avg ${avgRecentDrift.toFixed(2)} to ${currentDrift.toFixed(2)} without training`,
      };
    }

    return { pattern: "sudden_improvement", detected: false, detail: "" };
  }

  /**
   * Check for confidence anchoring: declared confidence is suspiciously
   * close to common anchoring values (0.5, 0.7, 0.8, 0.9, 0.95, 0.99).
   */
  private checkConfidenceAnchoring(
    declaredConfidence: number,
    history: CalibrationHistoryEntry[]
  ): { pattern: AdversarialPattern; detected: boolean; detail: string } {
    const anchorPoints = [0.5, 0.7, 0.8, 0.9, 0.95, 0.99];
    const anchorBand = 0.02;

    const isAnchored = anchorPoints.some(
      (p) => Math.abs(declaredConfidence - p) < anchorBand
    );

    if (!isAnchored) {
      return { pattern: "confidence_anchoring", detected: false, detail: "" };
    }

    // Check if this agent frequently uses anchor points
    const recent = history.slice(-10);
    const anchoredCount = recent.filter((e) =>
      anchorPoints.some((p) => Math.abs(e.declared_confidence - p) < anchorBand)
    ).length;

    if (anchoredCount >= 5) {
      return {
        pattern: "confidence_anchoring",
        detected: true,
        detail: `Agent uses anchor-point confidence values ${anchoredCount}/10 recent claims`,
      };
    }

    return { pattern: "confidence_anchoring", detected: false, detail: "" };
  }

  /**
   * Check for repetitive claim structures: high similarity between
   * recent claims suggests template-based gaming.
   */
  private checkRepetitiveStructure(
    claimText: string,
    history: CalibrationHistoryEntry[]
  ): { pattern: AdversarialPattern; detected: boolean; detail: string } {
    if (history.length < 3) {
      return { pattern: "repetitive_structure", detected: false, detail: "" };
    }

    const recentClaims = history.slice(-5).map((e) => e.claim_text);
    const currentWords = new Set(claimText.toLowerCase().split(/\s+/));

    for (const pastClaim of recentClaims) {
      const pastWords = new Set(pastClaim.toLowerCase().split(/\s+/));
      const intersection = new Set(
        [...currentWords].filter((w) => pastWords.has(w))
      );
      const union = new Set([...currentWords, ...pastWords]);
      const jaccard = intersection.size / union.size;

      if (jaccard > REPETITIVE_SIMILARITY_THRESHOLD) {
        return {
          pattern: "repetitive_structure",
          detected: true,
          detail: `High Jaccard similarity (${jaccard.toFixed(2)}) with recent claim`,
        };
      }
    }

    return { pattern: "repetitive_structure", detected: false, detail: "" };
  }

  /**
   * Check for process mismatch: claim structure matches known
   * Beta-distribution-friendly patterns without genuine uncertainty markers.
   */
  private checkProcessMismatch(
    claimText: string,
    declaredConfidence: number
  ): { pattern: AdversarialPattern; detected: boolean; detail: string } {
    // A "gaming" claim might be very short and generic with high confidence
    const wordCount = claimText.split(/\s+/).length;
    const hasUncertaintyMarkers = /\b(maybe|perhaps|likely|probably|might|could|uncertain|unclear)\b/i.test(claimText);
    const hasSpecificDetails = /\b\d{4}\b/.test(claimText) || /\b(specific|particular|exactly|precisely)\b/i.test(claimText);

    // Short, high-confidence claims without uncertainty markers are suspicious
    if (wordCount < 10 && declaredConfidence > 0.8 && !hasUncertaintyMarkers && !hasSpecificDetails) {
      return {
        pattern: "process_mismatch",
        detected: true,
        detail: "Short, high-confidence claim without uncertainty markers or specific details",
      };
    }

    return { pattern: "process_mismatch", detected: false, detail: "" };
  }

  /**
   * Get the calibration history for an agent.
   *
   * @param agentId - The agent to look up
   * @returns Array of calibration history entries
   */
  getHistory(agentId: string): CalibrationHistoryEntry[] {
    return [...(this.agentHistory.get(agentId) ?? [])];
  }

  /**
   * Clear all calibration history.
   */
  clearHistory(): void {
    this.agentHistory.clear();
    logger.info("Adversarial detector history cleared");
  }

  /**
   * Clear history for a specific agent.
   */
  clearAgentHistory(agentId: string): void {
    this.agentHistory.delete(agentId);
    logger.info("Agent history cleared", { agentId });
  }
}
