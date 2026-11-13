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
# - Tier: P1 (<25ms). Process forks dominate, so the hot path uses shell builtins and runs jq once
#   to parse the payload; non-write tools exit before jq.
# - Complexity: O(d + j), workspace depth and active jobs in the touched workspaces
# - Cyclomatic Complexity (CC): target <=40 (one dispatcher over four events and three hosts)
# - Branch Coverage: target >=85% (apps/axi/tests/guard/protocol-guard.test.ts)
# - CRAP Score: target <=45

event=${1:-}
host=claude
[ "${2:-}" = --host ] && host=${3:-claude}
command -v jq >/dev/null 2>&1 || exit 0
IFS= read -r -d '' payload
[ -n "$payload" ] || exit 0

# Claude and Codex register this hook for write tools and Skill; anything else exits before parsing.
if [ "$event" = pretool ] && [ "$host" != cursor ] \
  && ! [[ $payload =~ \"tool_name\"[[:space:]]*:[[:space:]]*\"(Edit|Write|MultiEdit|NotebookEdit|apply_patch|Skill)\" ]]; then
  exit 0
fi

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
if [ -n "$cwd" ] && cd -P -- "$cwd" 2>/dev/null; then cwd=$PWD; else exit 0; fi

session_file="$GUARD_HOME/sessions/$sid.json"

slurp() { # var file: read a small JSON file without a fork; "null" when absent
  local __content=
  [ -f "$2" ] && IFS= read -r -d '' __content <"$2"
  printf -v "$1" '%s' "${__content:-null}"
}
slurp SESSION "$session_file"

json_escape() { # value var
  local v=$1
  v=${v//\\/\\\\}; v=${v//\"/\\\"}; v=${v//$'\n'/\\n}; v=${v//$'\r'/\\r}; v=${v//$'\t'/\\t}
  printf -v "$2" '%s' "$v"
}

log() { # event detail
  mkdir -p "$GUARD_HOME" 2>/dev/null || return 0
  local at detail
  printf -v at '%(%Y-%m-%dT%H:%M:%S%z)T' -1
  json_escape "$2" detail
  printf '{"at":"%s","session":"%s","event":"%s","detail":"%s"}\n' "$at" "$sid" "$1" "$detail" >>"$GUARD_HOME/guard-log.jsonl" 2>/dev/null
}

json_str() { # var json key: first string value of "key" in a small runtime-written JSON file
  local re="\"$3\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""
  if [[ $2 =~ $re ]]; then printf -v "$1" '%s' "${BASH_REMATCH[1]}"; else printf -v "$1" '%s' ''; fi
}

update_session() { # jq filter, args...
  local filter=$1; shift
  mkdir -p "${session_file%/*}" 2>/dev/null || return 0
  jq "$@" "(. // {}) | $filter" <<<"$SESSION" >"$session_file.$$.tmp" 2>/dev/null && mv "$session_file.$$.tmp" "$session_file"
}

# Nearest directory at or above $1 holding reactive run state, canonical, in FOUND (empty when none).
find_ws() {
  FOUND=
  local d=$1
  while [ -n "$d" ]; do
    if [ -d "$d/.reactive/skills" ]; then
      cd -P -- "$d" 2>/dev/null && FOUND=$PWD
      cd -- "$cwd" 2>/dev/null
      return 0
    fi
    [ "$d" = / ] && return 0
    d=${d%/*}; [ -n "$d" ] || d=/
  done
}

find_ws "$cwd"; ws=$FOUND
# Workspaces this call touches: the session's own, plus the one around each write target, so a
# session started outside a project cannot edit inside it unnoticed.
wss=()
[ -n "$ws" ] && wss+=("$ws")
add_target_workspaces() {
  local target known
  for target in "${targets[@]}"; do
    case $target in /*) ;; *) target="$cwd/$target" ;; esac
    find_ws "${target%/*}"
    [ -n "$FOUND" ] || continue
    for known in "${wss[@]}"; do [ "$known" = "$FOUND" ] && continue 2; done
    wss+=("$FOUND")
  done
}

any_grant=false
for f in "$HOME"/.reactive-skills/grants/guard-off-*.json; do [ -e "$f" ] && any_grant=true && break; done

granted() { # workspace root -> true when `reactive-skills-axi guard off` granted it from a terminal
  [ "$any_grant" = true ] || return 1
  local id grant
  if command -v sha256sum >/dev/null 2>&1; then id=$(printf '%s' "$1" | sha256sum); else id=$(printf '%s' "$1" | shasum -a 256); fi
  grant="$HOME/.reactive-skills/grants/guard-off-${id:0:32}.json"
  [ -f "$grant" ] && jq -e --arg w "$1" '.workspace == $w' "$grant" >/dev/null 2>&1
}

# Human opt-outs for the session's own workspace: its `/reactive-guard off <reason>` prompt, or a grant.
guard_off() {
  [[ $SESSION == *'"off"'* ]] && jq -e '.off.reason // empty' <<<"$SESSION" >/dev/null 2>&1 && return 0
  granted "${ws:-$cwd}"
}

# Appends "<skill> <run> <state> <ok|pending> <updatedAt>" to jobs[] for each active, non-terminal job.
# job.json and receipts are small files the runtime writes, so fields are read with bash regexes.
job_lines() {
  local root pointer skill run dir job status state leaf updated ok receipt r_run r_state r_at
  for root in "${wss[@]}"; do
    granted "$root" && continue
    for pointer in "$root"/.reactive/skills/*/active_job; do
      [ -f "$pointer" ] || continue
      dir=${pointer%/active_job}; skill=${dir##*/}
      run=; IFS= read -r run <"$pointer"; run=${run//[[:space:]]/}
      [[ $run =~ $SAFE_ID ]] || continue
      dir="$dir/runs/$run"
      slurp job "$dir/job.json"
      json_str status "$job" status
      [ "$status" = active ] || continue
      json_str state "$job" currentState
      leaf=${state##*.}
      shopt -s nocasematch
      case $leaf in COMPLETED|DONE|SUCCESS|ERROR|BYPASS_DETECTED|ABORTED|TERMINAL) shopt -u nocasematch; continue ;; esac
      shopt -u nocasematch
      json_str updated "$job" updatedAt
      ok=pending
      # Parked by this session: run ids appear in the session record only as park keys.
      [[ $SESSION == *"\"$run\""* ]] && ok=ok
      if [ "$ok" = pending ]; then
        slurp receipt "$dir/delivery/$sid.json"
        json_str r_run "$receipt" run; json_str r_state "$receipt" state
        [ "$r_run" = "$run" ] && [ "$r_state" = "$state" ] && ok=ok
      fi
      if [ "$ok" = pending ] && [ -f "$dir/delivery/_anon.json" ]; then
        slurp receipt "$dir/delivery/_anon.json"
        json_str r_run "$receipt" run; json_str r_state "$receipt" state; json_str r_at "$receipt" at
        iso_epoch r_at "$r_at"
        [ "$r_run" = "$run" ] && [ "$r_state" = "$state" ] && [ -n "$r_at" ] && ((NOW - r_at < ANON_WINDOW_SECONDS)) && ok=ok
      fi
      jobs+=("$skill $run $state $ok $updated")
    done
  done
}

iso_epoch() { # var "YYYY-MM-DDTHH:MM:SS[.fff]Z": UTC epoch seconds without a fork (days-from-civil); empty when unparsable
  printf -v "$1" '%s' ''
  [[ $2 =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2}) ]] || return 0
  local y=$((10#${BASH_REMATCH[1]})) m=$((10#${BASH_REMATCH[2]})) d=$((10#${BASH_REMATCH[3]}))
  local secs=$((10#${BASH_REMATCH[4]} * 3600 + 10#${BASH_REMATCH[5]} * 60 + 10#${BASH_REMATCH[6]}))
  ((m <= 2)) && ((y -= 1))
  local era=$((y / 400)) yoe doy
  yoe=$((y - era * 400)); doy=$(((153 * ((m + 9) % 12) + 2) / 5 + d - 1))
  printf -v "$1" '%d' $(((era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719468) * 86400 + secs))
}

printf -v NOW '%(%s)T' -1

days_since() { # var ISO-time: whole days since then, or "?"
  local then
  iso_epoch then "$2"
  if [ -n "$then" ]; then printf -v "$1" '%d' $(((NOW - then) / 86400)); else printf -v "$1" '?'; fi
}

# Appends "<skill> <ok|pending>" to required[] for skills this session loaded.
required_lines() {
  [[ $SESSION == *'"required"'* ]] || return 0
  local names name root f seen= receipts=()
  names=$(jq -r '.required // {} | keys[]' <<<"$SESSION" 2>/dev/null) || return 0
  for root in "${wss[@]}"; do
    for f in "$root"/.reactive/skills/*/runs/*/delivery/"$sid".json; do [ -f "$f" ] && receipts+=("$f"); done
  done
  [ ${#receipts[@]} -gt 0 ] && seen=$'\n'$(jq -r '.skill' "${receipts[@]}" 2>/dev/null)$'\n'
  for name in $names; do
    if [[ $seen == *$'\n'"$name"$'\n'* ]]; then required+=("$name ok"); else required+=("$name pending"); fi
  done
}

collect() {
  jobs=(); required=(); pending=()
  job_lines
  required_lines
  local line
  for line in "${jobs[@]}" "${required[@]}"; do [[ $line == *" pending"* ]] && pending+=("$line"); done
  return 0
}

explain() { # builds EXPLAIN without a subshell
  local line skill run state status updated age part
  EXPLAIN='Reactive skill protocol guard: this session has not acknowledged the runtime for:'$'\n'
  for line in "${pending[@]}"; do
    read -r skill run state status updated <<<"$line"
    if [ -n "${state:-}" ]; then
      days_since age "$updated"
      printf -v part '  - job: %s run %s at %s (last touched %s day(s) ago)\n      resume:  reactive-skills-axi state %s --job %s   (or MCP reactive_state)\n      park:    reactive-skills-axi park %s --job %s --session %s --reason "<why this session sets it aside>"\n      abandon: reactive-skills-axi abandon %s --job %s --reason "<why the run is over>"\n' \
        "$skill" "$run" "$state" "$age" "$skill" "$run" "$skill" "$run" "$sid" "$skill" "$run"
    else
      printf -v part '  - skill %s was loaded in this session but has not been run here\n      start:   reactive-skills-axi invoke %s   (or MCP reactive_state)\n      If the runtime cannot run, stop and tell the user why instead of working around it.\n' "$skill" "$skill"
    fi
    EXPLAIN+=$part
  done
  EXPLAIN+='Read-only tools stay available. A person can turn the guard off for this session by typing /reactive-guard off <reason>.'
}

deny() { # message, log detail
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

require_skill() { # records a loaded skill whose SKILL.md carries the bootloader marker
  local name=${1##*:} f
  [[ $name =~ $SAFE_ID ]] || return 0
  for f in "$cwd/.claude/skills/$name/SKILL.md" "$cwd/.agents/skills/$name/SKILL.md" "$HOME/.agents/skills/$name/SKILL.md" "$HOME/.claude/skills/$name/SKILL.md"; do
    if [ -f "$f" ] && grep -qF -- "$MARK" "$f"; then
      update_session '.required[$k] = (now|todate)' --arg k "$name"
      log required "$name"
      return 0
    fi
  done
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
  add_target_workspaces
  [ ${#wss[@]} -gt 0 ] || [ "$SESSION" != null ] || exit 0
  guard_off && exit 0
  collect
  [ ${#jobs[@]} -gt 0 ] || [ ${#required[@]} -gt 0 ] || exit 0
  for target in "${targets[@]}"; do
    case $target in /*) ;; *) target="$cwd/$target" ;; esac
    is_protected "$target" && deny "Reactive skill protocol guard: $target is protected while a reactive job is engaged in this session (hook configuration, runtime state, run bundles and guard state change only through the runtime or a person)." "protected:$target"
  done
  [ ${#pending[@]} -eq 0 ] && exit 0
  explain
  deny "$EXPLAIN" "${pending[*]}"
  ;;
stop)
  [ -n "$ws" ] || [ "$SESSION" != null ] || exit 0
  guard_off && exit 0
  collect
  [ ${#pending[@]} -eq 0 ] && exit 0
  if [ "$host" = cursor ]; then
    # Cursor's stop hook cannot block; it gets one follow-up per turn end, then nothing.
    [ "$loop_count" = 0 ] || exit 0
    log block-stop "${pending[*]}"
    explain
    jq -cn --arg m "$EXPLAIN" '{followup_message:$m}'
    exit 0
  fi
  if [ "$stop_active" = true ]; then
    log ungoverned-turn "${pending[*]}"
    jq -cn --arg m "Reactive guard: turn ended without runtime acknowledgement (${pending[*]}). Recorded as ungoverned." '{systemMessage:$m}'
    exit 0
  fi
  log block-stop "${pending[*]}"
  explain
  printf '%s\n' "$EXPLAIN" >&2
  exit 2
  ;;
session-start)
  [ -n "$ws" ] || exit 0
  collect
  [ ${#jobs[@]} -gt 0 ] || exit 0
  summary="Reactive jobs active in this workspace:"
  for line in "${jobs[@]}"; do
    read -r skill run state _ updated <<<"$line"
    days_since age "$updated"
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
