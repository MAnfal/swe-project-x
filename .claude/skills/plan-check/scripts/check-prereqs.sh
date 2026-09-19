#!/usr/bin/env bash
# Structural validation of a plan directory. Deterministic half of plan-check:
# everything here is mechanically decidable, so it should never depend on a
# model reading carefully. Judgment-based checks stay in the skill.
#
# Exit 0 = clean, 1 = errors found, 2 = usage error.
set -uo pipefail

PLANS_DIR="${PLANS_DIR:-plans}"
ERRORS=0
WARNS=0

# Content checks run against the file with HTML comments stripped. A template's
# own instructions are not plan content: left in, the SPEC template's example
# marker reads as an unresolved question and the rubric template's "do not cite
# plan.md" note reads as a citation of plan.md. Both were observed as false
# positives on a freshly scaffolded plan.
strip_comments() {
  awk '{
    while (match($0, /<!--/)) {
      if (match($0, /<!--.*-->/)) { sub(/<!--.*-->/, "", $0) }
      else { sub(/<!--.*/, "", $0); incomment=1; break }
    }
    if (incomment && match($0, /-->/)) { sub(/.*-->/, "", $0); incomment=0 }
    else if (incomment) { next }
    print
  }' "$1"
}

err()  { printf 'ERROR: %s\n' "$1"; ERRORS=$((ERRORS + 1)); }
warn() { printf 'WARN:  %s\n' "$1"; WARNS=$((WARNS + 1)); }
ok()   { printf 'OK:    %s\n' "$1"; }

PLAN_DIR="${1:-}"
if [ -z "$PLAN_DIR" ]; then
  PLAN_DIR=$(find "$PLANS_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*' 2>/dev/null | sort | tail -1)
  [ -n "$PLAN_DIR" ] || { echo "usage: check-prereqs.sh [plan-dir]" >&2; exit 2; }
fi
[ -d "$PLAN_DIR" ] || { echo "ERROR: no such plan directory: $PLAN_DIR" >&2; exit 1; }

echo "Checking $PLAN_DIR"
echo

# --- required artifacts -----------------------------------------------------
for f in SPEC.md ORCHESTRATOR.md; do
  [ -f "$PLAN_DIR/$f" ] && ok "$f present" || err "$f missing"
done
[ -f "$PLAN_DIR/retro.md" ] || warn "retro.md missing — execution cannot start without it"

# --- required SPEC sections -------------------------------------------------
if [ -f "$PLAN_DIR/SPEC.md" ]; then
  for section in "Problem Statement" "User Stories" "Success Metrics" "Non-Goals"; do
    grep -q "^## $section" "$PLAN_DIR/SPEC.md" \
      || err "SPEC.md missing section: $section"
  done
fi

# --- required ORCHESTRATOR sections ----------------------------------------
if [ -f "$PLAN_DIR/ORCHESTRATOR.md" ]; then
  for section in "State" "Execution Log" "Git" "Dependency Graph" "Design Decisions"; do
    grep -q "^## $section" "$PLAN_DIR/ORCHESTRATOR.md" \
      || err "ORCHESTRATOR.md missing section: $section"
  done
fi

# --- chunk directories ------------------------------------------------------
CHUNK_DIRS=$(find "$PLAN_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]-*' | sort)
CHUNK_COUNT=$(printf '%s' "$CHUNK_DIRS" | grep -c . || true)

# A glob matching zero directories would let every per-chunk check below pass
# vacuously, so the count is asserted first: the gate cannot report success
# while having examined nothing.
if [ "$CHUNK_COUNT" -eq 0 ]; then
  err "no chunk directories found (expected NN-<name>/) — nothing to validate"
else
  ok "$CHUNK_COUNT chunk director$([ "$CHUNK_COUNT" -eq 1 ] && echo y || echo ies) found"
fi

while IFS= read -r d; do
  [ -n "$d" ] || continue
  base=$(basename "$d")
  [ -f "$d/plan.md" ]   || err "$base/plan.md missing"
  [ -f "$d/rubric.md" ] || err "$base/rubric.md missing — no reviewer contract"

  if [ -f "$d/plan.md" ]; then
    # Read fields from the FIRST frontmatter block only. A whole-file grep for "^chunk:"
    # passes on a file with two frontmatter blocks where the wrong one is on top — which
    # is how a scaffolding bug shipped chunk plans whose leading block was the template's
    # metadata. Anything parsing "the frontmatter" would have read id: templates/chunk.
    fm=$(awk 'NR==1 && !/^---[ \t]*$/ {exit} NR>1 && /^---[ \t]*$/ {exit} NR>1 {print}' "$d/plan.md")
    if [ -z "$fm" ]; then
      err "$base/plan.md has no frontmatter block at the top of the file"
    else
      for field in chunk title branch execution depends; do
        printf '%s\n' "$fm" | grep -q "^$field:" \
          || err "$base/plan.md frontmatter missing: $field"
      done
      printf '%s\n' "$fm" | grep -q '^id: templates/' \
        && err "$base/plan.md still carries the template's metadata header — it was copied, not scaffolded"
    fi
    grep -q "^## Acceptance Criteria" "$d/plan.md" || err "$base/plan.md missing Acceptance Criteria"
    grep -q "^## Verification Gates"  "$d/plan.md" || err "$base/plan.md missing Verification Gates"
    grep -qE '^- +Given .*, When .*, Then ' "$d/plan.md" \
      || warn "$base/plan.md has no Given/When/Then acceptance criterion"
  fi

  # plan.md and rubric.md must stay separate documents — a cross-reference is
  # how a chunk starts teaching to the test.
  if [ -f "$d/plan.md" ] && strip_comments "$d/plan.md" | grep -qi 'rubric\.md'; then
    err "$base/plan.md references rubric.md — the implementer must not see the rubric"
  fi
  if [ -f "$d/rubric.md" ] && strip_comments "$d/rubric.md" | grep -qi '[^-]plan\.md'; then
    warn "$base/rubric.md references plan.md — rubric items should state the rule, not cite the plan"
  fi
done <<EOF
$CHUNK_DIRS
EOF

# The same check for the orchestrator: its real frontmatter carries the branch names
# every later phase reads.
if [ -f "$PLAN_DIR/ORCHESTRATOR.md" ]; then
  ofm=$(awk 'NR==1 && !/^---[ \t]*$/ {exit} NR>1 && /^---[ \t]*$/ {exit} NR>1 {print}' "$PLAN_DIR/ORCHESTRATOR.md")
  if [ -z "$ofm" ]; then
    warn "ORCHESTRATOR.md has no frontmatter block at the top of the file"
  else
    printf '%s\n' "$ofm" | grep -q '^id: templates/' \
      && err "ORCHESTRATOR.md still carries the template's metadata header — it was copied, not scaffolded"
    for field in owner created plan_branch source_branch; do
      printf '%s\n' "$ofm" | grep -q "^$field:" \
        || warn "ORCHESTRATOR.md frontmatter missing: $field"
    done
  fi
fi

# --- completion reports, once a chunk claims to be done --------------------
# The chunk template requires one; nothing checked that it exists.
while IFS= read -r d; do
  [ -n "$d" ] || continue
  base=$(basename "$d")
  id=$(printf '%s' "$base" | cut -c1-2)
  st=$(awk -F'|' -v want="$id" '/^\|/ {
        gsub(/^[ \t]+|[ \t]+$/,"",$2)
        if ($2 == want) { for (i=3; i<=NF; i++) { gsub(/^[ \t]+|[ \t]+$/,"",$i); if ($i ~ /^(Not started|In progress|In review|PR open|Merged|Blocked|Dismissed|Reverted)$/) { print $i; exit } } }
      }' "$PLAN_DIR/ORCHESTRATOR.md" 2>/dev/null)
  case "$st" in
    "In review"|"PR open"|Merged)
      [ -f "$d/completion-report.md" ] \
        || warn "$base is '$st' with no completion-report.md — the reviewer grades the file, not a relayed summary"
      ;;
  esac
done <<EOF
$CHUNK_DIRS
EOF

# --- state table matches the directories on disk ---------------------------
if [ -f "$PLAN_DIR/ORCHESTRATOR.md" ] && [ "$CHUNK_COUNT" -gt 0 ]; then
  STATE_IDS=$(awk -F'|' '/^\|/ {gsub(/^[ \t]+|[ \t]+$/,"",$2); if ($2 ~ /^[0-9]+$/) print $2}' \
    "$PLAN_DIR/ORCHESTRATOR.md" | sort -u)
  DISK_IDS=$(printf '%s\n' "$CHUNK_DIRS" | while IFS= read -r d; do
    [ -n "$d" ] && basename "$d" | cut -c1-2; done | sort -u)
  for id in $DISK_IDS; do
    printf '%s\n' "$STATE_IDS" | grep -qx "$id" || err "chunk $id on disk has no State table row"
  done
  for id in $STATE_IDS; do
    printf '%s\n' "$DISK_IDS" | grep -qx "$id" || err "State table row $id has no chunk directory"
  done
fi

# --- unresolved clarification markers --------------------------------------
# These are questions for the user, not defects to fix, so they are reported
# separately and always block approval.
MARKERS=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  hit=$(strip_comments "$f" | grep -n 'NEEDS CLARIFICATION' | sed "s|^|$f:|" || true)
  [ -n "$hit" ] && MARKERS="${MARKERS}${hit}
"
done <<EOF
$(find "$PLAN_DIR" -type f -name '*.md' | sort)
EOF
MARKERS=$(printf '%s' "$MARKERS" | grep -c . >/dev/null 2>&1 && printf '%s' "$MARKERS" || true)
if [ -n "$MARKERS" ]; then
  echo
  echo "UNRESOLVED CLARIFICATIONS — these block approval:"
  printf '%s\n' "$MARKERS" | sed 's/^/  /'
  ERRORS=$((ERRORS + 1))
fi

echo
echo "$ERRORS error(s), $WARNS warning(s)"
[ "$ERRORS" -eq 0 ] || exit 1
