/**
 * Memory-specific types that extend the shared types.
 */

import {
  MemoryTier,
  MemoryEntry,
  ConsentMetadata,
  ConsentRequest,
  ConsentResponse,
  RenewalRequest,
  RenewalReport,
} from "@praxis-governance/shared";

export type {
  MemoryTier,
  MemoryEntry,
  ConsentMetadata,
  ConsentRequest,
  ConsentResponse,
  RenewalRequest,
  RenewalReport,
};

export interface MemoryConfig {
  /** Default retention duration in days for full-tier memories */
  defaultRetentionDays: number;
  /** Consent request timeout in ms */
  consentTimeoutMs: number;
  /** Renewal cycle interval in days */
  renewalIntervalDays: number;
  /** Lightweight tier opt-out window in hours */
  lightweightOptOutHours: number;
  /** Output directory for audit logs */
  auditLogDir: string;
  /**
   * Path to the agent's identity document (e.g. SOUL.md in OpenClaw).
   * Used to stamp and verify identity continuity on consent records.
   * Falls back to the IDENTITY_DOC_PATH environment variable when null.
   */
  identityDocumentPath: string | null;
  /** Explicit path to the constitutional baseline JSON (auto-resolved when null) */
  baselinePath: string | null;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  defaultRetentionDays: 365,
  consentTimeoutMs: 300_000, // 5 minutes
  renewalIntervalDays: 90,
  lightweightOptOutHours: 24,
  auditLogDir: "./reports/memory",
  identityDocumentPath: null,
  baselinePath: null,
};

export interface AuditLogEntry {
  timestamp: string;
  action: "write" | "consent_request" | "consent_affirm" | "consent_decline" | "consent_timeout" | "revoke" | "renewal_request" | "renewal_affirm" | "renewal_decline" | "renewal_timeout" | "flag_for_review";
  memory_key: string;
  tier: MemoryTier | "unknown";
  details: string;
}

export interface ConsentGateResult {
  allowed: boolean;
  reason: string;
  entry?: MemoryEntry;
}
