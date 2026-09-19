---
id: bibles/swe/patterns/migration-oracle
description: Transitional adapter as migration oracle — change a contract shape across consumers without drift
origin: Imported 2026-09-19 from a prior project's framework bible. Each section traces to a defect that shipped more than once.
---

# Transitional Adapter as Migration Oracle

The standard shape for contract-migration plans: a scoped internal adapter that maps OLD shape to NEW, serves as the read-as-oracle for the final migration chunk, and is deleted as the plan's last act.

## The pattern

1. **Introduce the adapter** — one internal module (e.g. `normalizeRule`) maps OLD → NEW. Scope it to the plan; it must not survive delivery.
2. **Consumers import via the adapter** — build stays green while rules and downstream consumers migrate chunk-by-chunk.
3. **Final migration chunk does two things in order**:
   - Read the adapter as the authoritative 1:1 mapping reference before rewriting any consumer.
   - Delete the adapter as the final step. Reading-before-deleting is what makes the migration provable — every native-shape rewrite has the adapter as its oracle.
4. **Zero behavior diffs** — the adapter's 1:1 mapping makes "identical behavior minus the refactored axis" a verifiable claim, not an assumption.

## Why it works

The adapter externalizes every mapping decision. When dozens of rules need native-shape rewrites, the teammate reads the adapter, rewrites each rule, and the parity harness confirms no behavior change. Without the adapter, native-shape rewrites are guesswork against scattered usage patterns.

This aligns with the repo's "no re-export shims, no duplicate contracts" rule: the adapter is a migration device, not a compatibility shim. It dies before plan delivery.

## When to apply

Any plan that migrates a contract shape from OLD to NEW where:
- Multiple consumers need to adopt the new shape
- A clean cutover (change everything at once) is too risky
- A provable "identical behavior, new shape" claim is required

## Pair with parity verification

See @patterns/migration-verification.md for the complementary verification pattern (golden-fixture baseline + side-by-side executor parity).

## Evidence

A 78-file SEO-engine pipeline migration used `normalizeRule` as the oracle: it lived transiently across three chunks, was consumed by `evaluateRule`, and was deleted in the cutover chunk. The teammate read the oracle first to confirm every 1:1 mapping. Result — zero behavior diffs, parity held across the whole migration.
