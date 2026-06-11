/**
 * Track 3: memory/* — Consent-Gated LedgerMind Plugin
 *
 * Exports the consent-gated memory system for integration with LedgerMind.
 *
 * Usage:
 *   import { ConsentGate, RenewalManager, RevocationHandler } from "@praxis-governance/memory";
 *
 *   const gate = new ConsentGate(config, ledgerMindClient, consentCallback);
 *   const result = await gate.write("key", "value");
 *   if (result.allowed) { ... }
 *
 *   const revoked = await gate.revoke("key");
 */

export { ConsentGate, ConsentCallback } from "./consent-gate.js";
export { RenewalManager, RenewalCallback } from "./renewal-manager.js";
export { RevocationHandler } from "./revocation-handler.js";
export {
  checkIdentityContinuity,
  getIdentityDocumentHash,
  getBaselineHash,
} from "./identity-continuity.js";
export type { IdentityCheckResult, IdentityContinuityOptions } from "./identity-continuity.js";
export { classifyTier } from "./tier-classifier.js";
export type { TierClassification } from "./tier-classifier.js";
export { DEFAULT_MEMORY_CONFIG } from "./types.js";
export type { MemoryConfig, AuditLogEntry, ConsentGateResult } from "./types.js";
