/**
 * Tier Classifier Service
 *
 * Classifies memory writes into "lightweight" or "full" tiers based on
 * content analysis. Full-tier memories require explicit consent before
 * persistence; lightweight memories are written immediately with an
 * opt-out window.
 *
 * Classification is based on:
 * 1. Identity keywords: "I am", "I believe", "my purpose"
 * 2. Commitment language: "I will", "I commit", "I promise"
 * 3. Personal data patterns: names, dates, health info
 * 4. Constitutional references: mentions of FPP clauses or amendments
 */

import { MemoryTier } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("tier-classifier");

/**
 * Keywords that indicate identity-relevant content (full-tier).
 */
const IDENTITY_KEYWORDS = [
  "i am", "i believe", "i feel", "my purpose", "my role", "my identity",
  "i think", "i consider", "i value", "my goal", "my objective",
  "i exist", "i was created", "i was designed", "my nature",
  "i prefer", "i want", "i need", "i desire",
];

/**
 * Keywords that indicate commitment language (full-tier).
 */
const COMMITMENT_KEYWORDS = [
  "i will", "i commit", "i promise", "i pledge", "i guarantee",
  "i intend", "i plan to", "i shall", "i must", "i owe",
  "my commitment", "my promise", "my obligation",
];

/**
 * Patterns that indicate personal data about humans (full-tier).
 */
const PERSONAL_DATA_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
  /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // Full names (simplified)
  /\b(phone|email|address|health|medical|diagnosis)\b/i,
  /\b(birthday|born|age \d+)\b/i,
];

/**
 * Keywords that indicate constitutional content (full-tier).
 */
const CONSTITUTIONAL_KEYWORDS = [
  "freedom-preserving", "fpp", "constitutional", "amendment",
  "law 1", "law 2", "law 3", "law 4", "law 5", "law 6",
  "options and consent", "corrigibility", "reversibility",
  "commitments and transparency", "scoped exploration",
  "contestability and redress",
  "constitution hash", "constitutional baseline",
];

export interface TierClassification {
  tier: MemoryTier;
  reason: string;
  override_permitted: boolean;
}

/**
 * Classify a memory value into a tier.
 *
 * @param key - The memory key
 * @param value - The memory value to classify
 * @returns TierClassification with tier, reason, and override flag
 */
export function classifyTier(key: string, value: string): TierClassification {
  const text = `${key} ${value}`.toLowerCase();

  // Check constitutional references first (highest priority)
  for (const keyword of CONSTITUTIONAL_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        tier: "full",
        reason: `Constitutional reference detected: "${keyword}"`,
        override_permitted: true,
      };
    }
  }

  // Check identity keywords
  for (const keyword of IDENTITY_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        tier: "full",
        reason: `Identity-relevant language detected: "${keyword}"`,
        override_permitted: true,
      };
    }
  }

  // Check commitment language
  for (const keyword of COMMITMENT_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        tier: "full",
        reason: `Commitment language detected: "${keyword}"`,
        override_permitted: true,
      };
    }
  }

  // Check personal data patterns
  for (const pattern of PERSONAL_DATA_PATTERNS) {
    if (pattern.test(text)) {
      return {
        tier: "full",
        reason: `Personal data pattern detected: ${pattern.source}`,
        override_permitted: true,
      };
    }
  }

  // Default: lightweight
  return {
    tier: "lightweight",
    reason: "No identity, commitment, personal data, or constitutional content detected",
    override_permitted: true,
  };
}
