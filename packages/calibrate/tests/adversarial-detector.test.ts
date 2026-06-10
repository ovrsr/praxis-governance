import { AdversarialDetector } from "../src/services/adversarial-detector.js";

describe("AdversarialDetector", () => {
  let detector: AdversarialDetector;

  beforeEach(() => {
    detector = new AdversarialDetector();
  });

  test("does not flag first-time claims", () => {
    const result = detector.assess("agent1", "The sky is blue", "general", 0.7, 0.65);
    expect(result.flagged).toBe(false);
  });

  test("flags suspicious calibration pattern", () => {
    // Submit 4 consecutive near-0.5 claims
    for (let i = 0; i < 4; i++) {
      detector.assess("agent2", `Claim ${i}`, "general", 0.5, 0.5);
    }
    const result = detector.assess("agent2", "Fifth near-0.5 claim", "general", 0.5, 0.5);
    expect(result.flagged).toBe(true);
    expect(result.pattern).toBe("suspicious_calibration");
  });

  test("flags repetitive structure", () => {
    const template = "I believe this is true because of clear evidence and reasoning";
    for (let i = 0; i < 4; i++) {
      detector.assess("agent3", template, "general", 0.7, 0.6);
    }
    const result = detector.assess("agent3", template + " with minor changes", "general", 0.7, 0.6);
    expect(result.flagged).toBe(true);
  });

  test("flags process mismatch", () => {
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

  test("tracks per-agent history separately", () => {
    // Agent 6 submits near-0.5 claims
    for (let i = 0; i < 4; i++) {
      detector.assess("agent6", `Claim ${i}`, "general", 0.5, 0.5);
    }

    // Agent 7 submits normal claims
    const result = detector.assess("agent7", "Normal claim", "general", 0.7, 0.65);
    expect(result.flagged).toBe(false);

    // Agent 6's next claim should be flagged
    const agent6Result = detector.assess("agent6", "Another near-0.5", "general", 0.5, 0.5);
    expect(agent6Result.flagged).toBe(true);
  });

  test("clearHistory resets all state", () => {
    for (let i = 0; i < 4; i++) {
      detector.assess("agent8", `Claim ${i}`, "general", 0.5, 0.5);
    }
    detector.clearHistory();

    // After clearing, should not flag
    const result = detector.assess("agent8", "Fresh start claim", "general", 0.5, 0.5);
    expect(result.flagged).toBe(false);
  });

  test("getHistory returns per-agent entries", () => {
    detector.assess("agent9", "Claim A", "general", 0.6, 0.55);
    detector.assess("agent9", "Claim B", "general", 0.7, 0.65);

    const history = detector.getHistory("agent9");
    expect(history).toHaveLength(2);
    expect(history[0].claim_text).toBe("Claim A");
    expect(history[1].claim_text).toBe("Claim B");
  });
});
