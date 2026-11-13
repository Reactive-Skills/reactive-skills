#!/usr/bin/env bash
# Reactive skill protocol guard: a host hook that keeps write-tool edits and turn ends behind the
# runtime while a reactive job is active in the workspace. See docs/protocol-guard.md.
#
#   reactive-skills-guard.sh <pretool|stop|session-start|prompt> --host <claude|codex|cursor>
#
# Reads the hook payload on stdin. Never starts Node. Fails open (exit 0, no output) when jq is
# missing or the payload cannot be read: a broken hook must never block every edit.
#
# Performance & Risk Budget (per hook call)
# - Tier: P1 (<25ms)
# - Complexity: O(d + j), workspace depth and active jobs in the nearest workspace
# - Cyclomatic Complexity (CC): target <=40 (one dispatcher over four events and three hosts)
# - Branch Coverage: target >=85% (apps/axi/tests/guard/protocol-guard.test.ts)
# - CRAP Score: target <=45

event=${1:-}
host=claude
[ "${2:-}" = --host ] && host=${3:-claude}
command -v jq >/dev/null 2>&1 || exit 0
payload=$(cat 2>/dev/null) || exit 0
[ -n "$payload" ] || exit 0

GUARD_HOME="$HOME/.reactive-skills/guard"
MARK='<!-- REACTIVE BOOTLOADER -->'
ANON_WINDOW_SECONDS=600
SAFE_ID='^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'

fields=$(jq -r '
  def patch_paths: (.tool_input.command // "") | tostring | split("\n")[]
    | (capture("^\\*\\*\\* (?:Update|Add|Delete) File: (?<p>.+)$")?, capture("^\\*\\*\\* Move to: (?<p>.+)$")?) | .p;
  @sh "sid=\(.session_id // .conversation_id // "" | tostring)",
  @sh "cwd=\(.cwd // (.workspace_roots // [])[0] // "" | tostring)",
  @sh "tool=\(.tool_name // "" | tostring)",
  @sh "stop_active=\(.stop_hook_active // false | tostring)",
  @sh "loop_count=\(.loop_count // 0 | tostring)",
  @sh "from_cursor=\(has("cursor_version") | tostring)",
  @sh "skill_arg=\(.tool_input.skill // "" | tostring)",
  @sh "prompt=\(.prompt // "" | tostring)",
  "targets=(\([.tool_input.file_path, .tool_input.notebook_path, .tool_input.path, patch_paths] | map(select(type == "string" and . != "")) | @sh))"
' <<<"$payload" 2>/dev/null) || exit 0
eval "$fields"

# Cursor also loads Claude-shaped settings; only the Cursor-registered entry answers Cursor.
[ "$host" != cursor ] && [ "$from_cursor" = true ] && exit 0
[[ $sid =~ $SAFE_ID ]] || exit 0
[ -n "$cwd" ] && cwd=$(cd "$cwd" 2>/dev/null && pwd -P) || cwd=
[ -n "$cwd" ] || exit 0

session_file="$GUARD_HOME/sessions/$sid.json"

json_or_null() { if [ -f "$1" ]; then cat "$1"; else printf 'null'; fi; printf '\n'; }

log() {
  mkdir -p "$GUARD_HOME" 2>/dev/null || return 0
  jq -cn --arg s "$sid" --arg e "$1" --arg d "$2" '{at:(now|todate),session:$s,event:$e,detail:$d}' >>"$GUARD_HOME/guard-log.jsonl" 2>/dev/null
}

update_session() { # jq filter, args...
  local filter=$1; shift
  mkdir -p "${session_file%/*}" 2>/dev/null || return 0
  json_or_null "$session_file" | jq "$@" "(. // {}) | $filter" >"$session_file.$$.tmp" 2>/dev/null && mv "$session_file.$$.tmp" "$session_file"
}

ws=
d=$cwd
while [ -n "$d" ]; do
  if [ -d "$d/.reactive/skills" ]; then ws=$d; break; fi
  [ "$d" = / ] && break
  d=${d%/*}; [ -n "$d" ] || d=/
done

sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }

# Human opt-outs: the session's own `/reactive-guard off <reason>` prompt, or a workspace grant written
# by `reactive-skills-axi guard off` in an interactive terminal.
guard_off() {
  jq -e '.off.reason // empty' "$session_file" >/dev/null 2>&1 && return 0
  local root=${ws:-$cwd} id grant
  id=$(printf '%s' "$root" | sha256 | cut -c1-32)
  grant="$HOME/.reactive-skills/grants/guard-off-$id.json"
  [ -f "$grant" ] && jq -e --arg w "$root" '.workspace == $w' "$grant" >/dev/null 2>&1
}

# One line per active job: "<skill> <run> <state> <ok|pending> <age-days>".
job_lines() {
  [ -n "$ws" ] || return 0
  local pointer skill run dir
  for pointer in "$ws"/.reactive/skills/*/active_job; do
    [ -f "$pointer" ] || continue
    dir=${pointer%/active_job}; skill=${dir##*/}
    run=$(tr -d '[:space:]' <"$pointer")
    [[ $run =~ $SAFE_ID ]] || continue
    dir="$dir/runs/$run"
    [ -f "$dir/job.json" ] || continue
    { json_or_null "$dir/job.json"; json_or_null "$session_file"; json_or_null "$dir/delivery/$sid.json"; json_or_null "$dir/delivery/_anon.json"; } \
      | jq -sr --arg skill "$skill" --arg run "$run" --argjson window "$ANON_WINDOW_SECONDS" '
          def epoch: (. // "") | sub("\\.[0-9]+Z$"; "Z") | (try fromdateiso8601 catch 0);
          .[0] as $job | .[1] as $rec | .[2] as $mine | .[3] as $anon
          | ($job.currentState // "") as $state
          | ($state | split(".") | last | ascii_upcase) as $leaf
          | select($job.status == "active" and ($leaf | IN("COMPLETED","DONE","SUCCESS","ERROR","BYPASS_DETECTED","ABORTED","TERMINAL") | not))
          | (($rec.park // {})[$run] != null
             or ($mine != null and $mine.run == $run and $mine.state == $state)
             or ($anon != null and $anon.run == $run and $anon.state == $state and (now - ($anon.at | epoch)) < $window)) as $ok
          | "\($skill) \($run) \($state) \(if $ok then "ok" else "pending" end) \(((now - ($job.updatedAt | epoch)) / 86400) | floor)"' 2>/dev/null
  done
}

# Skills this session loaded that it has not run here yet: "<skill> <ok|pending>".
required_lines() {
  [ -f "$session_file" ] || return 0
  local names name receipts=()
  names=$(jq -r '.required // {} | keys[]' "$session_file" 2>/dev/null) || return 0
  [ -n "$names" ] || return 0
  [ -n "$ws" ] && for f in "$ws"/.reactive/skills/*/runs/*/delivery/"$sid".json; do [ -f "$f" ] && receipts+=("$f"); done
  local seen=""
  [ ${#receipts[@]} -gt 0 ] && seen=$(jq -r '.skill' "${receipts[@]}" 2>/dev/null)
  for name in $names; do
    if grep -qxF -- "$name" <<<"$seen"; then echo "$name ok"; else echo "$name pending"; fi
  done
}

collect() {
  jobs=(); required=(); pending=()
  local line
  while IFS= read -r line; do [ -n "$line" ] && jobs+=("$line"); done < <(job_lines)
  while IFS= read -r line; do [ -n "$line" ] && required+=("$line"); done < <(required_lines)
  for line in "${jobs[@]}" "${required[@]}"; do [[ $line == *" pending"* ]] && pending+=("$line"); done
  return 0
}

explain() {
  local line skill run state status age
  printf 'Reactive skill protocol guard: this session has not acknowledged the runtime for:\n'
  for line in "${pending[@]}"; do
    read -r skill run state status age <<<"$line"
    if [ -n "${state:-}" ]; then
      printf '  - job: %s run %s at %s (last touched %s day(s) ago)\n' "$skill" "$run" "$state" "$age"
      printf '      resume:  reactive-skills-axi state %s --job %s   (or MCP reactive_state)\n' "$skill" "$run"
      printf '      park:    reactive-skills-axi park %s --job %s --session %s --reason "<why this session sets it aside>"\n' "$skill" "$run" "$sid"
      printf '      abandon: reactive-skills-axi abandon %s --job %s --reason "<why the run is over>"\n' "$skill" "$run"
    else
      printf '  - skill %s was loaded in this session but has not been run here\n' "$skill"
      printf '      start:   reactive-skills-axi invoke %s   (or MCP reactive_state)\n' "$skill"
      printf '      If the runtime cannot run, stop and tell the user why instead of working around it.\n'
    fi
  done
  printf 'Read-only tools stay available. A person can turn the guard off for this session by typing /reactive-guard off <reason>.\n'
}

deny() { # reason text
  log deny-write "$2"
  if [ "$host" = cursor ]; then
    jq -cn --arg m "$1" '{continue:true, permission:"deny", user_message:"Reactive protocol guard denied this edit.", agent_message:$m}'
    exit 0
  fi
  printf '%s\n' "$1" >&2
  exit 2
}

is_protected() { # absolute path
  case $1 in
    */.claude/settings.json|*/.claude/settings.*.json|*/.codex/hooks.json|*/.cursor/hooks.json) return 0 ;;
    */.reactive/*|*/.reactive-governance/attestations/*) return 0 ;;
    "$HOME"/.reactive-skills/*) return 0 ;;
  esac
  return 1
}

find_skill_md() { # skill name -> path of a SKILL.md carrying the bootloader marker
  local name=${1##*:} f
  [[ $name =~ $SAFE_ID ]] || return 1
  for f in "$cwd/.claude/skills/$name/SKILL.md" "$cwd/.agents/skills/$name/SKILL.md" "$HOME/.agents/skills/$name/SKILL.md" "$HOME/.claude/skills/$name/SKILL.md"; do
    if [ -f "$f" ] && grep -qF -- "$MARK" "$f"; then printf '%s\n' "$name"; return 0; fi
  done
  return 1
}

require_skill() {
  local name
  name=$(find_skill_md "$1") || return 0
  update_session '.required[$k] = (now|todate)' --arg k "$name"
  log required "$name"
}

case $event in
pretool)
  if [ "$tool" = Skill ]; then
    [ -n "$skill_arg" ] && require_skill "$skill_arg"
    exit 0
  fi
  if [ "$host" != cursor ]; then
    case $tool in Edit|Write|MultiEdit|NotebookEdit|apply_patch) ;; *) exit 0 ;; esac
  fi
  [ -n "$ws" ] || [ -f "$session_file" ] || exit 0
  guard_off && exit 0
  collect
  [ ${#jobs[@]} -gt 0 ] || [ ${#required[@]} -gt 0 ] || exit 0
  for target in "${targets[@]}"; do
    case $target in /*) ;; *) target="$cwd/$target" ;; esac
    is_protected "$target" && deny "Reactive skill protocol guard: $target is protected while a reactive job is engaged in this session (hook configuration, runtime state, run bundles and guard state change only through the runtime or a person)." "protected:$target"
  done
  [ ${#pending[@]} -eq 0 ] && exit 0
  deny "$(explain)" "${pending[*]}"
  ;;
stop)
  [ -n "$ws" ] || [ -f "$session_file" ] || exit 0
  guard_off && exit 0
  collect
  [ ${#pending[@]} -eq 0 ] && exit 0
  if [ "$host" = cursor ]; then
    # Cursor's stop hook cannot block; it gets one follow-up per turn end, then nothing.
    [ "$loop_count" = 0 ] || exit 0
    log block-stop "${pending[*]}"
    jq -cn --arg m "$(explain)" '{followup_message:$m}'
    exit 0
  fi
  if [ "$stop_active" = true ]; then
    log ungoverned-turn "${pending[*]}"
    jq -cn --arg m "Reactive guard: turn ended without runtime acknowledgement (${pending[*]}). Recorded as ungoverned." '{systemMessage:$m}'
    exit 0
  fi
  log block-stop "${pending[*]}"
  explain >&2
  exit 2
  ;;
session-start)
  [ -n "$ws" ] || exit 0
  collect
  [ ${#jobs[@]} -gt 0 ] || exit 0
  summary="Reactive jobs active in this workspace:"
  for line in "${jobs[@]}"; do
    read -r skill run state _ age <<<"$line"
    summary+=" $skill run $run at $state (last touched $age day(s) ago);"
  done
  summary+=" before editing files, resume each with reactive-skills-axi state <skill> --job <run>, or park or abandon it with a reason."
  if [ "$host" = cursor ]; then jq -cn --arg m "$summary" '{additional_context:$m}'
  else jq -cn --arg m "$summary" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$m}}'; fi
  exit 0
  ;;
prompt)
  # Only the person's own prompt reaches this hook, so it is the one channel the agent cannot use.
  trimmed=${prompt#"${prompt%%[![:space:]]*}"}
  if [[ $trimmed =~ ^/reactive-guard[[:space:]]+off[[:space:]]+(.+)$ ]]; then
    reason=${BASH_REMATCH[1]}
    update_session '.off = {reason:$r, at:(now|todate)}' --arg r "$reason"
    log guard-off "$reason"
  elif [[ $trimmed =~ ^/reactive-guard[[:space:]]+on([[:space:]]|$) ]]; then
    update_session 'del(.off)'
    log guard-on ""
  elif [[ $trimmed =~ ^/([A-Za-z0-9:._-]+) ]]; then
    require_skill "${BASH_REMATCH[1]}"
  fi
  [ "$host" = cursor ] && printf '{"continue":true}\n'
  exit 0
  ;;
esac
exit 0
