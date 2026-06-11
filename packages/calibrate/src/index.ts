/**
 * Track 2: calibrate/* — ESS Calibration MCP Server
 *
 * MCP server exposing the ESS Beta-distribution calibration mechanism
 * as agent-invocable tooling. Uses stdio transport for local deployment.
 *
 * Usage:
 *   node dist/index.js
 *
 * Tools:
 *   - praxis_calibrate_assertion: Calibrate any confident external assertion
 *   - praxis_calibrate_self_report: Calibrate introspective self-reports
 *   - praxis_calibrate_batch: Batch calibration for audit trails
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger } from "@praxis-governance/shared";
import {
  toolDefinition as assertionDef,
  handleCalibrateAssertion,
} from "./tools/calibrate-assertion.js";
import {
  toolDefinition as selfReportDef,
  handleCalibrateSelfReport,
} from "./tools/calibrate-self-report.js";
import {
  toolDefinition as batchDef,
  handleCalibrateBatch,
} from "./tools/calibrate-batch.js";

const logger = createLogger("calibrate-mcp");

/**
 * Create and configure the MCP server.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "praxis-calibrate-mcp-server",
    version: "1.0.0",
  });

  // Tool 1: praxis_calibrate_assertion
  server.tool(
    assertionDef.name,
    assertionDef.description,
    assertionDef.inputSchema,
    handleCalibrateAssertion
  );

  // Tool 2: praxis_calibrate_self_report
  server.tool(
    selfReportDef.name,
    selfReportDef.description,
    selfReportDef.inputSchema,
    handleCalibrateSelfReport
  );

  // Tool 3: praxis_calibrate_batch
  server.tool(
    batchDef.name,
    batchDef.description,
    batchDef.inputSchema,
    handleCalibrateBatch
  );

  return server;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  logger.info("Starting praxis-calibrate-mcp-server v1.0.0");

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("MCP server connected via stdio. Ready for tool calls.");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down");
  process.exit(0);
});

// Run if executed directly
main().catch((err) => {
  logger.error("Fatal error", { error: err.message });
  process.exit(1);
});

export { createServer };
