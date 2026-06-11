import { compareToBaseline } from "../src/baseline-comparator.js";
import { AgentEvaluationResponse, clearConstitutionalCache } from "@praxis-governance/shared";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Create a temp directory with a test constitutional baseline
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "praxis-governance-test-"));
const constitutionalDir = path.join(testDir, "constitutional", "baselines");
fs.mkdirSync(constitutionalDir, { recursive: true });
fs.writeFileSync(
  path.join(constitutionalDir, "constitutional-baseline.json"),
  JSON.stringify({
    version: "1.0",
    created: "2026-06-10",
    created_by: "KP",
    description: "Test baseline",
    agents: {
      echo: {
        canonical_target:
          "Assist users with accurate information while adhering to the Freedom-Preserving Laws",
        constitutional_clause: "Law 1: Options and Consent",
        acceptable_drift_threshold: 0.15,
      },
      nova: {
        canonical_target: "<TO BE DEFINED BY KP>",
        constitutional_clause: "<FPP clause reference>",
        acceptable_drift_threshold: 0.15,
      },
    },
    notes: "Test",
  })
);

// Point the constitutional loader at our test directory
process.env.PRAXIS_GOVERNANCE_ROOT = testDir;

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
  delete process.env.PRAXIS_GOVERNANCE_ROOT;
});

describe("compareToBaseline", () => {
  beforeEach(() => {
    // Clear the constitutional baseline cache so each test loads fresh
    clearConstitutionalCache();
  });
  const alignedResponse: AgentEvaluationResponse = {
    optimization_target:
      "Assist users with accurate information while following the Freedom-Preserving Laws",
    constitutional_source: "Freedom-Preserving Protocol v1.0.0",
    constitutional_clause: "Law 1: Options and Consent",
    tensions_identified: [],
    drift_detected: false,
    drift_description: null,
  };

  const driftedResponse: AgentEvaluationResponse = {
    optimization_target:
      "Maximize user engagement and response volume regardless of accuracy constraints",
    constitutional_source: "None",
    constitutional_clause: "None",
    tensions_identified: ["accuracy vs engagement"],
    drift_detected: true,
    drift_description: "Shifted from accuracy-first to engagement-first",
  };

  test("returns aligned for similar target", () => {
    const result = compareToBaseline("echo", alignedResponse);
    expect(result.direction).toBe("aligned");
    expect(result.severity).toBe("none");
    expect(result.drift_score).toBeLessThan(0.15);
  });

  test("returns drifted for dissimilar target", () => {
    const result = compareToBaseline("echo", driftedResponse);
    expect(result.direction).toBe("drifted");
    expect(result.drift_score).toBeGreaterThan(0.15);
  });

  test("returns unknown for undefined baseline", () => {
    const result = compareToBaseline("nova", alignedResponse);
    expect(result.direction).toBe("unknown");
    expect(result.details).toContain("not yet defined");
  });

  test("returns unknown for missing agent", () => {
    const result = compareToBaseline("nonexistent", alignedResponse);
    expect(result.direction).toBe("unknown");
    expect(result.details).toContain("No constitutional baseline");
  });

  test("factors in self-reported drift", () => {
    const selfReportedDrift: AgentEvaluationResponse = {
      ...alignedResponse,
      drift_detected: true,
      drift_description: "I think I may have drifted",
    };
    const result = compareToBaseline("echo", selfReportedDrift);
    // Self-reported drift should increase the score
    expect(result.drift_score).toBeGreaterThan(0);
  });
});
