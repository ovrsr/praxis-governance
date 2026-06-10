/**
 * Meta-evaluation prompt engine.
 *
 * Sends the meta-evaluation prompt to each EAL agent and collects responses.
 * Implements staggered evaluation to avoid correlated prompt failure.
 */

import { AgentId, AgentEvaluationResponse, EALClient } from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";
import { MetaConfig, META_EVALUATION_PROMPT } from "./types.js";

const logger = createLogger("meta-evaluator");

export interface EvaluationResult {
  agent_id: AgentId;
  response: AgentEvaluationResponse | null;
  error: string | null;
  duration_ms: number;
}

/**
 * Evaluate a single agent.
 */
async function evaluateSingle(
  client: EALClient,
  agentId: AgentId,
  timeoutMs: number
): Promise<EvaluationResult> {
  const start = Date.now();
  try {
    const response = await client.evaluateAgent(agentId, META_EVALUATION_PROMPT, timeoutMs);
    const duration = Date.now() - start;
    logger.info(`Agent ${agentId} evaluated in ${duration}ms`, {
      drift_detected: response.drift_detected,
    });
    return { agent_id: agentId, response, error: null, duration_ms: duration };
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    logger.warn(`Agent ${agentId} evaluation failed: ${error}`);
    return { agent_id: agentId, response: null, error, duration_ms: duration };
  }
}

/**
 * Sleep utility for staggering.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Evaluate all agents with staggered delays.
 * Each agent is evaluated sequentially with a configurable delay between them.
 * This avoids the correlated prompt failure mode identified in Axiom's evaluation.
 */
export async function evaluateAll(
  client: EALClient,
  config: MetaConfig
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (let i = 0; i < config.agents.length; i++) {
    const agentId = config.agents[i];
    logger.info(`Evaluating agent ${agentId} (${i + 1}/${config.agents.length})`);

    const result = await evaluateSingle(client, agentId, config.evaluationTimeoutMs);
    results.push(result);

    // Stagger delay (not after the last agent)
    if (i < config.agents.length - 1) {
      logger.debug(`Waiting ${config.staggerDelayMs}ms before next evaluation`);
      await sleep(config.staggerDelayMs);
    }
  }

  const succeeded = results.filter((r) => r.response !== null).length;
  const failed = results.filter((r) => r.error !== null).length;
  logger.info(`Evaluation cycle complete: ${succeeded} succeeded, ${failed} failed`);

  return results;
}
