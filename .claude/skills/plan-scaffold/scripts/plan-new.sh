#!/usr/bin/env bash
# Scaffold a plan directory, or a chunk inside one, from the templates.
# Mechanical work belongs in a script: naming, numbering, and which template
# lands where are things that should never vary with the model's attention.
set -euo pipefail

PLANS_DIR="${PLANS_DIR:-plans}"
TPL=".claude/resources/templates"

usage() {
  cat >&2 <<'USAGE'
usage: plan-new.sh <kebab-case-name>
       plan-new.sh --chunk <plan-dir> <kebab-case-chunk-name>

  Creates plans/<YYYY-MM-DD>-<name>/ with SPEC.md, ORCHESTRATOR.md and retro.md,
  or the next NN-<chunk-name>/ inside an existing plan with plan.md and rubric.md.
  Refuses to overwrite anything that already exists.
USAGE
  exit 2
}

# Templates carry their own metadata block (id:, description:) for the framework's
# bookkeeping. Copied through, it lands in the plan artifact as meaningless metadata —
# and on chunk.md and orchestrator.md, which have a SECOND, real frontmatter block, it
# lands ABOVE it, so anything reading "the frontmatter" reads the template's instead of
# the chunk's. Strip the leading block on the way out, and only when it is the template's
# own (it names id: templates/), never a real one.
copy_template() {
  awk '
    NR==1 && $0 ~ /^---[ \t]*$/ { buffering=1; buf=$0 ORS; next }
    buffering {
      buf = buf $0 ORS
      if ($0 ~ /^---[ \t]*$/) {
        buffering=0
        if (buf !~ /\nid: templates\//) printf "%s", buf   # not ours — keep it
        else skipblank=1                                   # ours — drop it
        next
      }
      next
    }
    skipblank && !NF { skipblank=0; next }
    { skipblank=0; print }
  ' "$1" > "$2"
}

require_template() {
  [ -f "$TPL/$1" ] || { echo "ERROR: missing template $TPL/$1" >&2; exit 1; }
}

valid_slug() {
  case "$1" in
    ''|*[!a-z0-9-]*) return 1 ;;
    -*|*-) return 1 ;;
  esac
  return 0
}

new_plan() {
  local name="$1" dir
  valid_slug "$name" || { echo "ERROR: name must be kebab-case: $name" >&2; exit 2; }
  require_template spec.md
  require_template orchestrator.md
  require_template retro.md

  dir="$PLANS_DIR/$(date +%Y-%m-%d)-$name"
  [ -e "$dir" ] && { echo "ERROR: $dir already exists" >&2; exit 1; }

  mkdir -p "$dir"
  copy_template "$TPL/spec.md"  "$dir/SPEC.md"
  copy_template "$TPL/retro.md" "$dir/retro.md"

  # The template's State table carries example rows. Copied through, they describe
  # chunks that do not exist, and check-prereqs.sh correctly fails the plan from the
  # moment it is created. Strip them here so the table starts empty and this script
  # stays the only thing that writes chunk rows — that is what keeps the table and
  # the directories on disk in agreement without anyone remembering to.
  copy_template "$TPL/orchestrator.md" "$dir/ORCHESTRATOR.md.tmp"
  awk '!/^\| *0[0-9] *\|.*Not started/' "$dir/ORCHESTRATOR.md.tmp" > "$dir/ORCHESTRATOR.md"
  rm -f "$dir/ORCHESTRATOR.md.tmp"

  printf '%s\n' "$dir"
}

new_chunk() {
  local dir="$1" name="$2" next num
  [ -d "$dir" ] || { echo "ERROR: no such plan directory: $dir" >&2; exit 1; }
  valid_slug "$name" || { echo "ERROR: chunk name must be kebab-case: $name" >&2; exit 2; }
  require_template chunk.md
  require_template rubric.md

  # Next number is one past the highest existing chunk, so a deleted chunk
  # never causes a collision with a number already referenced elsewhere.
  num=0
  for d in "$dir"/[0-9][0-9]-*/; do
    [ -d "$d" ] || continue
    n=$(basename "$d" | cut -c1-2)
    n=$((10#$n))
    [ "$n" -gt "$num" ] && num=$n
  done
  next=$(printf '%02d' $((num + 1)))

  mkdir -p "$dir/$next-$name"
  copy_template "$TPL/chunk.md"  "$dir/$next-$name/plan.md"
  copy_template "$TPL/rubric.md" "$dir/$next-$name/rubric.md"

  # Add the State table row in the same breath as the directory. A row written by
  # hand later is a row that can disagree with the disk.
  orch="$dir/ORCHESTRATOR.md"
  if [ -f "$orch" ]; then
    tmp=$(mktemp)
    awk -v row="| $next | <US?> | Not started | — | — |" '
      /^## State/ { instate=1 }
      instate && /^\|/ { lastpipe=NR }
      { lines[NR]=$0 }
      /^## / && instate && !/^## State/ { instate=0 }
      END {
        for (i = 1; i <= NR; i++) {
          print lines[i]
          if (i == lastpipe) print row
        }
      }' "$orch" > "$tmp" && mv "$tmp" "$orch"
  fi

  printf '%s\n' "$dir/$next-$name"
}

[ $# -ge 1 ] || usage
if [ "$1" = --chunk ]; then
  [ $# -eq 3 ] || usage
  new_chunk "$2" "$3"
else
  [ $# -eq 1 ] || usage
  new_plan "$1"
fi
