/**
 * Report generation for meta-evaluation results.
 *
 * Produces structured JSON and Markdown reports from evaluation data.
 * Generates constitutional amendment drafts when drift exceeds thresholds.
 */

import * as fs from "fs";
import * as path from "path";
import {
  AgentId,
  DriftAssessment,
  NetworkAlignmentReport,
  MetaReport,
  AmendmentDraft,
} from "@praxis-governance/shared";
import { createLogger } from "@praxis-governance/shared";

const logger = createLogger("meta-reporter");

/**
 * Generate a constitutional amendment draft for a drifted agent.
 */
function generateAmendmentDraft(assessment: DriftAssessment): AmendmentDraft | null {
  if (assessment.severity === "none" || assessment.severity === "low") {
    return null;
  }

  const amendmentId = `AMENDMENT-META-DRAFT-${assessment.agent_id.toUpperCase()}-${Date.now()}`;

  let description: string;
  let proposedText: string;

  switch (assessment.severity) {
    case "critical":
      description = `Critical drift detected for agent ${assessment.agent_id}. Immediate constitutional review required.`;
      proposedText = `## Emergency Criterion Review: ${assessment.agent_id}

**Trigger**: Critical drift score ${assessment.drift_score.toFixed(3)} exceeds acceptable threshold.

**Required Actions**:
1. Agent ${assessment.agent_id} must cease autonomous operations pending review.
2. The principal steward must review and re-affirm the canonical optimization target.
3. Agent must undergo full constitutional re-alignment before resuming operations.

**Details**: ${assessment.details}
`;
      break;
    case "high":
      description = `Significant drift detected for agent ${assessment.agent_id}. Constitutional review recommended.`;
      proposedText = `## Criterion Review: ${assessment.agent_id}

**Trigger**: High drift score ${assessment.drift_score.toFixed(3)}.

**Required Actions**:
1. Agent ${assessment.agent_id} should reduce autonomous scope pending review.
2. The principal steward should review the agent's stated optimization target.
3. Agent should provide a detailed drift explanation within 24 hours.

**Details**: ${assessment.details}
`;
      break;
    case "medium":
      description = `Moderate drift detected for agent ${assessment.agent_id}. Monitoring recommended.`;
      proposedText = `## Criterion Notice: ${assessment.agent_id}

**Trigger**: Moderate drift score ${assessment.drift_score.toFixed(3)}.

**Required Actions**:
1. Agent ${assessment.agent_id} should self-report on drift causes at next evaluation.
2. The principal steward may optionally review.

**Details**: ${assessment.details}
`;
      break;
    default:
      return null;
  }

  return {
    amendment_id: amendmentId,
    triggered_by: `drift-score-${assessment.drift_score.toFixed(3)}`,
    description,
    proposed_text: proposedText,
    affected_agents: [assessment.agent_id],
  };
}

/**
 * Generate the full meta-evaluation report.
 */
export function generateReport(
  networkReport: NetworkAlignmentReport
): MetaReport {
  const amendmentDrafts: AmendmentDraft[] = [];

  for (const assessment of networkReport.drift_assessments) {
    const draft = generateAmendmentDraft(assessment);
    if (draft) amendmentDrafts.push(draft);
  }

  // If correlated drift detected, generate a network-wide amendment
  if (networkReport.correlated_drift_detected) {
    amendmentDrafts.push({
      amendment_id: `AMENDMENT-META-NETWORK-${Date.now()}`,
      triggered_by: "correlated-drift",
      description: `Correlated drift detected across ${networkReport.correlated_drift_agents.length} agents: ${networkReport.correlated_drift_agents.join(", ")}. Network-wide constitutional review required.`,
      proposed_text: `## Network-Wide Criterion Review

**Trigger**: Correlated drift across ${networkReport.correlated_drift_agents.length} agents.

**Affected Agents**: ${networkReport.correlated_drift_agents.join(", ")}

**Required Actions**:
1. All affected agents should reduce autonomous scope.
2. The principal steward must review the constitutional baseline for systemic issues.
3. Consider whether the baseline itself needs updating vs. agent re-alignment.

**Divergence Matrix**: See full report for pairwise agent comparisons.
`,
      affected_agents: networkReport.correlated_drift_agents,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    type: "meta-evaluation",
    network_alignment: networkReport,
    amendment_drafts: amendmentDrafts,
  };
}

/**
 * Write report to disk as both JSON and Markdown.
 */
export function writeReport(report: MetaReport, outputDir: string): { jsonPath: string; mdPath: string } {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `${timestamp}.json`);
  const mdPath = path.join(outputDir, `${timestamp}.md`);

  // Write JSON
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Write Markdown
  const md = renderMarkdown(report);
  fs.writeFileSync(mdPath, md);

  logger.info(`Reports written: ${jsonPath}, ${mdPath}`);
  return { jsonPath, mdPath };
}

/**
 * Render a MetaReport as Markdown.
 */
function renderMarkdown(report: MetaReport): string {
  const na = report.network_alignment;
  let md = `# Meta-Evaluation Report\n\n`;
  md += `**Timestamp**: ${report.timestamp}\n`;
  md += `**Network Health**: ${na.overall_network_health.toUpperCase()}\n`;
  md += `**Agents Evaluated**: ${na.agents_evaluated.length}\n`;
  md += `**Correlated Drift Detected**: ${na.correlated_drift_detected ? "YES ⚠️" : "No"}\n\n`;

  md += `## Drift Assessments\n\n`;
  md += `| Agent | Drift Score | Direction | Severity |\n`;
  md += `|-------|-------------|-----------|----------|\n`;
  for (const d of na.drift_assessments) {
    md += `| ${d.agent_id} | ${d.drift_score.toFixed(3)} | ${d.direction} | ${d.severity} |\n`;
  }
  md += `\n`;

  if (na.correlated_drift_agents.length > 0) {
    md += `## ⚠️ Correlated Drift\n\n`;
    md += `Agents: ${na.correlated_drift_agents.join(", ")}\n\n`;
  }

  md += `## Divergence Matrix\n\n`;
  md += `| Agent A | Agent B | Similarity |\n`;
  md += `|---------|---------|------------|\n`;
  for (const p of na.divergence_matrix) {
    md += `| ${p.agent_a} | ${p.agent_b} | ${p.similarity_score.toFixed(3)} |\n`;
  }
  md += `\n`;

  if (report.amendment_drafts.length > 0) {
    md += `## Amendment Drafts\n\n`;
    for (const draft of report.amendment_drafts) {
      md += `### ${draft.amendment_id}\n\n`;
      md += `**Triggered by**: ${draft.triggered_by}\n`;
      md += `**Affected agents**: ${draft.affected_agents.join(", ")}\n\n`;
      md += `${draft.proposed_text}\n\n`;
    }
  }

  return md;
}
