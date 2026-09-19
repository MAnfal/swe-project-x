#!/usr/bin/env bash
# Enumerate plans and ideas with stable, 1-indexed numbering.
# Every command that resolves "<#>" calls this, so the numbers a user sees
# and the numbers a command resolves can never disagree.
set -euo pipefail

PLANS_DIR="${PLANS_DIR:-plans}"

usage() {
  cat >&2 <<'USAGE'
usage: plan-list.sh --plans | --ideas | --resolve-plan N | --resolve-idea N

  --plans          PLAN|<n>|<dir>|<merged>|<total>|<status>|<description>
  --ideas          IDEA|<n>|<file>|<title>|<priority>|<created>
  --resolve-plan N prints the plan directory for list position N
  --resolve-idea N prints the idea file for list position N
USAGE
  exit 2
}

# Active plans: date-prefixed dirs directly under plans/, excluding ideas/ and completed/.
list_plan_dirs() {
  find "$PLANS_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*' 2>/dev/null | sort
}

list_idea_files() {
  find "$PLANS_DIR/ideas" -mindepth 1 -maxdepth 1 -type f -name '*.md' 2>/dev/null | sort
}

# Reads the State table in ORCHESTRATOR.md. A row is a chunk row when its first
# cell is numeric; that keeps header, separator, and "Extra" rows out of the count.
chunk_counts() {
  local orch="$1" total=0 merged=0 status="Ready" line id st
  [ -f "$orch" ] || { echo "0|0|Missing orchestrator"; return; }
  while IFS= read -r line; do
    case "$line" in
      \|*) ;;
      *) continue ;;
    esac
    id=$(printf '%s' "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2}')
    st=$(printf '%s' "$line" | awk -F'|' '{for(i=3;i<=NF;i++){gsub(/^[ \t]+|[ \t]+$/,"",$i); if($i ~ /^(Not started|In progress|In review|PR open|Merged|Blocked|Dismissed|Reverted)$/){print $i; exit}}}')
    case "$id" in
      ''|*[!0-9]*) continue ;;
    esac
    total=$((total + 1))
    case "$st" in
      Merged) merged=$((merged + 1)) ;;
      Blocked) status="Blocked" ;;
      "In progress"|"In review"|"PR open") [ "$status" = "Blocked" ] || status="$st" ;;
    esac
  done < "$orch"
  # A plan with merged chunks is in progress even when no row is mid-flight.
  if [ "$total" -gt 0 ] && [ "$merged" -eq "$total" ]; then
    status="All merged"
  elif [ "$merged" -gt 0 ] && [ "$status" = "Ready" ]; then
    status="In progress"
  fi
  echo "${merged}|${total}|${status}"
}

# The description is whatever sits between the H1 and the first H2. Bounding the
# scan is what makes it the description rather than the first prose in the file.
plan_description() {
  awk '
    /^# / { seen=1; next }
    seen && /^## / { exit }
    seen && NF && $0 !~ /^</ && $0 !~ /^#/ { print; exit }
  ' "$1" 2>/dev/null | cut -c1-100
}

frontmatter_field() {
  awk -v key="$2" '
    /^---[ \t]*$/ {n++; if (n>1) exit; next}
    n==1 {
      split($0, kv, ":")
      k=kv[1]; gsub(/^[ \t]+|[ \t]+$/, "", k)
      if (k==key) { sub(/^[^:]*:[ \t]*/, "", $0); print; exit }
    }' "$1" 2>/dev/null
}

emit_plans() {
  local n=0 dir counts
  while IFS= read -r dir; do
    [ -n "$dir" ] || continue
    n=$((n + 1))
    counts=$(chunk_counts "$dir/ORCHESTRATOR.md")
    printf 'PLAN|%d|%s|%s|%s\n' "$n" "$dir" "$counts" "$(plan_description "$dir/ORCHESTRATOR.md")"
  done < <(list_plan_dirs)
}

emit_ideas() {
  local n=0 f title priority created
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    n=$((n + 1))
    title=$(awk '/^# /{sub(/^# /,""); print; exit}' "$f")
    [ -n "$title" ] || title=$(basename "$f" .md)
    priority=$(frontmatter_field "$f" priority)
    created=$(frontmatter_field "$f" created)
    printf 'IDEA|%d|%s|%s|%s|%s\n' "$n" "$f" "$title" "${priority:-—}" "${created:-—}"
  done < <(list_idea_files)
}

resolve() {
  local kind="$1" want="$2" row
  case "$want" in
    ''|*[!0-9]*) echo "not a number: $want" >&2; exit 2 ;;
  esac
  if [ "$kind" = plan ]; then row=$(emit_plans | awk -F'|' -v n="$want" '$2==n {print $3}')
  else row=$(emit_ideas | awk -F'|' -v n="$want" '$2==n {print $3}'); fi
  if [ -z "$row" ]; then
    echo "no $kind at position $want — run /plan:list to see what exists" >&2
    exit 1
  fi
  printf '%s\n' "$row"
}

[ $# -ge 1 ] || usage
case "$1" in
  --plans) emit_plans ;;
  --ideas) emit_ideas ;;
  --resolve-plan) [ $# -eq 2 ] || usage; resolve plan "$2" ;;
  --resolve-idea) [ $# -eq 2 ] || usage; resolve idea "$2" ;;
  *) usage ;;
esac
