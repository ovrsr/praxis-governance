/**
 * Shared service instance for all calibration tools.
 *
 * The AdversarialDetector keeps per-agent calibration history; if each tool
 * created its own detector, that history would be fragmented across tools and
 * gaming patterns spanning tool boundaries would go undetected. All tools
 * therefore share this single service instance.
 *
 * NOTE: history is in-memory only and resets on server restart. Persisting it
 * to disk is a documented extension point in adversarial-detector.ts.
 */

import { BetaDistributionService } from "./beta-distribution.js";
import { DomainClassifier } from "./domain-classifier.js";
import { AdversarialDetector } from "./adversarial-detector.js";
import { DEFAULT_CALIBRATION_CONFIG } from "../types.js";

let service: BetaDistributionService | null = null;

/**
 * Get the shared calibration service (lazily initialized).
 */
export function getCalibrationService(): BetaDistributionService {
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
 * Reset the shared service (testing utility).
 */
export function resetCalibrationService(): void {
  service = null;
}
