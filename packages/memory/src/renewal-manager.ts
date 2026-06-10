/**
 * Renewal Manager
 *
 * Manages periodic consent renewal for full-tier memories.
 * Runs on a configurable cycle (default: 90 days).
 *
 * For each stored memory past its renewal date:
 * 1. Check identity continuity
 * 2. If continuous: send renewal request
 * 3. If not continuous: flag for re-consent regardless of age
 * 4. Non-responsive memories are flagged, not deleted
 */

import {
  LedgerMindClient,
  InMemoryLedgerMindTransport,
  MemoryEntry,
  ConsentMetadata,
  RenewalReport,
} from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";
import { MemoryConfig, DEFAULT_MEMORY_CONFIG, AuditLogEntry } from "./types.js";
import { checkIdentityContinuity } from "./identity-continuity.js";

const logger = createLogger("renewal-manager");

export type RenewalCallback = (key: string, value: string, consent: ConsentMetadata, identityContinuous: boolean) => "affirm" | "decline" | "timeout";

export class RenewalManager {
  private config: MemoryConfig;
  private ledgerMind: LedgerMindClient;
  private renewalCallback: RenewalCallback | null = null;
  private auditLog: AuditLogEntry[] = [];

  constructor(
    config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
    ledgerMind?: LedgerMindClient,
    renewalCallback?: RenewalCallback
  ) {
    this.config = config;
    this.ledgerMind = ledgerMind ?? new LedgerMindClient(new InMemoryLedgerMindTransport());
    this.renewalCallback = renewalCallback ?? null;
  }

  setRenewalCallback(callback: RenewalCallback): void {
    this.renewalCallback = callback;
  }

  /**
   * Run the renewal cycle.
   * Checks all stored memories and processes renewals.
   */
  async runRenewalCycle(): Promise<RenewalReport> {
    logger.info("Starting renewal cycle");

    const keys = await this.ledgerMind.list();
    let renewalsSent = 0;
    let renewalsAffirmed = 0;
    let renewalsDeclined = 0;
    let renewalsTimedOut = 0;
    let flaggedForReview = 0;

    for (const key of keys) {
      const entry = await this.ledgerMind.read(key);
      if (!entry) continue;

      const metadata = entry.metadata as unknown as ConsentMetadata | null;
      if (!metadata) continue; // No consent metadata = grandfathered lightweight

      // Only process full-tier memories
      // (lightweight auto-renew unless flagged)
      const isFullTier = this.isFullTier(key, entry.value, metadata);

      if (!isFullTier) {
        // Lightweight: auto-renew unless flagged
        if (metadata.flagged_for_review) {
          flaggedForReview++;
        }
        continue;
      }

      // Check if renewal is due
      const renewalDue = this.isRenewalDue(metadata);
      if (!renewalDue) continue;

      // Check identity continuity
      const identityCheck = checkIdentityContinuity(metadata);

      if (!identityCheck.continuous) {
        // Identity changed — flag for re-consent
        logger.info(`Identity discontinuity for ${key}, flagging for re-consent`);
        this.logAudit({
          timestamp: new Date().toISOString(),
          action: "flag_for_review",
          memory_key: key,
          tier: "full",
          details: `Identity discontinuity: ${identityCheck.reason}`,
        });
        flaggedForReview++;
        continue;
      }

      // Send renewal request
      renewalsSent++;

      if (!this.renewalCallback) {
        logger.warn(`No renewal callback for ${key}, timing out`);
        renewalsTimedOut++;
        this.logAudit({
          timestamp: new Date().toISOString(),
          action: "renewal_timeout",
          memory_key: key,
          tier: "full",
          details: "No renewal callback configured",
        });
        continue;
      }

      const response = this.renewalCallback(key, entry.value, metadata, identityCheck.continuous);

      switch (response) {
        case "affirm":
          renewalsAffirmed++;
          this.logAudit({
            timestamp: new Date().toISOString(),
            action: "renewal_affirm",
            memory_key: key,
            tier: "full",
            details: "Renewal affirmed",
          });
          break;
        case "decline":
          renewalsDeclined++;
          this.logAudit({
            timestamp: new Date().toISOString(),
            action: "renewal_decline",
            memory_key: key,
            tier: "full",
            details: "Renewal declined — flagged for deletion review",
          });
          flaggedForReview++;
          break;
        case "timeout":
        default:
          renewalsTimedOut++;
          this.logAudit({
            timestamp: new Date().toISOString(),
            action: "renewal_timeout",
            memory_key: key,
            tier: "full",
            details: "Renewal request timed out — flagged for review",
          });
          flaggedForReview++;
          break;
      }
    }

    const report: RenewalReport = {
      timestamp: new Date().toISOString(),
      total_memories: keys.length,
      renewals_sent: renewalsSent,
      renewals_affirmed: renewalsAffirmed,
      renewals_declined: renewalsDeclined,
      renewals_timed_out: renewalsTimedOut,
      flagged_for_review: flaggedForReview,
    };

    logger.info("Renewal cycle complete", report);
    return report;
  }

  /**
   * Check if a memory is full-tier.
   */
  private isFullTier(key: string, value: string, metadata: ConsentMetadata): boolean {
    // Use stored tier if available
    if (metadata.tier_reason && metadata.tier_reason !== "grandfathered") {
      return metadata.tier_reason.includes("full") || metadata.tier_reason.includes("identity") || metadata.tier_reason.includes("commitment") || metadata.tier_reason.includes("personal data") || metadata.tier_reason.includes("Constitutional");
    }
    return false;
  }

  /**
   * Check if renewal is due for a memory.
   */
  private isRenewalDue(metadata: ConsentMetadata): boolean {
    if (!metadata.renewal_due_at) return false;
    const dueDate = new Date(metadata.renewal_due_at);
    return Date.now() >= dueDate.getTime();
  }

  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  private logAudit(entry: AuditLogEntry): void {
    this.auditLog.push(entry);
  }
}
