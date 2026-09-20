---
id: prompts/evidence
description: How to establish a fact before acting on it — the search, claim, and citation rules every role follows
---

# Evidence Discipline

Applies to everyone: the lead writing a dispatch brief, the implementer reporting a
result, the reviewer issuing a verdict, the planner writing a gate. Most expensive
mistakes in this loop are not bad code — they are confident claims nobody checked.

## A mechanism you have not read is a guess

Naming a file and a line number does not make a claim checked. Before putting a factual
claim into a plan, a brief, a comment, a doc, or a review finding: open the source and
confirm it.

## A capped or scoped search proves presence, never absence

Any search limited by `| head`, by `-m`, by a path filter, or by running inside one
directory can establish that something **exists**. None of them can establish that it
**doesn't**. An assertion of absence built on a limited search cannot be falsified by the
thing that produced it.

The cap is the harder half to notice, because a scoped-but-uncapped command *looks*
thorough — the right directory, the right pattern, a few plausible hits.

```bash
# Reading. Fine.
grep -rn "someSymbol" src/ | head -3

# Evidence. Never truncate; prefer a count.
grep -rc "someSymbol" src/
```

When a claim takes the form "X never happens", "nothing calls Y", or "this is only ever
read", the search behind it must be **uncapped and correctly scoped** — and the scope must
cover everywhere the thing could be, not just where you expected it. State the command and
its full output, not a sample.

## A search tool that honors ignore files can pass by reading nothing

Tools like `rg` skip ignored paths by default. A check that greps a directory git ignores
returns empty and reports success, having scanned zero files. The check is not wrong; it
is blind, and blindness is indistinguishable from compliance in its output. This bites
hardest on brand-new directories, where nobody has noticed the path is ignored yet.

Pass the "search everything" flag when a zero result is the evidence, or confirm the file
count the search actually covered.

## A zero-hit line grep over wrapped prose is not evidence of absence

On code, a zero hit is trustworthy — identifiers don't wrap. The habit transfers to
markdown and silently stops working: a phrase split across a line break matches nothing.
Search prose with a multiline mode, or with a fragment short enough to fit inside one
wrapped line. When a zero hit is surprising, retry with a shorter phrase before concluding
the content is absent.

## A red run from tests-first ordering is necessary, not sufficient

Writing the tests first guarantees they fail, because the module does not exist yet. That
proves **absence**, and absence is free. It says nothing about whether any assertion
discriminates a right implementation from a wrong one — a test written against a fixture
that lacks the edge case is red before, green after, and stays green forever once the
guarantee it was meant to protect is deleted.

`0 tests collected` is an import error wearing a red run's clothes. Read the red output
before citing it: a suite that failed to *load* and an assertion that failed against a
*wrong value* look identical in an exit status and nothing alike in the log. For any
guarantee worth calling a contract, the cheap proof is one deliberate mutation — break the
line that implements it and confirm something goes red.

## Verify inherited and relayed claims

A claim you repeat ships under your name. Four patterns account for most of them:

- **Inherited from the plan.** A plan may describe a state that doesn't exist yet, or that
  no chunk ever makes true. Confirm it against the artifact before writing it down.
- **Inherited from the thing you're editing.** A doc that predates your change may carry a
  stale path or symbol. Any citation you preserve is a citation you now own.
- **Fabricated to be persuasive.** Invented supporting evidence reads as more authoritative
  than a plain claim and is expensive to falsify. State the rule on its own authority.
- **Relayed unverified.** If someone hands you a number, a path, or a quote to record,
  re-derive it yourself.

After fixing a false citation, sweep for claims of the form "X says Y" where X is something
openable. A token-based search cannot find claims about documents.

## A claim about a dependency carries its version

Verify against the copy the project actually resolves — not the docs, not a scratch
install, not a globally installed one. Different trees resolve different versions of the
same package, and a claim true in one can be false in the other with no visible signal.

"`register()` discards the flag" is incomplete. "`register()` discards the flag in
`somelib@2.x`" is checkable later. If a comment or a gate cites a dependency's internals by
line number, **pin that dependency exactly** — a caret range makes every line-number
receipt silently stale.

## The measurement wins

When an observation contradicts the plan, report the observation and proceed on it. Say so
explicitly in the plan, because without that clause the safe move for an implementer is to
assume they measured wrong — and the plan's error survives the one thing that could have
caught it.

Name the artifact to report, not the conclusion. "Report the resolved config value" has one
answer and a defined failure mode. "Verify the config is applied" invites a token grep.

## Surprising git results are a location question first

Before concluding that work vanished, that a branch is wrong, or that a diff is empty when
it shouldn't be: confirm where you actually are (`pwd -P`, `git rev-parse --abbrev-ref HEAD`).
Absolute-path greps keep resolving from the wrong directory, and type checks, linters, and
deletions all succeed vacuously there — so a run from the wrong place yields a *partially*
true report. Only the commit fails loudly.
