/**
 * LedgerMind API Client.
 *
 * Wraps LedgerMind's memory CRUD operations for use by the memory/* package.
 *
 * NOTE: This is a stub implementation. The actual LedgerMind API surface is
 * unknown (dev plan open question #3). We define the interface we need
 * and provide a pluggable transport, same pattern as eal-client.
 */

import { MemoryEntry, ConsentMetadata } from "./types.js";
import { createLogger } from "./logger.js";

const logger = createLogger("ledgermind-client");

export interface LedgerMindClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface LedgerMindTransport {
  write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void>;
  read(key: string): Promise<{ value: string; metadata: Record<string, unknown> } | null>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
}

/**
 * In-memory transport for testing and development.
 */
export class InMemoryLedgerMindTransport implements LedgerMindTransport {
  private store: Map<string, { value: string; metadata: Record<string, unknown> }> = new Map();

  async write(key: string, value: string, metadata: Record<string, unknown> = {}): Promise<void> {
    this.store.set(key, { value, metadata });
    logger.debug(`InMemory write: ${key}`);
  }

  async read(key: string): Promise<{ value: string; metadata: Record<string, unknown> } | null> {
    return this.store.get(key) ?? null;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    if (prefix) return keys.filter((k) => k.startsWith(prefix));
    return keys;
  }

  /** Clear all stored data (testing utility) */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Main LedgerMind client.
 */
export class LedgerMindClient {
  private transport: LedgerMindTransport;

  constructor(transport: LedgerMindTransport) {
    this.transport = transport;
  }

  async write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.transport.write(key, value, metadata);
  }

  async read(key: string): Promise<{ value: string; metadata: Record<string, unknown> } | null> {
    return this.transport.read(key);
  }

  async delete(key: string): Promise<boolean> {
    return this.transport.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    return this.transport.list(prefix);
  }
}
