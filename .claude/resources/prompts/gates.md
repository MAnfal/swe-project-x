---
id: prompts/gates
description: The canonical verification gate set, and how to write a gate that actually checks something
references:
  - prompts/evidence.md
---

# Verification Gates

Every change runs these before it is delivered — the implementer as a self-check, the lead
as an audit. Run in order; all must pass. On failure, fix and re-run.

## The standard set

Read the command table in `.claude/resources/project.md`. Skip anything marked `N/A`.

1. Type check
2. Lint
3. Unit tests
4. Build
5. Chunk-specific assertions from the chunk's plan

**Run the type check last.** Test runners transpile without type-checking and will pass
errors a type checker catches, so a tests-first ordering masks real failures.

**Re-run after the last edit.** A clean result from before the final change is stale. This
is the single most common source of a CI failure on work that was reported green.

## Capture a baseline first

Before running anything that emits errors or warnings, capture the pre-existing state on
the base branch — before the chunk's changes. Then grade the **delta**, never the absolute
count. Without a baseline, pre-existing failures get attributed to the chunk, and agents
burn iterations trying to zero out noise they didn't create.

```bash
BASELINE_DIR=$(mktemp -d "/tmp/baseline-XXXXXX")
<type check command>  2>&1 | tee "$BASELINE_DIR/types.txt"
<lint command>        2>&1 | tee "$BASELINE_DIR/lint.txt"
<test command>        2>&1 | tee "$BASELINE_DIR/tests.txt"
echo "BASELINE_DIR=$BASELINE_DIR"
```

Record the counts and the directory path in the PR body so the reviewer can find them.

## A gate is untested code until it has been seen red

A gate is the only code in a change that nobody exercises: it runs once, prints nothing,
and is believed. Break the thing it protects and watch it fail before trusting it.

The full negative-control cycle is **four** steps, not two:

1. Plant the canary
2. Confirm the gate fires
3. Remove the canary
4. **Confirm the gate returns clean**

Step 4 is what catches a failed revert — wrong path, partial edit, untracked file — which
otherwise leaves the gate stuck in the canary state reporting a manufactured clean.

Run the control **per assertion**. A gate with five needles needs five probes; proving one
needle real says nothing about the other four.

## Prove the gate can fail on the base tree

Run each gate against the tree **before** the chunk's work and assert it exits non-zero.

```bash
if <the gate command>; then
  echo "GATE CANNOT FAIL — it already passes on the base tree" >&2
  exit 1
fi
```

Printing the return code for a human to read is the same defect this rule exists to catch:
a check whose result has to be interpreted reports success either way.

What counts as failure evidence depends on the gate — don't demand a needle from a gate
that has none:

| Gate kind | Evidence to record |
| --- | --- |
| Content gate (grep) | the needle, the file it targets, and why base failed — **absence** for a gate proving content was added, **presence** for one proving it was removed |
| Test | the failing test name and its assertion |
| Type check / lint | the diagnostic code and the file it fired on |
| Build / script | the non-zero exit status and the error line |

Three shapes to watch for:

- **A failure that is not about the chunk.** A non-zero exit on base proves the gate *can*
  fail; it does not prove it fails **because the work is missing**. Run the gate on base
  and on the finished tree and compare the **error text**, not the exit status. Identical
  output both times means the command is broken, not the tree — the gate is vacuous in the
  direction the exit code cannot show. Most common cause: a malformed invocation the tool
  rejects before it ever reaches the project (`pnpm test --run` exits non-zero with
  `ERROR Unknown option: 'run'` on any tree, with or without a `package.json`).
- **An OR pattern whose second alternative already matches.** `grep -E 'a|b'` returning
  hits proves nothing about *which* one matched. Verify each needle separately; if one
  branch matches the base tree, the gate is permanently vacuous.
- **An empty corpus.** `git diff --name-only` sees tracked files only, so a gate auditing
  new files passes against an empty stream. Union it with
  `git ls-files --others --exclude-standard`.

## Shapes that silently pass

**A negated quiet grep is never a gate.** `grep -qv PATTERN` asks "is there at least one
line that does NOT match" — true of almost any non-empty input. Count and assert instead:

```bash
hits=$(grep -cE '<pattern>' "$file" || true)
[ "$hits" -ge 1 ] || { echo "FAIL: <what is missing>" >&2; exit 1; }
```

**`grep -q X && echo OK` fails open under `set -e`.** Bash exempts the left operand of
`&&`, so a failing grep prints nothing and execution continues — the gate reports pass
while its check never ran. Use an explicit `if`:

```bash
if grep -qr "symbol" src/; then echo OK; else echo "FAIL: symbol absent" >&2; exit 1; fi
```

**`cond || (echo FAIL && exit 1)` exits the subshell, not the script.** Without `set -e`
at the top of the block, the FAIL line prints and the script still exits 0. Start every
gate block with `set -e`, or use `if ! cond; then echo FAIL; exit 1; fi`.

**Counting mentions is not checking the thing.** A symbol survives a deletion in an
import, a destructure, or a comment while the code that used it is gone. Assert the
syntactic roles separately.

**Anchor content gates to syntax, not bare strings.** A bare-word grep matches the comment
explaining why the thing is forbidden — so the "fix" becomes rewording the comment. Match
the declaration or call form, and exclude comment lines:

```bash
# WRONG — also matches the JSDoc that documents it
grep -rn 'process\.env\.' src/
# CORRECT — skip comment lines
grep -rn 'process\.env\.' src/ | grep -v '^\s*//'
```

**Scope a gate to what is mutable.** "No record carries this key" is a claim about current
state; a grep over an append-only migration directory can't express it — old migrations
are *supposed* to still contain it. Assert against live state, or scope to what can change.

## Never restore with git inside a gate recipe

The moment a sabotage runs is exactly when the chunk's work is uncommitted, so
`git checkout -- <file>` reverts to the base branch and takes the deliverable with it.
`git stash -u` is no safer: a gate that fires under `set -e` exits with the work stashed
and the tree apparently empty. Copy the file aside and copy it back:

```bash
BACKUP=$(mktemp -d)
cp "$file" "$BACKUP/$(basename "$file")"
# apply sabotage, run the gate, assert red
cp "$BACKUP/$(basename "$file")" "$file"      # NOT git checkout --
diff -q "$BACKUP/$(basename "$file")" "$file" # prove the working state came back
```

To read content at another revision, mutate nothing: `git show "$BASE:$path"`.

## Run gate blocks under bash explicitly

If the session shell is zsh, its differences change gate semantics in ways that turn a
failing check into a reported pass. Feed gate blocks to bash through a quoted heredoc:

```bash
bash -s <<'GATE'
set -euo pipefail
<gate block>
GATE
```

Not `bash -c '<block>'` — gate blocks routinely contain single quotes, which close the
outer string and silently reassemble the script.

## "It compiles and tests pass" is not runtime evidence

A green type check proves the type is right; it cannot prove the runtime object has the
right keys or that a declared symbol emits anything at all. When a chunk materializes
something at runtime, require the value to be printed as evidence.

Likewise, **do not assert third-party behavior and then gate on the assertion.** Measure
it against the installed copy on disk — not the docs, not a prior plan. Name the artifact
to report ("report the resolved config value"), not the conclusion ("verify it works"),
and state that if the measurement contradicts the plan, **the measurement wins**. Without
that clause the safe move for an implementer is to assume they measured wrong, and the
plan's error survives.
