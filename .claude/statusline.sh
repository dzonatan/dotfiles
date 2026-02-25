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

# ANSI codes
BOLD="\033[1m"
RESET="\033[0m"

# Build output with bold values
# Using \e[1m for bold, \e[22m to turn off bold only (preserves other attributes)
BOLD=$'\e[1m'
UNBOLD=$'\e[22m'

OUTPUT="folder:${BOLD}${FOLDER_NAME}${UNBOLD} branch:${BOLD}${GIT_BRANCH}${GIT_STATUS_FLAG}${UNBOLD}"
if [ -z "$GIT_BRANCH" ]; then
    OUTPUT="folder:${BOLD}${FOLDER_NAME}${UNBOLD}"
fi

printf '%s\n' "$OUTPUT"
