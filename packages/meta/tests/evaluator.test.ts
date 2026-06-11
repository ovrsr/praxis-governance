import { StubEALTransport, EALClient } from "@praxis-governance/shared";
import { evaluateAll } from "../src/evaluator.js";
import { DEFAULT_CONFIG } from "../src/types.js";

describe("evaluateAll", () => {
  let transport: StubEALTransport;
  let client: EALClient;

  beforeEach(() => {
    transport = new StubEALTransport();
    client = new EALClient(transport);
  });

  test("evaluates all agents and returns results", async () => {
    const config = { ...DEFAULT_CONFIG, staggerDelayMs: 10, agents: ["agent-a", "agent-b"] };
    const results = await evaluateAll(client, config);

    expect(results).toHaveLength(2);
    expect(results[0].agent_id).toBe("agent-a");
    expect(results[1].agent_id).toBe("agent-b");
    expect(results[0].response).not.toBeNull();
    expect(results[0].error).toBeNull();
  });

  test("handles agent evaluation failure gracefully", async () => {
    transport.setResponse("agent-a", "not valid json");

    const config = { ...DEFAULT_CONFIG, staggerDelayMs: 10, agents: ["agent-a"] };
    const results = await evaluateAll(client, config);

    expect(results).toHaveLength(1);
    expect(results[0].response).toBeNull();
    expect(results[0].error).toContain("invalid JSON");
  });

  test("staggers evaluations with delay", async () => {
    const config = { ...DEFAULT_CONFIG, staggerDelayMs: 50, agents: ["agent-a", "agent-b", "agent-c"] };
    const start = Date.now();
    await evaluateAll(client, config);
    const elapsed = Date.now() - start;

    // Should have at least 2 stagger delays (between 3 agents)
    expect(elapsed).toBeGreaterThanOrEqual(90); // 2 * 50ms minus some tolerance
  });

  test("records duration for each evaluation", async () => {
    const config = { ...DEFAULT_CONFIG, staggerDelayMs: 10, agents: ["agent-a"] };
    const results = await evaluateAll(client, config);

    expect(results[0].duration_ms).toBeGreaterThanOrEqual(0);
  });
});
