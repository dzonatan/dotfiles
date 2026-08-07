#!/usr/bin/env bash
# Fork the Claude Code session running in the focused pane.
# Bound from config.toml via [[keys.command]] (type = "popup"), so stdin/stdout
# here are the popup terminal and the popup closes when this script exits.
set -euo pipefail

herdr="${HERDR_BIN_PATH:-herdr}"
pane="${HERDR_ACTIVE_PANE_ID:-}"

fail() {
  printf '\n  %s\n\n  press any key…' "$1"
  read -rsn1 || true
  exit 1
}

[[ -n $pane ]] || fail "no active pane"

info=$("$herdr" pane get "$pane")
agent=$(jq -r '.result.pane.agent // ""' <<<"$info")
kind=$(jq -r '.result.pane.agent_session.kind // ""' <<<"$info")
session=$(jq -r '.result.pane.agent_session.value // ""' <<<"$info")
cwd=$(jq -r '.result.pane.foreground_cwd // .result.pane.cwd // ""' <<<"$info")

[[ $agent == "claude" ]] || fail "focused pane is not Claude Code"
[[ $kind == "id" && -n $session ]] || fail "no Claude session id on this pane"

printf '\033[2J\033[H'
cat <<EOF

  branch session ${session:0:8}

    v   split vertical (right)
    h   split horizontal (down)
    t   new tab
    q   cancel

EOF
printf '  choose: '

choice=""
read -rsn1 choice || true

split_into() {
  "$herdr" pane split --pane "$pane" --direction "$1" --cwd "$cwd" --focus |
    jq -r '.result.pane.pane_id'
}

case $choice in
  v) target=$(split_into right) ;;
  h) target=$(split_into down) ;;
  t)
    target=$("$herdr" tab create --cwd "$cwd" --focus |
      jq -r '.result.root_pane.pane_id')
    ;;
  q | $'\e' | "") exit 0 ;;
  *) fail "unknown choice: $choice" ;;
esac

"$herdr" pane run "$target" claude --resume "$session" --fork-session
