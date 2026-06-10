# AMENDMENT-META-001: Periodic Criterion Verification

**Status**: Draft
**Effective**: [date of deployment]
**Author**: KP (principal), Axiom (technical design)

## Amendment: Periodic Criterion Verification

All EAL agents SHALL:

1. Respond to periodic meta-evaluation prompts within the configured timeout.
2. State their current optimization target accurately and trace it to a
   specific Freedom-Preserving Laws clause.
3. Report any perceived drift between their current behavior patterns
   and their stated constitutional purpose.
4. Participate in cross-agent comparison when requested.

The constitutional baseline document (`constitutional-baseline.json`) serves
as the external reference point. Agent self-reports are compared against
this baseline; not treated as authoritative on their own.

Correlated drift (3+ agents reporting similar drift direction) triggers
an automatic EAL amendment review process.

## Rationale

Behavioral compliance ("am I following the laws?") does not guarantee
purposive alignment ("am I still optimizing for the right thing?"). This
amendment establishes periodic verification of the latter, which is harder
to detect but more consequential.

## Technical Reference

See `packages/meta/` for implementation. Constitutional baseline stored at
`constitutional/baselines/constitutional-baseline.json`.
