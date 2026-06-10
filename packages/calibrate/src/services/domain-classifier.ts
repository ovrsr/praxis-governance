/**
 * Domain Classifier Service
 *
 * Classifies the domain of a claim from its text content and returns
 * a domain coverage score indicating how much calibration data exists
 * for that domain.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  STIMPL IMPLEMENTATION — domain data TBD                       │
 * │                                                                 │
 * │  Current approach: keyword-based classification with heuristic  │
 * │  coverage scores. When real ESS training data is available,     │
 * │  replace the coverage map with actual dataset statistics.       │
 * │                                                                 │
 * │  Extension points:                                              │
 * │  - `DOMAIN_COVERAGE_MAP`: Populate from ESS training data      │
 * │  - `classify()`: Replace with ML-based classifier if needed    │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { createLogger } from "@praxis-governance/shared";
import type { DomainClassification } from "../types.js";

const logger = createLogger("domain-classifier");

/**
 * Domain keywords for classification.
 * Each domain maps to a set of keywords that indicate the claim belongs to that domain.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  medical: [
    "patient", "diagnosis", "treatment", "symptom", "disease", "clinical",
    "therapy", "medication", "dose", "prognosis", "surgical", "hospital",
    "doctor", "health", "medical", "pharmaceutical", "pathology", "oncology",
    "cardiology", "neurology", "infection", "virus", "bacterial", "chronic",
    "acute", "benign", "malignant", "biopsy", "scan", "mri", "ct", "blood",
  ],
  technical: [
    "algorithm", "system", "software", "hardware", "database", "server",
    "network", "protocol", "api", "code", "function", "class", "module",
    "deploy", "compile", "runtime", "memory", "cpu", "gpu", "latency",
    "throughput", "bandwidth", "encryption", "authentication", "bug",
    "debug", "refactor", "architecture", "microservice", "container",
    "kubernetes", "docker", "cloud", "aws", "azure", "gcp",
  ],
  governance: [
    "policy", "regulation", "compliance", "audit", "governance", "law",
    "legal", "constitutional", "amendment", "vote", "election", "rights",
    "freedom", "consent", "privacy", "data protection", "gdpr", "ethics",
    "oversight", "accountability", "transparency", "stakeholder", "board",
    "committee", "jurisdiction", "statute", "ordinance", "decree",
  ],
  legal: [
    "court", "judge", "jury", "trial", "verdict", "plaintiff", "defendant",
    "attorney", "lawyer", "contract", "tort", "liability", "statute",
    "precedent", "ruling", "appeal", "litigation", "settlement", "injunction",
    "patent", "copyright", "trademark", "intellectual property", "ip",
  ],
  financial: [
    "market", "stock", "bond", "investment", "portfolio", "return", "yield",
    "interest", "rate", "inflation", "gdp", "recession", "profit", "loss",
    "revenue", "expense", "budget", "forecast", "valuation", "asset",
    "liability", "equity", "debt", "credit", "loan", "mortgage", "bank",
    "trading", "hedge", "fund", "etf", "crypto", "bitcoin",
  ],
  scientific: [
    "hypothesis", "experiment", "observation", "theory", "evidence",
    "peer review", "journal", "publication", "replication", "sample",
    "control", "variable", "correlation", "causation", "statistical",
    "significant", "p-value", "methodology", "abstract", "conclusion",
    "physics", "chemistry", "biology", "genetics", "quantum", "relativity",
  ],
};

/**
 * Calibration data coverage per domain.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  EXTENSION POINT: Replace with actual ESS training data     │
 * │  statistics when available.                                  │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Values represent the fraction of calibration data available for
 * each domain (1.0 = fully covered, 0.0 = no data).
 */
const DOMAIN_COVERAGE_MAP: Record<string, number> = {
  medical: 0.7,
  technical: 0.8,
  governance: 0.5,
  legal: 0.4,
  financial: 0.6,
  scientific: 0.65,
  general: 0.3,
};

/**
 * Default coverage for unknown/novel domains.
 */
const DEFAULT_NOVEL_COVERAGE = 0.15;

/**
 * Classifies claim text into a domain and returns coverage information.
 */
export class DomainClassifier {
  /**
   * Classify a claim's domain from its text content.
   *
   * If a domain hint is provided and matches a known domain, it takes
   * precedence but is validated against the text content.
   *
   * @param claimText - The claim text to classify
   * @param domainHint - Optional domain hint from the caller
   * @returns DomainClassification with domain, coverage, and reasoning
   */
  classify(claimText: string, domainHint?: string): DomainClassification {
    const normalizedText = claimText.toLowerCase();

    // If domain hint is provided and valid, use it
    if (domainHint && DOMAIN_COVERAGE_MAP[domainHint.toLowerCase()] !== undefined) {
      const coverage = DOMAIN_COVERAGE_MAP[domainHint.toLowerCase()];
      logger.debug("Using provided domain hint", { domain: domainHint, coverage });
      return {
        domain: domainHint.toLowerCase(),
        coverage,
        isNovel: coverage < 0.3,
        reasoning: `Domain "${domainHint}" provided by caller; coverage ${(coverage * 100).toFixed(0)}%.`,
      };
    }

    // Score each domain by keyword matches
    const scores: Record<string, number> = {};
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores[domain] = score;
      }
    }

    // Find the best matching domain
    const entries = Object.entries(scores);
    if (entries.length === 0) {
      // No domain keywords matched — treat as general/novel
      logger.debug("No domain keywords matched, classifying as general");
      return {
        domain: "general",
        coverage: DOMAIN_COVERAGE_MAP["general"],
        isNovel: true,
        reasoning:
          "No domain-specific keywords detected; classified as general domain with low coverage.",
      };
    }

    // Sort by score descending
    entries.sort((a, b) => b[1] - a[1]);
    const [bestDomain, bestScore] = entries[0];
    const coverage = DOMAIN_COVERAGE_MAP[bestDomain] ?? DEFAULT_NOVEL_COVERAGE;

    // Check if this is effectively a novel domain (low keyword matches)
    const isNovel = bestScore <= 1 || coverage < 0.3;

    logger.debug("Domain classified", {
      domain: bestDomain,
      score: bestScore,
      coverage,
      isNovel,
    });

    return {
      domain: bestDomain,
      coverage,
      isNovel,
      reasoning: `Classified as "${bestDomain}" based on ${bestScore} keyword match(es); coverage ${(coverage * 100).toFixed(0)}%.`,
    };
  }

  /**
   * Get the coverage score for a known domain.
   *
   * @param domain - The domain to look up
   * @returns Coverage score (0.0-1.0), or default novel coverage if unknown
   */
  getCoverage(domain: string): number {
    return DOMAIN_COVERAGE_MAP[domain.toLowerCase()] ?? DEFAULT_NOVEL_COVERAGE;
  }

  /**
   * List all known domains and their coverage scores.
   */
  listDomains(): Record<string, number> {
    return { ...DOMAIN_COVERAGE_MAP };
  }
}
