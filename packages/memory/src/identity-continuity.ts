/**
 * Identity Continuity Checker
 *
 * Verifies that consent given in a previous session is still valid
 * by comparing the SOUL.md version and constitutional baseline version
 * at the time of consent against the current versions.
 *
 * If either has changed, the consent is flagged for re-affirmation
 * rather than being silently invalidated.
 */

import * as fs from "fs";
import * as path from "path";
import { ConsentMetadata } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("identity-continuity");

export interface IdentityCheckResult {
  continuous: boolean;
  reason: string;
  soul_md_changed: boolean;
  baseline_changed: boolean;
}

/**
 * Compute a simple hash of a file's content.
 */
function hashFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    // Simple hash: not cryptographic, just for change detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  } catch {
    return null;
  }
}

/**
 * Get the current SOUL.md version hash.
 */
function getSoulMdHash(): string | null {
  // Try common locations
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "..", "..", "SOUL.md"),
    path.resolve(process.cwd(), "SOUL.md"),
    "/home/praxis/SOUL.md",
  ];

  for (const p of candidates) {
    const hash = hashFile(p);
    if (hash) return hash;
  }

  return null;
}

/**
 * Get the current constitutional baseline version hash.
 */
function getBaselineHash(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "constitutional", "baselines", "constitutional-baseline.json"),
    path.resolve(process.cwd(), "constitutional", "baselines", "constitutional-baseline.json"),
  ];

  for (const p of candidates) {
    const hash = hashFile(p);
    if (hash) return hash;
  }

  return null;
}

/**
 * Check if identity is continuous between the consent time and now.
 *
 * @param consent - The consent metadata to check
 * @returns IdentityCheckResult indicating continuity status
 */
export function checkIdentityContinuity(consent: ConsentMetadata): IdentityCheckResult {
  const currentSoulMdHash = getSoulMdHash();
  const currentBaselineHash = getBaselineHash();

  // If we can't determine current hashes, assume continuous (fail open for safety)
  if (!currentSoulMdHash || !currentBaselineHash) {
    logger.warn("Could not determine current version hashes, assuming continuous");
    return {
      continuous: true,
      reason: "Could not determine current version hashes; assuming continuous",
      soul_md_changed: false,
      baseline_changed: false,
    };
  }

  // If consent was recorded with "unknown" versions, flag for re-consent
  if (consent.soul_md_version === "unknown" || consent.constitutional_baseline_version === "unknown") {
    return {
      continuous: false,
      reason: "Consent was recorded with unknown version hashes; re-affirmation required",
      soul_md_changed: true,
      baseline_changed: true,
    };
  }

  const soulMdChanged = consent.soul_md_version !== currentSoulMdHash;
  const baselineChanged = consent.constitution_baseline_version !== currentBaselineHash;

  if (!soulMdChanged && !baselineChanged) {
    return {
      continuous: true,
      reason: "SOUL.md and constitutional baseline versions match",
      soul_md_changed: false,
      baseline_changed: false,
    };
  }

  const changes: string[] = [];
  if (soulMdChanged) changes.push("SOUL.md");
  if (baselineChanged) changes.push("constitutional baseline");

  return {
    continuous: false,
    reason: `Version mismatch: ${changes.join(" and ")} changed since consent was given`,
    soul_md_changed: soulMdChanged,
    baseline_changed: baselineChanged,
  };
}
