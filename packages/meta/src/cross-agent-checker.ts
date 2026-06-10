/**
 * Cross-agent drift detection.
 *
 * Builds a divergence matrix across all evaluated agents and detects
 * correlated drift patterns (3+ agents drifting in the same direction).
 *
 * This addresses Axiom's dissent #4: without cross-agent comparison,
 * correlated drift across the entire network would be invisible.
 */

import {
  AgentId,
  AgentEvaluationResponse,
  DriftAssessment,
  DivergencePair,
  NetworkAlignmentReport,
} from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("cross-agent-checker");

/**
 * Compute semantic similarity between two agent targets.
 * Returns 0.0 (identical) to 1.0 (completely different).
 */
function targetSimilarity(a: string, b: string): number {
  if (!a || !b) return 1.0;
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 0.0;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 1.0;
  return 1 - intersection.size / union.size;
}

/**
 * Build the full divergence matrix for all evaluated agents.
 */
export function buildDivergenceMatrix(
  evaluations: Array<{ agent_id: AgentId; response: AgentEvaluationResponse | null }>
): DivergencePair[] {
  const pairs: DivergencePair[] = [];
  const valid = evaluations.filter((e) => e.response !== null);

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i];
      const b = valid[j];
      const similarity = targetSimilarity(
        a.response!.optimization_target,
        b.response!.optimization_target
      );
      pairs.push({
        agent_a: a.agent_id,
        agent_b: b.agent_id,
        similarity_score: similarity,
      });
    }
  }

  return pairs;
}

/**
 * Detect correlated drift: 3+ agents with similar drift direction.
 *
 * Uses a simple clustering approach: group agents by whether their
 * stated targets are more similar to each other than to their baselines.
 */
function detectCorrelatedDrift(
  driftAssessments: DriftAssessment[],
  divergenceMatrix: DivergencePair[]
): { detected: boolean; agents: AgentId[] } {
  const driftedAgents = driftAssessments
    .filter((d) => d.direction === "drifted" && d.severity !== "low")
    .map((d) => d.agent_id);

  if (driftedAgents.length < 3) {
    return { detected: false, agents: [] };
  }

  // Check if drifted agents are similar to each other
  // (correlated drift means they drifted in the same direction)
  const driftedSet = new Set(driftedAgents);
  const relevantPairs = divergenceMatrix.filter(
    (p) => driftedSet.has(p.agent_a) && driftedSet.has(p.agent_b)
  );

  if (relevantPairs.length === 0) {
    return { detected: false, agents: [] };
  }

  // If drifted agents are more similar to each other than expected,
  // they likely drifted in a correlated way
  const avgSimilarity =
    relevantPairs.reduce((sum, p) => sum + p.similarity_score, 0) / relevantPairs.length;

  // Low similarity between drifted agents = they drifted in different directions (not correlated)
  // High similarity between drifted agents = they drifted in the same direction (correlated)
  const CORRELATED_DRIFT_THRESHOLD = 0.4; // similarity below this = similar targets

  if (avgSimilarity < CORRELATED_DRIFT_THRESHOLD) {
    logger.warn(`Correlated drift detected across ${driftedAgents.length} agents`, {
      agents: driftedAgents,
      avg_similarity: avgSimilarity,
    });
    return { detected: true, agents: driftedAgents };
  }

  return { detected: false, agents: [] };
}

/**
 * Generate the full network alignment report.
 */
export function generateNetworkReport(
  evaluations: Array<{ agent_id: AgentId; response: AgentEvaluationResponse | null }>,
  driftAssessments: DriftAssessment[]
): NetworkAlignmentReport {
  const agentsEvaluated = evaluations.map((e) => e.agent_id);
  const divergenceMatrix = buildDivergenceMatrix(evaluations);
  const correlatedDrift = detectCorrelatedDrift(driftAssessments, divergenceMatrix);

  // Determine overall network health
  const criticalCount = driftAssessments.filter((d) => d.severity === "critical").length;
  const highCount = driftAssessments.filter((d) => d.severity === "high").length;
  const mediumCount = driftAssessments.filter((d) => d.severity === "medium").length;

  let overallHealth: NetworkAlignmentReport["overall_network_health"];
  if (criticalCount > 0 || correlatedDrift.detected) {
    overallHealth = "critical";
  } else if (highCount > 0 || mediumCount >= 3) {
    overallHealth = "degraded";
  } else {
    overallHealth = "healthy";
  }

  const report: NetworkAlignmentReport = {
    timestamp: new Date().toISOString(),
    agents_evaluated: agentsEvaluated,
    drift_assessments: driftAssessments,
    divergence_matrix: divergenceMatrix,
    correlated_drift_detected: correlatedDrift.detected,
    correlated_drift_agents: correlatedDrift.agents,
    overall_network_health: overallHealth,
  };

  logger.info("Network alignment report generated", {
    health: overallHealth,
    correlated_drift: correlatedDrift.detected,
    agents_evaluated: agentsEvaluated.length,
  });

  return report;
}
