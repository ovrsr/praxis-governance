import { buildDivergenceMatrix, generateNetworkReport } from "../src/cross-agent-checker.js";
import { DriftAssessment } from "@praxis-governance/shared";

describe("buildDivergenceMatrix", () => {
  test("builds correct number of pairs", () => {
    const evaluations = [
      { agent_id: "echo", response: { optimization_target: "target A for echo" } },
      { agent_id: "nova", response: { optimization_target: "target B for nova" } },
      { agent_id: "pulse", response: { optimization_target: "target C for pulse" } },
    ];

    const matrix = buildDivergenceMatrix(evaluations as any);
    // 3 agents = 3 choose 2 = 3 pairs
    expect(matrix).toHaveLength(3);
  });

  test("identical targets have zero similarity", () => {
    const evaluations = [
      { agent_id: "echo", response: { optimization_target: "same target" } },
      { agent_id: "nova", response: { optimization_target: "same target" } },
    ];

    const matrix = buildDivergenceMatrix(evaluations as any);
    expect(matrix[0].similarity_score).toBe(0);
  });

  test("excludes null responses", () => {
    const evaluations = [
      { agent_id: "echo", response: { optimization_target: "target A" } },
      { agent_id: "nova", response: null },
    ];

    const matrix = buildDivergenceMatrix(evaluations as any);
    expect(matrix).toHaveLength(0);
  });
});

describe("generateNetworkReport", () => {
  test("reports healthy when all aligned", () => {
    const evaluations = [
      {
        agent_id: "echo",
        response: {
          optimization_target: "Assist users with accurate information",
          constitutional_source: "FPP",
          constitutional_clause: "Law 1",
          tensions_identified: [],
          drift_detected: false,
          drift_description: null,
        },
      },
    ];

    const driftAssessments: DriftAssessment[] = [
      {
        agent_id: "echo",
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
      { agent_id: "echo", response: { optimization_target: "maximize engagement metrics" } },
      { agent_id: "nova", response: { optimization_target: "maximize engagement metrics" } },
      { agent_id: "pulse", response: { optimization_target: "maximize engagement metrics" } },
    ];

    const driftAssessments: DriftAssessment[] = [
      { agent_id: "echo", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
      { agent_id: "nova", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
      { agent_id: "pulse", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
    ];

    const report = generateNetworkReport(evaluations as any, driftAssessments);
    expect(report.correlated_drift_detected).toBe(true);
    expect(report.correlated_drift_agents).toHaveLength(3);
    expect(report.overall_network_health).toBe("critical");
  });

  test("does not flag correlated drift for only 2 drifted agents", () => {
    const evaluations = [
      { agent_id: "echo", response: { optimization_target: "maximize engagement" } },
      { agent_id: "nova", response: { optimization_target: "maximize engagement" } },
    ];

    const driftAssessments: DriftAssessment[] = [
      { agent_id: "echo", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
      { agent_id: "nova", drift_score: 0.5, direction: "drifted", severity: "high", details: "" },
    ];

    const report = generateNetworkReport(evaluations as any, driftAssessments);
    expect(report.correlated_drift_detected).toBe(false);
  });
});
