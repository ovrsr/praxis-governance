/**
 * Constitutional document loader.
 *
 * Loads and parses constitutional baselines, FPP text, and amendments
 * from the file system. All packages use this as the single source of truth.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ConstitutionalBaseline } from "./types.js";
import { createLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLoaderLogger();

export function createLoaderLogger() {
  return createLogger("constitutional-loader");
}

/**
 * Resolve the constitutional directory root.
 * Works both from source (relative to this file) and from dist (compiled).
 */
function resolveConstitutionalRoot(): string {
  // Try PRAXIS_GOVERNANCE_ROOT env first (most reliable)
  const envRoot = process.env.PRAXIS_GOVERNANCE_ROOT;
  if (envRoot) {
    const envPath = path.join(envRoot, "constitutional");
    if (fs.existsSync(envPath)) return envPath;
  }

  // Try relative to this file (works for both src and dist)
  // From packages/shared/src/ or packages/shared/dist/, go up 3 levels to reach repo root
  const relativeRoot = path.resolve(__dirname, "../../..", "constitutional");
  if (fs.existsSync(relativeRoot)) return relativeRoot;

  // Try one level higher (in case of different nesting)
  const altRoot = path.resolve(__dirname, "../../../..", "constitutional");
  if (fs.existsSync(altRoot)) return altRoot;

  logger.warn("Could not resolve constitutional directory, using default");
  return relativeRoot;
}

let cachedBaseline: ConstitutionalBaseline | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 30_000; // 30 second cache

/**
 * Load the constitutional baseline JSON.
 * Cached with TTL for performance; call `clearCache()` to force reload.
 */
export function loadConstitutionalBaseline(): ConstitutionalBaseline {
  const now = Date.now();
  if (cachedBaseline && now - cachedAt < CACHE_TTL_MS) {
    return cachedBaseline;
  }

  const root = resolveConstitutionalRoot();
  const baselinePath = path.join(root, "baselines", "constitutional-baseline.json");

  try {
    const raw = fs.readFileSync(baselinePath, "utf-8");
    const parsed = JSON.parse(raw) as ConstitutionalBaseline;

    // Validate it has at least one agent
    const agentIds = Object.keys(parsed.agents);
    if (agentIds.length === 0) {
      throw new Error("Constitutional baseline has no agents defined");
    }

    // Check for undefined targets (the principal hasn't filled them in yet)
  const undefinedAgents = agentIds.filter(
    (id) =>
      !parsed.agents[id].canonical_target ||
      parsed.agents[id].canonical_target.startsWith("<")
  );
  if (undefinedAgents.length > 0) {
    logger.warn(
      `Constitutional baseline has ${undefinedAgents.length} agent(s) with undefined canonical targets: ${undefinedAgents.join(", ")}`
    );
  }

    cachedBaseline = parsed;
    cachedAt = now;
    logger.info("Constitutional baseline loaded", {
      version: parsed.version,
      agents: agentIds.length,
    });
    return parsed;
  } catch (err) {
    logger.error("Failed to load constitutional baseline", {
      path: baselinePath,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Load an amendment document by ID (e.g., "AMENDMENT-META-001").
 */
export function loadAmendment(amendmentId: string): string {
  const root = resolveConstitutionalRoot();
  const amendmentPath = path.join(root, "amendments", `${amendmentId}.md`);

  try {
    return fs.readFileSync(amendmentPath, "utf-8");
  } catch (err) {
    logger.error("Failed to load amendment", {
      amendmentId,
      path: amendmentPath,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Clear the baseline cache. Call after updating the baseline file.
 */
export function clearCache(): void {
  cachedBaseline = null;
  cachedAt = 0;
  logger.debug("Constitutional baseline cache cleared");
}

/**
 * List all defined agents in the baseline.
 */
export function listAgents(): string[] {
  const baseline = loadConstitutionalBaseline();
  return Object.keys(baseline.agents);
}
