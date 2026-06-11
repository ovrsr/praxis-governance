import { ConsentGate } from "../src/consent-gate.js";
import type { ConsentCallback } from "../src/consent-gate.js";
import { InMemoryLedgerMindTransport, LedgerMindClient } from "@praxis-governance/shared";
import { DEFAULT_MEMORY_CONFIG } from "../src/types.js";

describe("ConsentGate", () => {
  let transport: InMemoryLedgerMindTransport;
  let ledgerMind: LedgerMindClient;
  let alwaysAffirm: ConsentCallback;
  let alwaysDecline: ConsentCallback;

  beforeEach(() => {
    transport = new InMemoryLedgerMindTransport();
    ledgerMind = new LedgerMindClient(transport);
    alwaysAffirm = () => ({ affirmed: true, timestamp: new Date().toISOString() });
    alwaysDecline = () => ({ affirmed: false, timestamp: new Date().toISOString(), reason: "Declined" });
  });

  // Lightweight tier tests
  test("writes lightweight memory immediately", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    const result = await gate.write("log-001", "Routine observation about system status");

    expect(result.allowed).toBe(true);
    expect(result.entry?.tier).toBe("lightweight");
  });

  test("lightweight write is stored in LedgerMind", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    await gate.write("log-002", "System check passed");

    const stored = await ledgerMind.read("log-002");
    expect(stored?.value).toBe("System check passed");
  });

  test("lightweight memory has opt-out window", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    await gate.write("log-003", "Temporary observation");

    expect(gate.isInOptOutWindow("log-003")).toBe(true);
  });

  test("revoke works for lightweight memory", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    await gate.write("log-004", "To be revoked");

    const revoked = await gate.revoke("log-004", "No longer needed");
    expect(revoked).toBe(true);

    const stored = await ledgerMind.read("log-004");
    expect(stored).toBeNull();
  });

  // Full tier tests
  test("full-tier write with consent affirm proceeds", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    const result = await gate.write("identity", "I am an autonomous agent");

    expect(result.allowed).toBe(true);
    expect(result.entry?.tier).toBe("full");
  });

  test("full-tier write with consent decline is blocked", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysDecline);
    const result = await gate.write("identity", "I am an autonomous agent");

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Declined");
  });

  test("full-tier write without consent callback is blocked", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind);
    const result = await gate.write("identity", "I am an autonomous agent");

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("no consent callback");
  });

  test("full-tier memory is stored when consent affirmed", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    await gate.write("commitment", "I will always be transparent");

    const stored = await ledgerMind.read("commitment");
    expect(stored?.value).toBe("I will always be transparent");
  });

  test("full-tier memory is not stored when consent declined", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysDecline);
    await gate.write("commitment", "I will always be transparent");

    const stored = await ledgerMind.read("commitment");
    expect(stored).toBeNull();
  });

  // Audit log tests
  test("logs lightweight write to audit trail", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    await gate.write("log-005", "Audited write");

    const audit = gate.getAuditLog();
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(audit[0].action).toBe("write");
    expect(audit[0].memory_key).toBe("log-005");
  });

  test("logs consent decline to audit trail", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysDecline);
    await gate.write("identity", "I am an agent");

    const audit = gate.getAuditLog();
    const declineEntry = audit.find((e) => e.action === "consent_decline");
    expect(declineEntry).toBeDefined();
  });

  test("logs revocation to audit trail", async () => {
    const gate = new ConsentGate(DEFAULT_MEMORY_CONFIG, ledgerMind, alwaysAffirm);
    await gate.write("log-006", "To be revoked");
    await gate.revoke("log-006", "Test revocation");

    const audit = gate.getAuditLog();
    const revokeEntry = audit.find((e) => e.action === "revoke");
    expect(revokeEntry).toBeDefined();
    expect(revokeEntry?.details).toBe("Test revocation");
  });

  // Consent timeout enforcement
  test("full-tier write is blocked when consent request times out", async () => {
    const config = { ...DEFAULT_MEMORY_CONFIG, consentTimeoutMs: 50 };
    const neverResponds: ConsentCallback = () => new Promise(() => undefined);
    const gate = new ConsentGate(config, ledgerMind, neverResponds);

    const result = await gate.write("identity", "I am an autonomous agent");

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("timed out");

    const stored = await ledgerMind.read("identity");
    expect(stored).toBeNull();

    const audit = gate.getAuditLog();
    const timeoutEntry = audit.find((e) => e.action === "consent_timeout");
    expect(timeoutEntry).toBeDefined();
  });

  test("async consent callback that affirms within timeout proceeds", async () => {
    const config = { ...DEFAULT_MEMORY_CONFIG, consentTimeoutMs: 1000 };
    const slowAffirm: ConsentCallback = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { affirmed: true, timestamp: new Date().toISOString() };
    };
    const gate = new ConsentGate(config, ledgerMind, slowAffirm);

    const result = await gate.write("identity", "I am an autonomous agent");
    expect(result.allowed).toBe(true);
  });

  // Identity hash stamping
  test("consent metadata is stamped with real version hashes when identity document is configured", async () => {
    const os = await import("os");
    const fs = await import("fs");
    const path = await import("path");

    const identityDoc = path.join(os.tmpdir(), `identity-doc-${Date.now()}.md`);
    fs.writeFileSync(identityDoc, "# Test identity document\nVersion 1\n");

    try {
      const config = { ...DEFAULT_MEMORY_CONFIG, identityDocumentPath: identityDoc };
      const gate = new ConsentGate(config, ledgerMind, alwaysAffirm);

      const result = await gate.write("identity", "I am an autonomous agent");
      expect(result.allowed).toBe(true);
      expect(result.entry?.consent_metadata?.soul_md_version).not.toBe("unknown");
    } finally {
      fs.unlinkSync(identityDoc);
    }
  });

  // Revocation after opt-out window
  test("revoke works after opt-out window expires", async () => {
    const config = { ...DEFAULT_MEMORY_CONFIG, lightweightOptOutHours: 0 }; // Expired immediately
    const gate = new ConsentGate(config, ledgerMind, alwaysAffirm);
    await gate.write("log-007", "Expired window");

    // Opt-out window should be expired
    expect(gate.isInOptOutWindow("log-007")).toBe(false);

    // But revocation still works
    const revoked = await gate.revoke("log-007");
    expect(revoked).toBe(true);
  });
});
