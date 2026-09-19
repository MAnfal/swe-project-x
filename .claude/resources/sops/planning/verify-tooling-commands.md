---
id: sops/planning/verify-tooling-commands
description: Confirm every command a gate invokes exists and behaves as the plan assumes
---

# SOP: Verify Tooling Commands in Verification Gates

**When**: a chunk's verification gates call a script, a package command, or a CLI flag.

## Procedure

1. **The command exists.** Check it against the actual manifest or script directory — not
   memory, and not another project's conventions.

   ```bash
   # whatever this project uses: package.json scripts, Makefile targets, justfile…
   grep -n '"<script-name>"' package.json
   ```

2. **The target exists.** If the command is scoped to a package, workspace, or path,
   confirm that name resolves. A misspelled target usually exits non-zero for the wrong
   reason, which reads as a failing gate rather than a broken one.

3. **The flag exists in the installed version.** Verify against the copy on disk, not the
   docs. A flag documented upstream may not be in the pinned version, and a flag that
   doesn't exist either errors or is silently ignored — the second is worse.

4. **The runner discovers the files.** Check the test runner's include patterns against the
   filenames the chunk will create. A spec the runner never matches passes by not running.

5. **Scoped commands report what you think.** A lint or test command scoped to a path can
   apply different settings than the repo-wide one. If a gate asserts "zero warnings",
   confirm that the invocation in the gate is the one that enforces it.

## The measurement wins

If running the command contradicts what the plan assumed, the observation is correct and
the plan is wrong. Record it and proceed on the observation — see `prompts/evidence.md`.

## Origin

Gates that cited a script that didn't exist, a flag the installed version didn't have, and
a scoped lint invocation that didn't enforce the threshold the gate claimed.
