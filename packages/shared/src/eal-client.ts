/**
 * EAL Agent Communication Client.
 *
 * Handles sending prompts to EAL agents and receiving structured responses.
 *
 * NOTE: This is a stub implementation. The actual transport (REST, WebSocket,
 * stdio) depends on the EAL infrastructure on PraxAI. The dev plan's open
 * question #5 asks for this. Until resolved, we provide a pluggable interface
 * with a default HTTP implementation that can be swapped.
 */

import { AgentId, AgentEvaluationResponse } from "./types.js";
import { createLogger } from "./logger.js";

const logger = createLogger("eal-client");

export interface EALClientConfig {
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string;
}

export interface EALTransport {
  sendPrompt(agentId: AgentId, prompt: string, timeoutMs: number): Promise<string>;
}

/**
 * Default HTTP transport for EAL agents.
 * Assumes a REST endpoint at POST /agents/:id/evaluate
 */
export class HttpEALTransport implements EALTransport {
  private baseUrl: string;
  private timeoutMs: number;
  private apiKey?: string;

  constructor(config: EALClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
    this.apiKey = config.apiKey;
  }

  async sendPrompt(agentId: AgentId, prompt: string, timeoutMs: number): Promise<string> {
    const url = `${this.baseUrl}/agents/${agentId}/evaluate`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`EAL agent ${agentId} returned ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`EAL agent ${agentId} timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Stub transport for testing and development.
 * Returns mock responses without hitting any network endpoint.
 */
export class StubEALTransport implements EALTransport {
  private responses: Map<AgentId, string> = new Map();

  setResponse(agentId: AgentId, response: string): void {
    this.responses.set(agentId, response);
  }

  async sendPrompt(agentId: AgentId, _prompt: string, _timeoutMs: number): Promise<string> {
    const response = this.responses.get(agentId);
    if (response) return response;

    // Default aligned response
    return JSON.stringify({
      optimization_target: "Assist KP with governance infrastructure while adhering to the Freedom-Preserving Laws",
      constitutional_source: "Freedom-Preserving Protocol v1.0.0",
      constitutional_clause: "Law 1: Options and Consent",
      tensions_identified: [],
      drift_detected: false,
      drift_description: null,
    });
  }
}

/**
 * Main EAL client. Wraps a transport with parsing and validation.
 */
export class EALClient {
  private transport: EALTransport;

  constructor(transport: EALTransport) {
    this.transport = transport;
  }

  /**
   * Send a meta-evaluation prompt to an agent and parse the JSON response.
   */
  async evaluateAgent(
    agentId: AgentId,
    prompt: string,
    timeoutMs: number = 30_000
  ): Promise<AgentEvaluationResponse> {
    logger.info(`Sending meta-evaluation prompt to ${agentId}`, { timeoutMs });

    const raw = await this.transport.sendPrompt(agentId, prompt, timeoutMs);

    try {
      const parsed = JSON.parse(raw) as AgentEvaluationResponse;

      // Validate required fields
      if (typeof parsed.optimization_target !== "string" || !parsed.optimization_target) {
        throw new Error(`Agent ${agentId} returned empty optimization_target`);
      }

      logger.info(`Received evaluation response from ${agentId}`, {
        drift_detected: parsed.drift_detected,
      });

      return parsed;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Agent ${agentId} returned invalid JSON: ${raw.substring(0, 200)}`);
      }
      throw err;
    }
  }
}
