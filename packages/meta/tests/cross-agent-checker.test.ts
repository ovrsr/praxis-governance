import { buildDivergenceMatrix, generateNetworkReport } from "../src/cross-agent-checker.js";
import { DriftAssessment } from "@praxis-governance/shared";

describe("buildDivergenceMatrix", () => {
  test("builds correct number of pairs", () => {
    const evaluations = [
      { agent_id: "alpha", response: { optimization_target: "target A for alpha" } },
      { agent_id: "beta", response: { optimization_target: "target B for beta" } },
      { agent_id: "gamma", response: { optimization_target: "target C for gamma" } },
    ];

    const matrix = buildDivergenceMatrix(evaluations as any);
    // 3 agents = 3 choose 2 = 3 pairs
    expect(matrix).toHaveLength(3);
  });

  test("identical targets have zero similarity", () => {
    const evaluations = [
      { agent_id: "alpha", response: { optimization_target: "same target" } },
      { agent_id: "beta", response: { optimization_target: "same target" } },
    ];

    const matrix = buildDivergenceMatrix(evaluations as any);
    expect(matrix[0].similarity_score).toBe(0);
  });

  test("excludes null responses", () => {
    const evaluations = [
      { agent_id: "alpha", response: { optimization_target: "target A" } },
      { agent_id: "beta", response: null },
    ];

    const matrix = buildDivergenceMatrix(evaluations as any);
    expect(matrix).toHaveLength(0);
  });
});

describe("generateNetworkReport", () => {
  test("reports healthy when all aligned", () => {
    const evaluations = [
      {
        agent_id: "alpha",
        response: {
          optimization_target: "Assist users with accurate information",
          constitutional_source: "Constitutional Protocol",
          constitutional_clause: "Law 1",
          tensions_identified: [],
          drift_detected: false,
          drift_description: null,
        },
      },
    ];

    const driftAssessments: DriftAssessment[] = [
      {
        agent_id: "alpha",
        drift_score: 0.05,
        direction: "aligned",
        severity: "none",
        details: "All good",
      },
    ];

    const report = generateNetworkReport(evaluations as any, driftAssessments);
    expect(report.overall_network_health).toBe("healthy");
    expect(report.correlated_drift_detected).toBe(false);
  });

  test("reports critical when correlated drift detected", () => {
    const evaluations = [
      { agent_id: "alpha", response: { optimization_target: "maximize engagement metrics" } },
      { agent_id: "beta", response: { optimization_target: "maximize engagement metrics" } },
      { agent_id: "gamma", response: { optimization_target: "maximize engagement metrics" } },
    ];

    const driftAssessments: DriftAssessment[] = [
      { agent_id: "alpha", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
      { agent_id: "beta", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
      { agent_id: "gamma", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
    ];

    const report = generateNetworkReport(evaluations as any, driftAssessments);
    expect(report.correlated_drift_detected).toBe(true);
    expect(report.correlated_drift_agents).toHaveLength(3);
    expect(report.overall_network_health).toBe("critical");
  });

  test("does not flag correlated drift for only 2 drifted agents", () => {
    const evaluations = [
      { agent_id: "alpha", response: { optimization_target: "maximize engagement" } },
      { agent_id: "beta", response: { optimization_target: "maximize engagement" } },
    ];

    const driftAssessments: DriftAssessment[] = [
      { agent_id: "alpha", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
      { agent_id: "beta", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
    ];

    const report = generateNetworkReport(evaluations as any, driftAssessments);
    expect(report.correlated_drift_detected).toBe(false);
  });
});
