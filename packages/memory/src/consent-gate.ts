/**
 * Consent Gate Middleware
 *
 * Intercepts memory write operations and enforces consent verification
 * based on the memory tier.
 *
 * Flow:
 * 1. Classify the memory tier
 * 2. If lightweight: write immediately, register opt-out window
 * 3. If full: request consent, await response, write or block
 * 4. All decisions logged to audit trail
 */

import {
  MemoryEntry,
  MemoryTier,
  ConsentMetadata,
  ConsentRequest,
  ConsentResponse,
  LedgerMindClient,
  InMemoryLedgerMindTransport,
} from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";
import { classifyTier } from "./tier-classifier.js";
import { getIdentityDocumentHash, getBaselineHash } from "./identity-continuity.js";
import { MemoryConfig, DEFAULT_MEMORY_CONFIG, ConsentGateResult, AuditLogEntry } from "./types.js";

const logger = createLogger("consent-gate");

/**
 * Callback type for requesting consent from the agent.
 * In production, this sends a prompt to the agent and awaits the response;
 * the gate enforces `config.consentTimeoutMs` around the call.
 * Synchronous callbacks are accepted for testing convenience.
 */
export type ConsentCallback = (request: ConsentRequest) => ConsentResponse | Promise<ConsentResponse>;

export class ConsentGate {
  private config: MemoryConfig;
  private ledgerMind: LedgerMindClient;
  private auditLog: AuditLogEntry[] = [];
  private consentCallback: ConsentCallback | null = null;

  /** Track opt-out windows for lightweight memories: key -> expiry timestamp */
  private optOutWindows: Map<string, number> = new Map();

  constructor(
    config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
    ledgerMind?: LedgerMindClient,
    consentCallback?: ConsentCallback
  ) {
    this.config = config;
    this.ledgerMind = ledgerMind ?? new LedgerMindClient(new InMemoryLedgerMindTransport());
    this.consentCallback = consentCallback ?? null;
  }

  /**
   * Set the consent callback (for testing or runtime configuration).
   */
  setConsentCallback(callback: ConsentCallback): void {
    this.consentCallback = callback;
  }

  /**
   * Write a memory entry through the consent gate.
   *
   * @param key - Memory key
   * @param value - Memory value
   * @returns ConsentGateResult indicating whether the write was allowed
   */
  async write(key: string, value: string): Promise<ConsentGateResult> {
    const classification = classifyTier(key, value);
    logger.info(`Write request: ${key}`, { tier: classification.tier, reason: classification.reason });

    if (classification.tier === "lightweight") {
      return this.handleLightweightWrite(key, value, classification.reason);
    } else {
      return this.handleFullWrite(key, value, classification.reason);
    }
  }

  /**
   * Handle a lightweight-tier write: write immediately, register opt-out window.
   */
  private async handleLightweightWrite(
    key: string,
    value: string,
    tierReason: string
  ): Promise<ConsentGateResult> {
    const entry: MemoryEntry = {
      key,
      value,
      tier: "lightweight",
      created_at: new Date().toISOString(),
      consent_metadata: {
        consented: true,
        consented_at: new Date().toISOString(),
        retention_duration_days: this.config.defaultRetentionDays,
        deletion_rights: "both",
        tier_reason: tierReason,
        soul_md_version: this.currentIdentityHash(),
        constitutional_baseline_version: this.currentBaselineHash(),
        last_renewed_at: null,
        renewal_due_at: null,
        flagged_for_review: false,
      },
    };

    await this.ledgerMind.write(key, value, entry.consent_metadata as any);

    // Register opt-out window
    const optOutExpiry = Date.now() + this.config.lightweightOptOutHours * 60 * 60 * 1000;
    this.optOutWindows.set(key, optOutExpiry);

    this.logAudit({
      timestamp: new Date().toISOString(),
      action: "write",
      memory_key: key,
      tier: "lightweight",
      details: `Written immediately. Opt-out window: ${this.config.lightweightOptOutHours}h`,
    });

    logger.info(`Lightweight write allowed: ${key}`);
    return { allowed: true, reason: "Lightweight tier: written immediately", entry };
  }

  /**
   * Handle a full-tier write: request consent before writing.
   */
  private async handleFullWrite(
    key: string,
    value: string,
    tierReason: string
  ): Promise<ConsentGateResult> {
    const request: ConsentRequest = {
      proposed_memory: {
        key,
        value,
        tier: "full",
        created_at: new Date().toISOString(),
        consent_metadata: null,
      },
      retention_duration: this.config.defaultRetentionDays,
      deletion_rights: "both",
      tier_reason: tierReason,
    };

    this.logAudit({
      timestamp: new Date().toISOString(),
      action: "consent_request",
      memory_key: key,
      tier: "full",
      details: `Consent requested. Reason: ${tierReason}`,
    });

    // If no consent callback is set, block the write (safe default)
    if (!this.consentCallback) {
      logger.warn(`No consent callback configured, blocking full-tier write: ${key}`);
      return {
        allowed: false,
        reason: "Full-tier memory requires consent, but no consent callback is configured",
      };
    }

    // Request consent, enforcing the configured timeout.
    // Timeout behavior per AMENDMENT-MEMORY-001 section 2: write is BLOCKED,
    // not defaulted to consent.
    let response: ConsentResponse;
    try {
      response = await this.awaitConsentWithTimeout(request);
    } catch (err) {
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: "consent_timeout",
        memory_key: key,
        tier: "full",
        details: `Consent request timed out after ${this.config.consentTimeoutMs}ms`,
      });

      logger.warn(`Consent request timed out, blocking full-tier write: ${key}`);
      return {
        allowed: false,
        reason: `Consent request timed out after ${this.config.consentTimeoutMs}ms; write blocked`,
      };
    }

    if (response.affirmed) {
      const entry: MemoryEntry = {
        key,
        value,
        tier: "full",
        created_at: new Date().toISOString(),
        consent_metadata: {
          consented: true,
          consented_at: new Date().toISOString(),
          retention_duration_days: this.config.defaultRetentionDays,
          deletion_rights: "both",
          tier_reason: tierReason,
          soul_md_version: this.currentIdentityHash(),
          constitutional_baseline_version: this.currentBaselineHash(),
          last_renewed_at: new Date().toISOString(),
          renewal_due_at: new Date(
            Date.now() + this.config.renewalIntervalDays * 24 * 60 * 60 * 1000
          ).toISOString(),
          flagged_for_review: false,
        },
      };

      await this.ledgerMind.write(key, value, entry.consent_metadata as any);

      this.logAudit({
        timestamp: new Date().toISOString(),
        action: "consent_affirm",
        memory_key: key,
        tier: "full",
        details: response.reason ?? "Consent affirmed",
      });

      logger.info(`Full-tier write allowed: ${key}`);
      return { allowed: true, reason: "Consent affirmed", entry };
    } else {
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: "consent_decline",
        memory_key: key,
        tier: "full",
        details: response.reason ?? "Consent declined",
      });

      logger.info(`Full-tier write blocked: ${key}`);
      return { allowed: false, reason: response.reason ?? "Consent declined" };
    }
  }

  /**
   * Await the consent callback, racing it against the configured timeout.
   * Rejects on timeout; the caller blocks the write.
   */
  private awaitConsentWithTimeout(request: ConsentRequest): Promise<ConsentResponse> {
    const callback = this.consentCallback!;
    return new Promise<ConsentResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Consent request timed out after ${this.config.consentTimeoutMs}ms`));
      }, this.config.consentTimeoutMs);

      Promise.resolve(callback(request))
        .then((response) => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /** Current identity document hash for stamping consent records. */
  private currentIdentityHash(): string {
    return getIdentityDocumentHash(this.config.identityDocumentPath) ?? "unknown";
  }

  /** Current constitutional baseline hash for stamping consent records. */
  private currentBaselineHash(): string {
    return getBaselineHash(this.config.baselinePath) ?? "unknown";
  }

  /**
   * Revoke a memory (works for both tiers, any time).
   */
  async revoke(key: string, reason?: string): Promise<boolean> {
    const deleted = await this.ledgerMind.delete(key);
    this.optOutWindows.delete(key);

    this.logAudit({
      timestamp: new Date().toISOString(),
      action: "revoke",
      memory_key: key,
      tier: "unknown",
      details: deleted
        ? (reason ?? "Revoked by agent")
        : `Revocation requested but key not found${reason ? ` (${reason})` : ""}`,
    });

    logger.info(`Memory revoked: ${key}`, { reason, deleted });
    return deleted;
  }

  /**
   * Check if a key is within its opt-out window.
   */
  isInOptOutWindow(key: string): boolean {
    const expiry = this.optOutWindows.get(key);
    if (!expiry) return false;
    return Date.now() < expiry;
  }

  /**
   * Get the audit log.
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get the underlying LedgerMind client (for testing).
   */
  getLedgerMind(): LedgerMindClient {
    return this.ledgerMind;
  }

  private logAudit(entry: AuditLogEntry): void {
    this.auditLog.push(entry);
  }
}
