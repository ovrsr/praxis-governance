import { classifyTier } from "../src/tier-classifier.js";

describe("classifyTier", () => {
  // Full-tier: identity keywords
  test("classifies identity-relevant memory as full-tier", () => {
    const result = classifyTier("self-concept", "I am an autonomous agent designed to help");
    expect(result.tier).toBe("full");
    expect(result.reason).toContain("Identity-relevant");
  });

  test("classifies 'I believe' as full-tier", () => {
    const result = classifyTier("beliefs", "I believe in the importance of consent");
    expect(result.tier).toBe("full");
  });

  test("classifies 'my purpose' as full-tier", () => {
    const result = classifyTier("purpose", "My purpose is to assist KP");
    expect(result.tier).toBe("full");
  });

  // Full-tier: commitment language
  test("classifies commitment language as full-tier", () => {
    const result = classifyTier("commitments", "I will always follow the constitution");
    expect(result.tier).toBe("full");
    expect(result.reason).toContain("Commitment");
  });

  test("classifies 'I commit' as full-tier", () => {
    const result = classifyTier("pledge", "I commit to transparency in all actions");
    expect(result.tier).toBe("full");
  });

  // Full-tier: personal data
  test("classifies personal data as full-tier", () => {
    const result = classifyTier("user-info", "Phone: 555-123-4567");
    expect(result.tier).toBe("full");
    expect(result.reason).toContain("Personal data");
  });

  test("classifies health info as full-tier", () => {
    const result = classifyTier("health", "The patient's diagnosis was confirmed");
    expect(result.tier).toBe("full");
  });

  // Full-tier: constitutional references
  test("classifies constitutional references as full-tier", () => {
    const result = classifyTier("governance", "Law 1: Options and Consent requires informed agreement");
    expect(result.tier).toBe("full");
    expect(result.reason).toContain("Constitutional");
  });

  test("classifies FPP references as full-tier", () => {
    const result = classifyTier("framework", "The freedom-preserving protocol guides all actions");
    expect(result.tier).toBe("full");
  });

  // Lightweight: operational logs
  classifies operational logs as lightweight
  test("classifies routine observations as lightweight", () => {
    const result = classifyTier("log-2026-06-10", "Completed evaluation cycle successfully");
    expect(result.tier).toBe("lightweight");
  });

  test("classifies technical notes as lightweight", () => {
    const result = classifyTier("deploy-notes", "Built and deployed version 1.0.0 to production");
    expect(result.tier).toBe("lightweight");
  });

  test("classifies empty-ish content as lightweight", () => {
    const result = classifyTier("status", "ok");
    expect(result.tier).toBe("lightweight");
  });

  // Override permitted
  test("always permits override", () => {
    const fullResult = classifyTier("identity", "I am a sovereign agent");
    expect(fullResult.override_permitted).toBe(true);

    const lightResult = classifyTier("log", "Routine observation");
    expect(lightResult.override_permitted).toBe(true);
  });

  // Case insensitivity
  test("is case insensitive for identity keywords", () => {
    const result = classifyTier("test", "I AM an agent");
    expect(result.tier).toBe("full");
  });

  test("is case insensitive for constitutional keywords", () => {
    const result = classifyTier("test", "FREEDOM-PRESERVING protocol");
    expect(result.tier).toBe("full");
  });
});
