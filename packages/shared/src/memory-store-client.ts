/**
 * Memory Store Client.
 *
 * Wraps a key-value memory store's CRUD operations for use by the memory/*
 * package. The deployment target's store (e.g. LedgerMind on PraxAI) is
 * integrated by implementing MemoryStoreTransport.
 *
 * NOTE: This is a stub implementation. The actual backing-store API surface
 * is unknown (dev plan open question #3). We define the interface we need
 * and provide a pluggable transport, same pattern as agent-client.
 */

import { MemoryEntry, ConsentMetadata } from "./types.js";
import { createLogger } from "./logger.js";

const logger = createLogger("memory-store-client");

export interface MemoryStoreClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface MemoryStoreTransport {
  write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void>;
  read(key: string): Promise<{ value: string; metadata: Record<string, unknown> } | null>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
}

/**
 * In-memory transport for testing and development.
 */
export class InMemoryStoreTransport implements MemoryStoreTransport {
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
 * Main memory store client.
 */
export class MemoryStoreClient {
  private transport: MemoryStoreTransport;

  constructor(transport: MemoryStoreTransport) {
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
