---
id: bibles/swe/patterns/migration-verification
description: Parity testing for code ports — make "identical behaviour minus the refactored axis" provable
origin: Imported 2026-09-19 from a prior project's framework bible. Each section traces to a defect that shipped more than once.
---

# Migration Verification — Parity Testing

**Scope: code ports, not database migrations.** This page covers porting a runtime, executor or pipeline to a new contract shape and proving the behavior is unchanged. Verifying a **database** migration — replaying the Flyway SQL against a throwaway database — is a different procedure and is out of scope for this page.

The standard verification pattern for port-style migrations: a golden-fixture baseline + side-by-side executor parity tests that make "identical behavior minus the refactored axis" a provable claim.

## Two-gate structure

A migration plan should declare both gates up front:

1. **Golden-fixture baseline** (harness chunk, before migration starts): capture the CURRENT engine's verdicts against a known fixture set BEFORE any new code lands. This baseline is the ground truth.
2. **Side-by-side executor parity** (per-migration chunk): for each ported executor, assert that OLD and NEW produce identical output on the same inputs. The parity test runs both and diffs.

## Why it works

The golden-fixture baseline makes the cutover a mechanical diff: if zero parity-harness lines change and zero intentional behavior changes appear in the diff, the migration is provably identical. Without the baseline, "identical behavior" is a trust-based claim.

## The cutover chunk

The final entry-point flip becomes a verdict-diff against the baseline. Expected: zero changes. Any change is either an intentional behavior difference (document it) or a bug.

## Applies when

- A runtime or executor is being ported to a new contract shape
- A pipeline is restructured with the same I/O behavior
- A refactor claims "identical behavior" — use this pattern to prove it

## Pair with migration oracle

When the migration also involves a contract-shape change (old fields → new fields), pair with the transitional adapter pattern. See @patterns/migration-oracle.md.

## Evidence

An SEO-engine pipeline migration paired a golden-fixture parity harness (landed BEFORE any new code) with side-by-side executor parity tests, then flipped the entry-point in a dedicated cutover chunk. The cutover diff itself was zero-parity-change; 14 legacy files (-1904 lines) were deleted in the same commit. The combination turned a high-risk cutover into a verifiable diff.
