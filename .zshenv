# Read by every zsh, before /etc/zshrc and ~/.zshrc.
# Keep fpath free of duplicates. FPATH is exported (brew shellenv does that), so
# nested shells inherit the parent's list and re-add the same dirs; without this
# the compinit in nix-darwin's /etc/zshrc sees a different file count depending
# on shell nesting depth and rebuilds ~/.zcompdump on every launch.
typeset -U fpath
