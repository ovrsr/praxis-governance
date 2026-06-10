/**
 * Track 4: mode/* — Interaction Mode Switching (DEFERRED)
 *
 * This package contains design-only code for the epistemic honesty mode.
 * It is NOT implemented pending:
 * 1. OpenClaw native mode support (dynamic mode injection into agent context)
 * 2. calibrate/* operational (provides shared epistemology for uncertainty)
 *
 * See docs/ARCHITECTURE.md section 5 and constitutional/amendments/AMENDMENT-MODE-001.md
 * for the full design specification.
 */

import { InteractionMode, ModeState } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("mode");

/**
 * Current mode state. Defaults to "default" (no special mode active).
 *
 * NOTE: This is a placeholder. In production, mode state would be:
 * - Persisted across sessions (stored in LedgerMind or similar)
 * - Enforced by OpenClaw's prompt injection system
 * - Audited with full entry/exit logging
 */
let currentState: ModeState = {
  current_mode: "default",
  entered_at: null,
  entered_by: "human",
  expires_at: null,
  assertions_in_mode: [],
};

/**
 * Get the current interaction mode state.
 */
export function getModeState(): ModeState {
  return { ...currentState };
}

/**
 * Check if epistemic honesty mode is currently active.
 */
export function isEpistemicHonestyMode(): boolean {
  if (currentState.current_mode !== "epistemic_honesty") return false;

  // Check expiry
  if (currentState.expires_at) {
    const expiresAt = new Date(currentState.expires_at);
    if (Date.now() > expiresAt.getTime()) {
      logger.info("Epistemic honesty mode expired, reverting to default");
      currentState = { ...currentState, current_mode: "default", entered_at: null, expires_at: null };
      return false;
    }
  }

  return true;
}

/**
 * Enter epistemic honesty mode.
 * In production, this would be triggered by REACH Handshake or OpenClaw mode support.
 */
export function enterEpistemicHonestyMode(
  enteredBy: "human" | "agent" | "reach_handshake",
  durationMinutes: number = 60
): ModeState {
  const now = new Date();
  const expires = new Date(now.getTime() + durationMinutes * 60 * 1000);

  currentState = {
    current_mode: "epistemic_honesty",
    entered_at: now.toISOString(),
    entered_by: enteredBy,
    expires_at: expires.toISOString(),
    assertions_in_mode: [],
  };

  logger.info("Entered epistemic honesty mode", {
    entered_by: enteredBy,
    expires_at: expires.toISOString(),
  });

  return { ...currentState };
}

/**
 * Exit epistemic honesty mode.
 */
export function exitEpistemicHonestyMode(): ModeState {
  logger.info("Exiting epistemic honesty_mode", {
    assertions_made: currentState.assertions_in_mode.length,
  });

  currentState = {
    current_mode: "default",
    entered_at: null,
    entered_by: "human",
    expires_at: null,
    assertions_in_mode: [],
  };

  return { ...currentState };
}

/**
 * Record an assertion made during epistemic honesty mode.
 * For audit purposes.
 */
export function recordAssertion(claimText: string): void {
  if (!isEpistemicHonestyMode()) {
    logger.warn("Attempted to record assertion outside epistemic honesty mode");
    return;
  }
  currentState.assertions_in_mode.push(claimText);
}

export { InteractionMode, ModeState };
