#!/usr/bin/env bash
# Keeps the Herdr app's personal files (~/.config/herdr-app) in this repo (.config/herdr-app).
#
#   herdr-app-sync.sh pull     app -> dotfiles. Run before committing (the pre-commit hook does it).
#   herdr-app-sync.sh push     dotfiles -> app. On a new machine, or after a git pull.
#                              Refuses if the app has changes that were never pulled (--force overrides).
#   herdr-app-sync.sh status   what differs, both ways.
#
# Real copies, not symlinks: Herdr App doesn't load a mod's own SVGs through a symlink.
#
# Tracked (an allowlist, so layouts, mods and themes you install from others never land here):
#   keys.json, settings.json, programs.json, scripts/, and everything named dz-*: mods/dz-*/,
#   layouts/dz-*.{json,svg}, layouts/.state/dz-*.json (your edits to those layouts), themes/dz-*.json.
# Everything else stays app-only: Herdr's own files, herdr-t3 and anything else installed.
set -euo pipefail

APP="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
DOT="$(cd "$(dirname "$0")/.." && pwd)/.config/herdr-app"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/herdr-app-sync"
MANIFEST="$STATE/manifest" # hashes of the app's tracked files at the last pull or push, on this machine

die() { echo "herdr-app-sync: $*" >&2; exit 1; }
[ -d "$APP" ] || die "no Herdr app folder at $APP"

skip_file() { # generated or junk files, anywhere
  case "$(basename "$1")" in gpui-kit.d.ts|jsconfig.json|.DS_Store|*.log|*.tmp) return 0 ;; esac
  case "$1" in */node_modules/*) return 0 ;; esac
  return 1
}

PREFIX="dz-" # what makes a mod, layout or theme mine

# The app's tracked files, relative to $APP, one per line, sorted.
app_files() {
  (
    cd "$APP"
    for f in keys.json settings.json programs.json; do [ -f "$f" ] && echo "$f"; done
    for d in mods/"$PREFIX"*/; do [ -d "$d" ] && find "${d%/}" -type f; done
    for f in layouts/"$PREFIX"*.json layouts/"$PREFIX"*.svg layouts/.state/"$PREFIX"*.json themes/"$PREFIX"*.json; do
      [ -f "$f" ] && echo "$f"
    done
    [ -d scripts ] && find scripts -type f
  ) | while read -r f; do skip_file "$f" || echo "$f"; done | LC_ALL=C sort
}

dot_files() {
  [ -d "$DOT" ] || return 0
  (cd "$DOT" && find . -type f | sed 's|^\./||') | while read -r f; do skip_file "$f" || echo "$f"; done | LC_ALL=C sort
}

hashes() { # <dir> < file list  ->  "hash  path" lines
  (cd "$1" && while read -r f; do shasum -a 256 "$f"; done)
}

app_hashes() { app_files | hashes "$APP"; }
dot_hashes() { dot_files | hashes "$DOT"; }

save_manifest() { mkdir -p "$STATE"; app_hashes > "$MANIFEST"; }

# Mirror the listed files from one root to another; delete files in <to> that are tracked there but not listed.
mirror() { # <from> <to> <list of from's files> <list of to's tracked files>
  local from="$1" to="$2" list="$3" existing="$4"
  mkdir -p "$to"
  if [ -n "$list" ]; then rsync -a --files-from=<(printf '%s\n' "$list") "$from/" "$to/"; fi
  comm -13 <(printf '%s\n' "$list") <(printf '%s\n' "$existing") | while read -r f; do
    if [ -n "$f" ]; then rm -f "$to/$f"; echo "removed $f"; fi
  done
  find "$to" -mindepth 1 -type d -empty -delete 2>/dev/null || true
}

cmd_pull() {
  mirror "$APP" "$DOT" "$(app_files)" "$(dot_files)"
  save_manifest
  git -C "$DOT/../.." status --short -- .config/herdr-app
}

cmd_push() {
  local force="${1:-}"
  if [ "$force" != "--force" ]; then
    if [ -f "$MANIFEST" ]; then
      if ! diff -q <(app_hashes) "$MANIFEST" >/dev/null; then
        echo "The app changed since the last pull or push:" >&2
        diff <(cut -c67- "$MANIFEST") <(app_files) | sed -n 's/^> /  new: /p' >&2 || true
        diff <(app_hashes) "$MANIFEST" | sed -n 's/^< [0-9a-f]*  /  changed: /p' | sort -u >&2 || true
        die "run 'pull' first (then commit), or 'push --force' to overwrite those app changes"
      fi
    elif [ -n "$(app_files)" ] && ! diff -q <(app_hashes) <(dot_hashes) >/dev/null; then
      die "first sync on this machine and the app's files differ from dotfiles. 'status' shows how; 'push --force' overwrites the app, 'pull' keeps the app's"
    fi
  fi
  mirror "$DOT" "$APP" "$(dot_files)" "$(app_files)"
  save_manifest
  echo "pushed to $APP"
}

cmd_status() {
  local a d; a="$(app_hashes)"; d="$(dot_hashes)"
  if [ "$a" = "$d" ]; then echo "in sync"; else
    echo "differs (< app, > dotfiles):"; diff <(echo "$a") <(echo "$d") | grep '^[<>]' | sed 's/ [0-9a-f]\{64\}  / /' || true
  fi
  if [ -f "$MANIFEST" ] && ! diff -q <(echo "$a") "$MANIFEST" >/dev/null; then echo "the app has changes since the last sync: run pull"; fi
}

case "${1:-}" in
  pull) cmd_pull ;;
  push) cmd_push "${2:-}" ;;
  status) cmd_status ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
