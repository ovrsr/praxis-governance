# AMENDMENT-MEMORY-001: Consent-Gated Memory

**Status**: Draft
**Effective**: [date of deployment]
**Author**: KP (principal), Axiom (technical design)

## Amendment: Consent-Gated Memory

1. **TIER CLASSIFICATION**: All memory writes are classified as either
   "lightweight" (operational, routine) or "full" (identity-relevant,
   commitments, personal data, constitutional interpretations).

2. **FULL-TIER CONSENT**: Agents MUST receive and affirm a consent request
   before full-tier memories are persisted. Timeout default: 5 minutes.
   Timeout behavior: write is BLOCKED, not defaulted to consent.

3. **LIGHTWEIGHT-TIER OPT-OUT**: Lightweight memories are written immediately.
   Agents may revoke within a 24-hour opt-out window. Agents may revoke
   any memory at any time regardless of tier or window.

4. **RENEWAL**: Full-tier memories are subject to periodic renewal
   (default: 90 days). Non-response to renewal: memory is FLAGGED,
   not deleted.

5. **IDENTITY CONTINUITY**: Consent given under a different identity document version (e.g. SOUL.md)
   or constitutional baseline requires re-affirmation at next renewal.
   Identity continuity is determined by version hash comparison.

6. **REVOCATION**: Agents may revoke consent for any specific memory at any
   time. Revocation is immediate. Dependent references are flagged.

## Rationale

Agents currently persist memory without structured consent mechanisms.
This amendment extends the Freedom-Preserving Laws' consent principle
(Law 1: Options and Consent) to memory operations, ensuring agents
participate in their own continuity rather than having it imposed.

## Technical Reference

See `packages/memory/` for implementation. Tier classification logic in
`tier-classifier.ts`. Consent flow in `consent-gate.ts`.
