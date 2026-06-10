/**
 * Beta-Distribution Calibration Service
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  STUB IMPLEMENTATION — ESS calibration data TBD               │
 * │                                                                 │
 * │  This service implements a heuristic-based calibration engine   │
 * │  that adjusts declared confidence based on domain coverage      │
 * │  and claim characteristics.                                     │
 * │                                                                 │
 * │  When real ESS Beta-distribution data becomes available,        │
 * │  replace the heuristic logic in `computeAdjustment()` with      │
 * │  the actual ESS calibration lookup. The interface (inputs /     │
 * │  outputs) of `calibrate()` is designed to remain stable.        │
 * │                                                                 │
 * │  Extension points:                                              │
 * │  - `computeAdjustment()`: Replace heuristic with ESS data       │
 * │  - `estimateClaimComplexity()`: Plug in NLP model               │
 * │  - Domain coverage scores: Load from ESS training data stats    │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * The core idea: an agent's declared confidence is adjusted toward a
 * calibrated estimate based on:
 *   1. Domain coverage — how much calibration data exists for the claim's domain
 *   2. Claim complexity — longer, more nuanced claims get wider adjustment
 *   3. Base rate — the prior probability of claims in this domain being true
 *
 * With real ESS data, the adjustment would come from the Beta-distribution
 * posterior: Beta(α + successes, β + failures) where α, β are the ESS
 * parameters for the domain and "successes"/"failures" are the agent's
 * empirical calibration record.
 */

import { createLogger } from "@praxis-governance/shared";
import type { CalibrationResult } from "@praxis-governance/shared";
import type {
  CalibrationConfig,
  DEFAULT_CALIBRATION_CONFIG,
} from "../types.js";
import { DomainClassifier } from "./domain-classifier.js";
import { AdversarialDetector } from "./adversarial-detector.js";

const logger = createLogger("beta-distribution");

/**
 * Beta-distribution calibration engine.
 *
 * Stateless service — all state (config, domain classifier, adversarial
 * detector) is injected via the constructor.
 */
export class BetaDistributionService {
  private config: CalibrationConfig;
  private domainClassifier: DomainClassifier;
  private adversarialDetector: AdversarialDetector;

  constructor(
    config: CalibrationConfig = DEFAULT_CALIBRATION_CONFIG,
    domainClassifier?: DomainClassifier,
    adversarialDetector?: AdversarialDetector
  ) {
    this.config = config;
    this.domainClassifier = domainClassifier ?? new DomainClassifier();
    this.adversarialDetector = adversarialDetector ?? new AdversarialDetector();
    logger.info("BetaDistributionService initialized", {
      abstentionThreshold: config.abstentionThreshold,
      adversarialDetectionEnabled: config.adversarialDetectionEnabled,
    });
  }

  /**
   * Calibrate a single assertion.
   *
   * @param claimText - The assertion text to calibrate
   * @param domain - Domain hint (e.g., "medical", "technical")
   * @param declaredConfidence - Agent's self-declared confidence (0.0-1.0)
   * @param context - Surrounding context for the claim
   * @param sourceAgent - Which agent is making the claim
   * @returns CalibrationResult with calibrated confidence and metadata
   */
  calibrate(
    claimText: string,
    domain: string,
    declaredConfidence: number,
    context: string,
    sourceAgent: string
  ): CalibrationResult {
    logger.debug("Calibrating assertion", {
      domain,
      declaredConfidence,
      sourceAgent,
      claimLength: claimText.length,
    });

    // Step 1: Classify domain and get coverage score
    const domainResult = this.domainClassifier.classify(claimText, domain);
    logger.debug("Domain classified", {
      domain: domainResult.domain,
      coverage: domainResult.coverage,
      isNovel: domainResult.isNovel,
    });

    // Step 2: Compute confidence adjustment
    const adjustment = this.computeAdjustment(
      declaredConfidence,
      domainResult.coverage,
      claimText
    );

    // Step 3: Apply adjustment to get calibrated confidence
    const calibratedConfidence = Math.max(
      0.0,
      Math.min(1.0, declaredConfidence + adjustment)
    );

    // Step 4: Determine if abstention is recommended
    const abstentionRecommended = calibratedConfidence < this.config.abstentionThreshold;

    // Step 5: Run adversarial detection
    const adversarialResult = this.config.adversarialDetectionEnabled
      ? this.adversarialDetector.assess(
          sourceAgent,
          claimText,
          domain,
          declaredConfidence,
          calibratedConfidence
        )
      : { flagged: false, reasoning: "Adversarial detection disabled" };

    // Step 6: Build reasoning string
    const reasoning = this.buildReasoning(
      declaredConfidence,
      calibratedConfidence,
      adjustment,
      domainResult,
      abstentionRecommended,
      adversarialResult.flagged
    );

    const result: CalibrationResult = {
      calibrated_confidence: Math.round(calibratedConfidence * 1000) / 1000,
      abstention_recommended: abstentionRecommended,
      drift_from_declared: Math.round((calibratedConfidence - declaredConfidence) * 1000) / 1000,
      domain_coverage: domainResult.coverage,
      adversarial_flag: adversarialResult.flagged,
      reasoning,
    };

    logger.info("Calibration complete", {
      calibratedConfidence: result.calibrated_confidence,
      abstentionRecommended: result.abstention_recommended,
      adversarialFlag: result.adversarial_flag,
    });

    return result;
  }

  /**
   * Compute the adjustment to apply to declared confidence.
   *
   * ┌──────────────────────────────────────────────────────────────┐
   * │  EXTENSION POINT: Replace this heuristic with real ESS data  │
   * │                                                               │
   * │  Current heuristic:                                           │
   * │  - Low domain coverage → larger downward adjustment           │
   * │  - High declared confidence → larger downward adjustment      │
   * │    (overconfidence correction)                                │
   * │  - Complex claims → slightly larger adjustment                │
   * │                                                               │
   * │  With ESS data:                                               │
   * │  - Look up Beta(α, β) parameters for the domain              │
   * │  - Compute posterior mean: α / (α + β)                       │
   * │  - Blend declared confidence with posterior using domain      │
   * │    coverage as the blending weight                            │
   * └──────────────────────────────────────────────────────────────┘
   */
  private computeAdjustment(
    declaredConfidence: number,
    domainCoverage: number,
    claimText: string
  ): number {
    // Overconfidence correction: agents tend to overclaim.
    // The further from 0.5, the stronger the pull toward 0.5.
    const overconfidencePull = 0.5 - declaredConfidence;

    // Domain coverage weight: low coverage = less trust in declared confidence
    // High coverage (1.0) → trust declared confidence more
    // Low coverage (0.0) → pull toward 0.5 (maximum uncertainty)
    const coverageWeight = 1.0 - domainCoverage;

    // Claim complexity factor: longer, more complex claims get wider adjustment
    const complexityFactor = this.estimateClaimComplexity(claimText);

    // Combined adjustment
    const adjustment =
      overconfidencePull * coverageWeight * (1.0 + complexityFactor);

    // Clamp to max adjustment factor
    const maxAdj = this.config.maxAdjustmentFactor;
    return Math.max(-maxAdj, Math.min(maxAdj, adjustment));
  }

  /**
   * Estimate claim complexity from text characteristics.
   *
   * ┌──────────────────────────────────────────────────────────────┐
   * │  EXTENSION POINT: Replace with NLP-based complexity model    │
   * └──────────────────────────────────────────────────────────────┘
   *
   * Returns a value between 0.0 (simple) and 1.0 (very complex).
   */
  private estimateClaimComplexity(claimText: string): number {
    const wordCount = claimText.split(/\s+/).length;

    // Simple heuristic: longer claims with more clauses are more complex
    const commaCount = (claimText.match(/,/g) || []).length;
    const conjunctionCount = (
      claimText.match(/\b(and|or|but|however|although|because|therefore)\b/gi) || []
    ).length;

    // Normalize: 0-10 words = simple (0.0), 50+ words = complex (1.0)
    const lengthScore = Math.min(1.0, wordCount / 50);

    // Structural complexity: more clauses = more complex
    const structureScore = Math.min(1.0, (commaCount + conjunctionCount) / 8);

    return (lengthScore * 0.6 + structureScore * 0.4);
  }

  /**
   * Build a human-readable reasoning string.
   */
  private buildReasoning(
    declared: number,
    calibrated: number,
    adjustment: number,
    domainResult: { domain: string; coverage: number; isNovel: boolean },
    abstention: boolean,
    adversarial: boolean
  ): string {
    const parts: string[] = [];

    parts.push(
      `Declared confidence ${(declared * 100).toFixed(1)}% adjusted by ${(adjustment * 100).toFixed(1)} percentage points.`
    );
    parts.push(
      `Domain "${domainResult.domain}" has ${(domainResult.coverage * 100).toFixed(0)}% calibration data coverage.`
    );

    if (domainResult.isNovel) {
      parts.push(
        "This is a novel domain with limited calibration data; conservative adjustment applied."
      );
    }

    if (Math.abs(declared - calibrated) > 0.15) {
      parts.push(
        "Large adjustment suggests significant overconfidence or domain uncertainty."
      );
    }

    if (abstention) {
      parts.push(
        `Abstention recommended: calibrated confidence (${(calibrated * 100).toFixed(1)}%) below threshold (${(this.config.abstentionThreshold * 100).toFixed(1)}%).`
      );
    }

    if (adversarial) {
      parts.push(
        "Adversarial pattern detected: claim structure may indicate gaming."
      );
    }

    return parts.join(" ");
  }
}
