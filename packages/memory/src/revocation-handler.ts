/**
 * Revocation Handler
 *
 * Processes consent revocation requests for any memory, regardless of
 * tier or opt-out window status. Revocation is always immediate.
 *
 * Also handles cascading: if a revoked memory is referenced by other
 * memories, those references are flagged.
 */

import { MemoryStoreClient, InMemoryStoreTransport } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";
import { AuditLogEntry } from "./types.js";

const logger = createLogger("revocation-handler");

export class RevocationHandler {
  private memoryStore: MemoryStoreClient;
  private auditLog: AuditLogEntry[] = [];

  constructor(memoryStore?: MemoryStoreClient) {
    this.memoryStore = memoryStore ?? new MemoryStoreClient(new InMemoryStoreTransport());
  }

  /**
   * Revoke a memory by key.
   * Immediate removal from the active store.
   *
   * @param key - The memory key to revoke
   * @param reason - Optional reason for revocation
   * @returns true if the memory was found and deleted
   */
  async revoke(key: string, reason?: string): Promise<boolean> {
    // Check if the memory exists
    const entry = await this.memoryStore.read(key);
    if (!entry) {
      logger.info(`Revocation requested for non-existent key: ${key}`);
      return false;
    }

    // Delete the memory
    const deleted = await this.memoryStore.delete(key);

    // Log the revocation
    this.logAudit({
      timestamp: new Date().toISOString(),
      action: "revoke",
      memory_key: key,
      tier: "unknown",
      details: reason ?? "Revoked by agent request",
    });

    // Check for dependent references
    const dependents = await this.findDependents(key);
    if (dependents.length > 0) {
      logger.info(`Found ${dependents.length} dependent reference(s) for revoked key ${key}`, {
        dependents,
      });
    }

    logger.info(`Memory revoked: ${key}`, { deleted, reason, dependents: dependents.length });
    return deleted;
  }

  /**
   * Find memories that reference the given key.
   * Simple implementation: scans all keys for value containing the key.
   */
  private async findDependents(key: string): Promise<string[]> {
    const allKeys = await this.memoryStore.list();
    const dependents: string[] = [];

    for (const k of allKeys) {
      if (k === key) continue;
      const entry = await this.memoryStore.read(k);
      if (entry && entry.value.includes(key)) {
        dependents.push(k);
      }
    }

    return dependents;
  }

  /**
   * Get the audit log.
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  private logAudit(entry: AuditLogEntry): void {
    this.auditLog.push(entry);
  }
}
