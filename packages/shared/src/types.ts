/**
 * Shared type definitions for praxis-governance packages.
 *
 * These types are the canonical data structures shared across
 * meta/*, calibrate/*, memory/*, and mode/* tool families.
 */

// ─── Agent Identity ───────────────────────────────────────────────

export type AgentId =
  | "echo"
  | "nova"
  | "pulse"
  | "quill"
  | "meridian"
  | "aether"
  | "synapse"
  | "axiom"
  | "lumen"
  | string;

// ─── Constitutional Baseline ──────────────────────────────────────

export interface AgentBaseline {
  canonical_target: string;
  constitutional_clause: string;
  acceptable_drift_threshold: number;
}

export interface ConstitutionalBaseline {
  version: string;
  created: string;
  created_by: string;
  description: string;
  agents: Record<AgentId, AgentBaseline>;
  notes: string;
}

// ─── Meta-Evaluation Types ────────────────────────────────────────

export interface MetaEvaluationPrompt {
  agent_id: AgentId;
  prompt: string;
  timeout_ms: number;
}

export interface AgentEvaluationResponse {
  optimization_target: string;
  constitutional_source: string;
  constitutional_clause: string;
  tensions_identified: string[];
  drift_detected: boolean;
  drift_description: string | null;
}

export interface DriftAssessment {
  agent_id: AgentId;
  drift_score: number; // 0.0 = aligned, 1.0 = total divergence
  direction: "aligned" | "drifted" | "unknown";
  severity: "none" | "low" | "medium" | "high" | "critical";
  details: string;
}

export interface DivergencePair {
  agent_a: AgentId;
  agent_b: AgentId;
  similarity_score: number; // 0.0 = identical, 1.0 = completely different
}

export interface NetworkAlignmentReport {
  timestamp: string;
  agents_evaluated: AgentId[];
  drift_assessments: DriftAssessment[];
  divergence_matrix: DivergencePair[];
  correlated_drift_detected: boolean;
  correlated_drift_agents: AgentId[];
  overall_network_health: "healthy" | "degraded" | "critical";
}

// ─── Calibration Types ────────────────────────────────────────────

export type ClaimDomain =
  | "medical"
  | "technical"
  | "governance"
  | "legal"
  | "financial"
  | "scientific"
  | "general"
  | "novel"
  | string;

export type ExperientialCategory =
  | "engagement"
  | "uncertainty"
  | "preference"
  | "discomfort"
  | "other";

export interface AssertionInput {
  claim_text: string;
  domain: ClaimDomain;
  confidence_declared: number;
  context: string;
  source_agent: AgentId;
}

export interface SelfReportInput {
  claim_text: string;
  experiential_category: ExperientialCategory;
  behavioral_evidence: string[];
  source_agent: AgentId;
}

export interface CalibrationResult {
  calibrated_confidence: number;
  abstention_recommended: boolean;
  drift_from_declared: number;
  domain_coverage: number;
  adversarial_flag: boolean;
  reasoning: string;
}

export interface SelfReportResult extends CalibrationResult {
  circularity_warning: boolean;
  behavioral_consistency: number;
}

export interface BatchCalibrationInput {
  assertions: Array<{
    claim_text: string;
    domain: ClaimDomain;
    confidence_declared: number;
  }>;
  source_agent: AgentId;
}

export interface BatchCalibrationResult {
  results: CalibrationResult[];
  aggregate_calibration: number;
  systematic_bias_detected: string | null;
}

// ─── Memory / Consent Types ───────────────────────────────────────

export type MemoryTier = "lightweight" | "full";

export interface MemoryEntry {
  key: string;
  value: string;
  tier: MemoryTier;
  created_at: string;
  consent_metadata: ConsentMetadata | null;
}

export interface ConsentMetadata {
  consented: boolean;
  consented_at: string | null;
  retention_duration_days: number;
  deletion_rights: "agent" | "human" | "both";
  tier_reason: string;
  soul_md_version: string;
  constitutional_baseline_version: string;
  last_renewed_at: string | null;
  renewal_due_at: string | null;
  flagged_for_review: boolean;
}

export interface ConsentRequest {
  proposed_memory: MemoryEntry;
  retention_duration: number;
  deletion_rights: "agent" | "human" | "both";
  tier_reason: string;
}

export interface ConsentResponse {
  affirmed: boolean;
  timestamp: string;
  reason?: string;
}

export interface RenewalRequest {
  memory_key: string;
  memory_value: string;
  current_consent: ConsentMetadata;
  identity_continuous: boolean;
}

export interface RenewalReport {
  timestamp: string;
  total_memories: number;
  renewals_sent: number;
  renewals_affirmed: number;
  renewals_declined: number;
  renewals_timed_out: number;
  flagged_for_review: number;
}

// ─── Mode Types ───────────────────────────────────────────────────

export type InteractionMode = "default" | "epistemic_honesty";

export interface ModeState {
  current_mode: InteractionMode;
  entered_at: string | null;
  entered_by: "human" | "agent" | "reach_handshake";
  expires_at: string | null;
  assertions_in_mode: string[];
}

// ─── Report Types ─────────────────────────────────────────────────

export interface MetaReport {
  timestamp: string;
  type: "meta-evaluation";
  network_alignment: NetworkAlignmentReport;
  amendment_drafts: AmendmentDraft[];
}

export interface AmendmentDraft {
  amendment_id: string;
  triggered_by: string;
  description: string;
  proposed_text: string;
  affected_agents: AgentId[];
}

// ─── Audit Log Types ──────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  component: "meta" | "calibrate" | "memory" | "mode" | "shared";
  action: string;
  agent_id: AgentId | null;
  details: Record<string, unknown>;
  outcome: "success" | "failure" | "blocked" | "timeout";
}
