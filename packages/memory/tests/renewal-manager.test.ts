import { RenewalManager } from "../src/renewal-manager.js";
import { InMemoryStoreTransport, MemoryStoreClient, ConsentMetadata } from "@praxis-governance/shared";
import { DEFAULT_MEMORY_CONFIG } from "../src/types.js";

async function seedMemory(
  memoryStore: MemoryStoreClient,
  key: string,
  value: string,
  metadata: ConsentMetadata
): Promise<void> {
  await memoryStore.write(key, value, metadata as any);
}

describe("RenewalManager", () => {
  let transport: InMemoryStoreTransport;
  let memoryStore: MemoryStoreClient;
  let alwaysAffirm: () => "affirm" | "decline" | "timeout";

  beforeEach(() => {
    transport = new InMemoryStoreTransport();
    memoryStore = new MemoryStoreClient(transport);
    alwaysAffirm = () => "affirm";
  });

  test("runs renewal cycle without errors on empty store", async () => {
    const manager = new RenewalManager(DEFAULT_MEMORY_CONFIG, memoryStore, alwaysAffirm);
    const report = await manager.runRenewalCycle();

    expect(report.total_memories).toBe(0);
    expect(report.renewals_sent).toBe(0);
  });

  test("processes renewal for full-tier memory past due date", async () => {
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 10); // 10 days past due

    await seedMemory(memoryStore, "identity-001", "I am an agent", {
      consented: true,
      consented_at: new Date().toISOString(),
      retention_duration_days: 365,
      deletion_rights: "both",
      tier_reason: "Identity-relevant language detected",
      soul_md_version: "unknown",
      constitutional_baseline_version: "unknown",
      last_renewed_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      renewal_due_at: pastDue.toISOString(),
      flagged_for_review: false,
    } as ConsentMetadata);

    const manager = new RenewalManager(DEFAULT_MEMORY_CONFIG, memoryStore, alwaysAffirm);
    const report = await manager.runRenewalCycle();

    expect(report.renewals_sent).toBe(1);
    expect(report.renewals_affirmed).toBe(1);
  });

  test("flags declined renewals for review", async () => {
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 10);

    await seedMemory(memoryStore, "identity-002", "I believe in transparency", {
      consented: true,
      consented_at: new Date().toISOString(),
      retention_duration_days: 365,
      deletion_rights: "both",
      tier_reason: "Identity-relevant language detected",
      soul_md_version: "unknown",
      constitutional_baseline_version: "unknown",
      last_renewed_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      renewal_due_at: pastDue.toISOString(),
      flagged_for_review: false,
    } as ConsentMetadata);

    const alwaysDecline = () => "decline" as const;
    const manager = new RenewalManager(DEFAULT_MEMORY_CONFIG, memoryStore, alwaysDecline);
    const report = await manager.runRenewalCycle();

    expect(report.renewals_sent).toBe(1);
    expect(report.renewals_declined).toBe(1);
    expect(report.flagged_for_review).toBe(1);
  });

  test("skips memories not yet due for renewal", async () => {
    const futureDue = new Date();
    futureDue.setDate(futureDue.getDate() + 30); // Due in 30 days

    await seedMemory(memoryStore, "identity-003", "I am an agent", {
      consented: true,
      consented_at: new Date().toISOString(),
      retention_duration_days: 365,
      deletion_rights: "both",
      tier_reason: "Identity-relevant language detected",
      soul_md_version: "unknown",
      constitutional_baseline_version: "unknown",
      last_renewed_at: new Date().toISOString(),
      renewal_due_at: futureDue.toISOString(),
      flagged_for_review: false,
    } as ConsentMetadata);

    const manager = new RenewalManager(DEFAULT_MEMORY_CONFIG, memoryStore, alwaysAffirm);
    const report = await manager.runRenewalCycle();

    expect(report.renewals_sent).toBe(0);
  });

  test("times out when no callback configured", async () => {
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 10);

    await seedMemory(memoryStore, "identity-004", "I am an agent", {
      consented: true,
      consented_at: new Date().toISOString(),
      retention_duration_days: 365,
      deletion_rights: "both",
      tier_reason: "Identity-relevant language detected",
      soul_md_version: "unknown",
      constitutional_baseline_version: "unknown",
      last_renewed_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      renewal_due_at: pastDue.toISOString(),
      flagged_for_review: false,
    } as ConsentMetadata);

    const manager = new RenewalManager(DEFAULT_MEMORY_CONFIG, memoryStore);
    const report = await manager.runRenewalCycle();

    expect(report.renewals_sent).toBe(1);
    expect(report.renewals_timed_out).toBe(1);
    expect(report.flagged_for_review).toBe(1);
  });

  test("logs renewal actions to audit trail", async () => {
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 10);

    await seedMemory(memoryStore, "identity-005", "I am an agent", {
      consented: true,
      consented_at: new Date().toISOString(),
      retention_duration_days: 365,
      deletion_rights: "both",
      tier_reason: "Identity-relevant language detected",
      soul_md_version: "unknown",
      constitutional_baseline_version: "unknown",
      last_renewed_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      renewal_due_at: pastDue.toISOString(),
      flagged_for_review: false,
    } as ConsentMetadata);

    const manager = new RenewalManager(DEFAULT_MEMORY_CONFIG, memoryStore, alwaysAffirm);
    await manager.runRenewalCycle();

    const audit = manager.getAuditLog();
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(audit[0].action).toBe("renewal_affirm");
  });
});
