---
id: sops/planning/grep-pattern-checklist
description: Cover every form a name takes before planning a deletion, rename, or sweep
---

# SOP: Grep-Pattern Checklist for Deletion / Rename / Cleanup

**When**: a chunk deletes, renames, or sweeps every instance of a named thing.

## Cover every case form

A name appears in more forms than the one you typed. A kebab-case-only sweep misses the
code identifiers entirely.

| Form | Example for `featured-items` | Where it shows up |
| ---- | ---------------------------- | ----------------- |
| kebab-case | `'featured-items'`, `items/featured-items/` | Registry keys, URL slugs, directory names |
| PascalCase | `FeaturedItems` | Type and component names |
| camelCase | `featuredItemsDefaults` | Variables, exported members |
| SCREAMING_SNAKE | `FEATURED_ITEMS` | Constants, enum members |

Sweep each form separately, and confirm each separately. An OR pattern that finds hits
tells you nothing about which alternative matched.

## Patterns that silently fail

**A compound token can't match a line-wrapped reference.** Prose wraps; identifiers don't.
Search prose with a multiline mode or a fragment short enough to fit inside one wrapped
line. See `prompts/evidence.md`.

**Export-presence needs both forms.** `export const x` and `export function x` are both
idiomatic; a pattern matching one silently reports the other as absent.

**Proving absence needs a pattern-scoped grep, not a token grep.** A bare token matches the
comment explaining why the token is forbidden, and the test that names it to assert it's
gone. Anchor on the syntax that constitutes a real use.

**Discovery should be case-insensitive and partial.** When looking for what exists rather
than proving what doesn't, an exact-case full-token search misses the thing you're looking
for under a slightly different name.

## Sabotage proofs must assert the revert happened

When a recipe plants a canary and reverts it, assert the revert landed — don't capture an
exit code and assume. A failed restore leaves the gate stuck in the canary state, reporting
a manufactured clean. See `prompts/gates.md` for the four-step cycle and why never to
restore with git.

## Origin

Sweeps that passed their own gates while leaving live references behind, in the case form
nobody searched for.
