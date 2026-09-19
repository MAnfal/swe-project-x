---
id: sops/planning/reuse-audit
description: Search for an existing implementation before a chunk introduces a new one
---

# SOP: Reuse Audit for New Utilities and Patterns

**When**: a chunk introduces a new utility function, helper, or abstraction.

## Procedure

1. Grep three ways — by the name it would have, by the algorithm or pattern it would use,
   and by the problem it solves. A helper that exists under a different name is invisible
   to a name-only search.
2. Check the shared/common utility directories of every relevant package.
3. **Found** → import it, and name its path in the chunk plan.
4. **Duplicated across files but not shared** → consolidating it into one place is part of
   this chunk's work, not a follow-up.
5. **Not found** → proceed, and record "Reuse audit: no existing implementation found" in
   the chunk plan.

## Check framework and library defaults first

Before adding a config key or build entry, verify the framework doesn't already provide it.
Hand-writing config that ships by default is a no-op at best and misleading at worst — it
reads as authoritative while having no effect.

1. Check the framework's own built-in config and defaults.
2. Check the installed dependency's `package.json` (`exports`, `sideEffects`) for behavior
   it already provides.
3. Confirm the config would actually change something before adding it.

## Origin

Duplicate utilities created across packages while an existing implementation sat in a
shared location. Separately: a plan added a config entry the framework already shipped by
default — caught in review, one wasted fix round.
