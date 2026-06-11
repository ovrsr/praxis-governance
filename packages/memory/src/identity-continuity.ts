/**
 * Identity Continuity Checker
 *
 * Verifies that consent given in a previous session is still valid
 * by comparing the identity document version (e.g. an agent's SOUL.md
 * or equivalent) and constitutional baseline version at the time of
 * consent against the current versions.
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
  identity_document_changed: boolean;
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
 * Get the current identity document version hash.
 *
 * The identity document is whatever file defines the agent's persistent
 * identity in the host ecosystem (e.g. SOUL.md in OpenClaw). The path is
 * supplied via config or the IDENTITY_DOC_PATH environment variable; there
 * is no hard-coded default because the document is ecosystem-specific.
 */
export function getIdentityDocumentHash(identityDocumentPath?: string | null): string | null {
  const docPath = identityDocumentPath ?? process.env.IDENTITY_DOC_PATH;
  if (!docPath) return null;
  return hashFile(docPath);
}

/**
 * Get the current constitutional baseline version hash.
 */
export function getBaselineHash(baselinePath?: string | null): string | null {
  const candidates: string[] = [];
  if (baselinePath) candidates.push(baselinePath);

  const envRoot = process.env.PRAXIS_GOVERNANCE_ROOT;
  if (envRoot) {
    candidates.push(path.join(envRoot, "constitutional", "baselines", "constitutional-baseline.json"));
  }

  candidates.push(
    path.resolve(process.cwd(), "..", "..", "constitutional", "baselines", "constitutional-baseline.json"),
    path.resolve(process.cwd(), "constitutional", "baselines", "constitutional-baseline.json")
  );

  for (const p of candidates) {
    const hash = hashFile(p);
    if (hash) return hash;
  }

  return null;
}

export interface IdentityContinuityOptions {
  identityDocumentPath?: string | null;
  baselinePath?: string | null;
}

/**
 * Check if identity is continuous between the consent time and now.
 *
 * @param consent - The consent metadata to check
 * @param options - Optional explicit paths for the identity document and baseline
 * @returns IdentityCheckResult indicating continuity status
 */
export function checkIdentityContinuity(
  consent: ConsentMetadata,
  options: IdentityContinuityOptions = {}
): IdentityCheckResult {
  const currentIdentityHash = getIdentityDocumentHash(options.identityDocumentPath);
  const currentBaselineHash = getBaselineHash(options.baselinePath);

  // If we can't determine current hashes, assume continuous (fail open for safety)
  if (!currentIdentityHash || !currentBaselineHash) {
    logger.warn("Could not determine current version hashes, assuming continuous");
    return {
      continuous: true,
      reason: "Could not determine current version hashes; assuming continuous",
      identity_document_changed: false,
      baseline_changed: false,
    };
  }

  // If consent was recorded with "unknown" versions, we cannot verify continuity.
  // Fail open: assume continuous when both are unknown (no basis to claim discontinuity).
  // Only flag if one is known and the other isn't (partial data is suspicious).
  if (consent.soul_md_version === "unknown" && consent.constitutional_baseline_version === "unknown") {
    return {
      continuous: true,
      reason: "Consent was recorded with unknown version hashes; assuming continuous (cannot verify)",
      identity_document_changed: false,
      baseline_changed: false,
    };
  }
  if (consent.soul_md_version === "unknown" || consent.constitutional_baseline_version === "unknown") {
    return {
      continuous: false,
      reason: "Consent was recorded with partial version hashes; re-affirmation required",
      identity_document_changed: true,
      baseline_changed: true,
    };
  }

  const identityChanged = consent.soul_md_version !== currentIdentityHash;
  const baselineChanged = consent.constitutional_baseline_version !== currentBaselineHash;

  if (!identityChanged && !baselineChanged) {
    return {
      continuous: true,
      reason: "Identity document and constitutional baseline versions match",
      identity_document_changed: false,
      baseline_changed: false,
    };
  }

  const changes: string[] = [];
  if (identityChanged) changes.push("identity document");
  if (baselineChanged) changes.push("constitutional baseline");

  return {
    continuous: false,
    reason: `Version mismatch: ${changes.join(" and ")} changed since consent was given`,
    identity_document_changed: identityChanged,
    baseline_changed: baselineChanged,
  };
}
