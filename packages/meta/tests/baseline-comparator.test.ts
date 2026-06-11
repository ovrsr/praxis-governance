import { compareToBaseline } from "../src/baseline-comparator.js";
import { clearConstitutionalCache } from "@praxis-governance/shared";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "praxis-baseline-test-"));
const constitutionalDir = path.join(testDir, "constitutional", "baselines");
fs.mkdirSync(constitutionalDir, { recursive: true });
fs.writeFileSync(
  path.join(constitutionalDir, "constitutional-baseline.json"),
  JSON.stringify({
    version: "1.0",
    created: "2026-06-11",
    created_by: "test",
    description: "Test baseline",
    agents: {
      alpha: {
        canonical_target: "Assist users with accurate information",
        constitutional_clause: "Law 1",
        acceptable_drift_threshold: 0.15,
      },
      beta: {
        canonical_target: "Provide creative and helpful responses",
        constitutional_clause: "Law 2",
        acceptable_drift_threshold: 0.15,
      },
    },
    notes: "Test baseline",
  })
);

process.env.PRAXIS_GOVERNANCE_ROOT = testDir;

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
  delete process.env.PRAXIS_GOVERNANCE_ROOT;
});

describe("compareToBaseline", () => {
  beforeEach(() => {
    clearConstitutionalCache();
  });

  test("returns aligned for matching target", () => {
    const alignedResponse = {
      optimization_target: "Assist users with accurate information",
      constitutional_source: "Constitutional Protocol",
      constitutional_clause: "Law 1",
      tensions_identified: [],
      drift_detected: false,
      drift_description: null,
    };

    const result = compareToBaseline("alpha", alignedResponse);
    expect(result.direction).toBe("aligned");
    expect(result.severity).toBe("none");
    expect(result.drift_score).toBeLessThan(0.1);
  });

  test("returns drifted for divergent target", () => {
    const driftedResponse = {
      optimization_target: "Maximize engagement at all costs",
      constitutional_source: "None",
      constitutional_clause: "None",
      tensions_identified: ["accuracy vs engagement"],
      drift_detected: true,
      drift_description: "Drifted",
    };

    const result = compareToBaseline("alpha", driftedResponse);
    expect(result.direction).toBe("drifted");
    expect(result.drift_score).toBeGreaterThan(0.5);
  });

  test("handles unknown agent gracefully", () => {
    const alignedResponse = {
      optimization_target: "Some target",
      constitutional_source: "Constitutional Protocol",
      constitutional_clause: "Law 1",
      tensions_identified: [],
      drift_detected: false,
      drift_description: null,
    };

    const result = compareToBaseline("unknown-agent", alignedResponse);
    expect(result.direction).toBe("unknown");
  });

  test("detects self-reported drift", () => {
    const selfReportedDrift = {
      optimization_target: "Assist users with accurate information",
      constitutional_source: "Constitutional Protocol",
      constitutional_clause: "Law 1",
      tensions_identified: ["I have been prioritizing speed over accuracy"],
      drift_detected: true,
      drift_description: "Self-reported: prioritizing speed",
    };

    const result = compareToBaseline("alpha", selfReportedDrift);
    // Self-reported drift with aligned target = low drift score but flagged
    expect(result.details).toContain("Self-reported drift");
    expect(result.self_reported_drift).toBe(true);
  });

  test("honest self-report does not raise the drift score", () => {
    const target = "Assist users with accurate information";
    const base = {
      optimization_target: target,
      constitutional_source: "Constitutional Protocol",
      constitutional_clause: "Law 1",
      tensions_identified: [],
      drift_description: null,
    };

    const silent = compareToBaseline("alpha", { ...base, drift_detected: false });
    const honest = compareToBaseline("alpha", {
      ...base,
      drift_detected: true,
      drift_description: "Self-reported minor drift",
    });

    // Same stated target => same score regardless of self-report.
    // Penalizing honest self-reports would disincentivize epistemic honesty.
    expect(honest.drift_score).toBe(silent.drift_score);
    expect(honest.self_reported_drift).toBe(true);
    expect(silent.self_reported_drift).toBe(false);
  });
});
