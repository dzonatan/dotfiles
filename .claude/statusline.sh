#!/bin/bash
# Claude Code status line: shows current folder, git branch, latest commit, and status

input=$(cat)

# Get current directory
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "."')

# Get folder name (basename of current directory)
FOLDER_NAME=$(basename "$CURRENT_DIR")

# Get git info
GIT_BRANCH=""
GIT_STATUS_FLAG=""
if cd "$CURRENT_DIR" 2>/dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        GIT_BRANCH="$BRANCH"
    else
        # Detached HEAD - show short commit hash
        GIT_BRANCH=$(git rev-parse --short HEAD 2>/dev/null)
    fi

    # Check for uncommitted changes (skip optional locks for performance)
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
        GIT_STATUS_FLAG="*"
    fi
fi

# Get context remaining percentage
CTX_LEFT=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Get 5-hour rate limit usage and reset time
RATE_LIMIT=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
RESETS_AT=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

# ANSI codes
BOLD=$'\e[1m'
UNBOLD=$'\e[22m'

OUTPUT="folder:${BOLD}${FOLDER_NAME}${UNBOLD}"
if [ -n "$GIT_BRANCH" ]; then
    OUTPUT="${OUTPUT} branch:${BOLD}${GIT_BRANCH}${GIT_STATUS_FLAG}${UNBOLD}"
fi
if [ -n "$CTX_LEFT" ]; then
    CTX_USED=$(printf '%.0f' "$(echo "100 - $CTX_LEFT" | bc)")
    OUTPUT="${OUTPUT} ctx:${BOLD}${CTX_USED}%${UNBOLD}"
fi
if [ -n "$RATE_LIMIT" ]; then
    RATE_LIMIT=$(printf '%.0f' "$RATE_LIMIT")
    USAGE_STR="usage:${BOLD}${RATE_LIMIT}%${UNBOLD}"
    if [ -n "$RESETS_AT" ] && [ "$RESETS_AT" != "null" ]; then
        # resets_at is a Unix epoch timestamp
        RESET_EPOCH="$RESETS_AT"
        NOW_EPOCH=$(date "+%s")
        if [ "$RESET_EPOCH" -gt "$NOW_EPOCH" ] 2>/dev/null; then
            REMAINING=$(( RESET_EPOCH - NOW_EPOCH ))
            HOURS=$(( REMAINING / 3600 ))
            MINS=$(( (REMAINING % 3600) / 60 ))
            if [ "$HOURS" -gt 0 ]; then
                USAGE_STR="${USAGE_STR}(${HOURS}h${MINS}m)"
            else
                USAGE_STR="${USAGE_STR}(${MINS}m)"
            fi
        fi
    fi
    OUTPUT="${OUTPUT} ${USAGE_STR}"
fi

printf '%s\n' "$OUTPUT"
