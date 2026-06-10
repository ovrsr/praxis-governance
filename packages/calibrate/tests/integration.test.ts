import { createServer } from "../src/index.js";

describe("MCP Server Integration", () => {
  test("creates server without errors", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
