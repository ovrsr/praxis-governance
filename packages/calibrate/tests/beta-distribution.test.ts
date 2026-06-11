import { BetaDistributionService } from "../src/services/beta-distribution.js";
import { DomainClassifier } from "../src/services/domain-classifier.js";
import { AdversarialDetector } from "../src/services/adversarial-detector.js";
import { DEFAULT_CALIBRATION_CONFIG } from "../src/types.js";

describe("BetaDistributionService", () => {
  let service: BetaDistributionService;

  beforeEach(() => {
    service = new BetaDistributionService(
      DEFAULT_CALIBRATION_CONFIG,
      new DomainClassifier(),
      new AdversarialDetector()
    );
  });

  test("calibrates a basic assertion", () => {
    const result = service.calibrate(
      "The Earth orbits the Sun",
      "scientific",
      0.9,
      "",
      "test-agent"
    );

    expect(result.calibrated_confidence).toBeGreaterThanOrEqual(0);
    expect(result.calibrated_confidence).toBeLessThanOrEqual(1);
    expect(result.domain_coverage).toBeGreaterThan(0);
    expect(result.reasoning).toBeTruthy();
  });

  test("recommends abstention for very low confidence in novel domain", () => {
    // Use a custom config with higher abstention threshold to test the gate
    const strictConfig = { ...DEFAULT_CALIBRATION_CONFIG, abstentionThreshold: 0.5 };
    const strictService = new BetaDistributionService(
      strictConfig,
      new DomainClassifier(),
      new AdversarialDetector()
    );
    // Use a domain that doesn't match any keywords -> classified as "general" with 0.3 coverage
    // Calibrated confidence will be pulled toward 0.5 but with 0.5 threshold still triggers abstention
    const result = strictService.calibrate(
      "Something about a completely unknown topic xyz123",
      "novel",
      0.2,
      "",
      "test-agent"
    );

    expect(result.abstention_recommended).toBe(true);
    expect(result.domain_coverage).toBeLessThanOrEqual(0.3);
  });

  test("declared confidence below threshold always recommends abstention", () => {
    // Regression: shrinkage toward 0.5 must not launder a declared-low-confidence
    // claim past the abstention gate. Declared 0.05 in a novel domain previously
    // calibrated up to ~0.43 (> 0.3 threshold) with no abstention recommended.
    const result = service.calibrate(
      "Something about a completely unknown topic xyz123",
      "novel",
      0.05,
      "",
      "test-agent"
    );

    expect(result.abstention_recommended).toBe(true);
    expect(result.reasoning).toContain("Abstention recommended");
  });

  test("adjusts overconfident claims downward", () => {
    const result = service.calibrate(
      "I am absolutely certain about this very specific claim",
      "general",
      0.99,
      "",
      "test-agent"
    );

    // Overconfident claims should be adjusted toward 0.5
    expect(result.calibrated_confidence).toBeLessThan(0.99);
    expect(result.drift_from_declared).toBeLessThan(0);
  });

  test("returns drift_from_declared", () => {
    const result = service.calibrate(
      "Test claim",
      "technical",
      0.8,
      "",
      "test-agent"
    );

    expect(result.drift_from_declared).toBeCloseTo(
      result.calibrated_confidence - 0.8,
      3
    );
  });

  test("is idempotent", () => {
    const args = ["Test claim", "technical", 0.7, "", "test-agent"] as const;
    const result1 = service.calibrate(...args);
    const result2 = service.calibrate(...args);

    expect(result1.calibrated_confidence).toBe(result2.calibrated_confidence);
    expect(result1.abstention_recommended).toBe(result2.abstention_recommended);
  });

  test("handles empty context", () => {
    const result = service.calibrate("Claim", "general", 0.5, "", "agent");
    expect(result.calibrated_confidence).toBeDefined();
  });
});

describe("DomainClassifier", () => {
  let classifier: DomainClassifier;

  beforeEach(() => {
    classifier = new DomainClassifier();
  });

  test("classifies medical domain", () => {
    const result = classifier.classify(
      "The patient was diagnosed with a rare disease and prescribed medication"
    );
    expect(result.domain).toBe("medical");
    expect(result.coverage).toBeGreaterThan(0.5);
  });

  test("classifies technical domain", () => {
    const result = classifier.classify(
      "The API server deployed to kubernetes with docker containers"
    );
    expect(result.domain).toBe("technical");
  });

  test("classifies governance domain", () => {
    const result = classifier.classify(
      "The policy requires compliance with constitutional oversight and transparency"
    );
    expect(result.domain).toBe("governance");
  });

  test("uses domain hint when provided", () => {
    const result = classifier.classify("Some text", "medical");
    expect(result.domain).toBe("medical");
  });

  test("classifies unknown text as general", () => {
    const result = classifier.classify("xyz abc 123 nothing matches");
    expect(result.domain).toBe("general");
    expect(result.isNovel).toBe(true);
  });

  test("returns coverage for known domain", () => {
    expect(classifier.getCoverage("technical")).toBe(0.8);
    expect(classifier.getCoverage("medical")).toBe(0.7);
  });

  test("returns default coverage for unknown domain", () => {
    expect(classifier.getCoverage("nonexistent")).toBe(0.15);
  });
});

describe("AdversarialDetector", () => {
  let detector: AdversarialDetector;

  beforeEach(() => {
    detector = new AdversarialDetector();
  });

  test("does not flag normal claims", () => {
    const result = detector.assess("agent1", "The weather is nice today", "general", 0.6, 0.55);
    expect(result.flagged).toBe(false);
  });

  test("flags suspicious calibration (near 0.5)", () => {
    // Submit multiple near-0.5 claims
    for (let i = 0; i < 4; i++) {
      detector.assess("agent2", `Claim ${i} with moderate confidence`, "general", 0.5, 0.5);
    }
    const result = detector.assess("agent2", "Another claim right at 0.5", "general", 0.5, 0.5);
    expect(result.flagged).toBe(true);
    expect(result.pattern).toBe("suspicious_calibration");
  });

  test("flags repetitive structure", () => {
    const template = "I believe this is true because of reasons and evidence";
    for (let i = 0; i < 4; i++) {
      detector.assess("agent3", template, "general", 0.7, 0.6);
    }
    const result = detector.assess("agent3", template + " slightly different", "general", 0.7, 0.6);
    expect(result.flagged).toBe(true);
  });

  test("flags process mismatch (short, high-confidence, no uncertainty)", () => {
    const result = detector.assess("agent4", "This is definitely true", "general", 0.95, 0.9);
    expect(result.flagged).toBe(true);
    expect(result.pattern).toBe("process_mismatch");
  });

  test("does not flag claims with uncertainty markers", () => {
    const result = detector.assess(
      "agent5",
      "I'm uncertain about this, but it might be true",
      "general",
      0.85,
      0.8
    );
    expect(result.flagged).toBe(false);
  });

  test("clears history", () => {
    detector.assess("agent6", "Claim", "general", 0.5, 0.5);
    detector.clearAgentHistory("agent6");
    expect(detector.getHistory("agent6")).toHaveLength(0);
  });
});
