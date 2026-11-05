# Chrome DevTools MCP

- Work in the background so Chrome doesn't steal focus: pass `background: true` to `new_page` and don't pass `bringToFront: true` to `select_page`, unless I ask to see the page.

# Herdr app config (~/.config/herdr-app)

- My personal files there are tracked in `~/dotfiles/.config/herdr-app` as real copies, not symlinks. Sync with `~/dotfiles/scripts/herdr-app-sync.sh`: `pull` (app → dotfiles), `push` (dotfiles → app), `status`. The script header lists what is tracked. Only `dz-*` mods, layouts and themes are synced, so name anything new I make `dz-*`; things installed from others stay out of git.
- After you change files in `~/.config/herdr-app`, run `pull` and tell me what changed in dotfiles. Never `push --force` without asking me.
- The `dz-*` mods and the `herdr-projects` layout are my own fork of github.com/JinJieBeWater/herdr-t3 (renamed from `t3-*`). Never overwrite them with upstream files; port only the specific upstream changes I ask for. Example of my own code: the ⌘K "Regenerate title" action in `dz-actions`, which calls `scripts/retitle.sh`.

# Device-local instructions (not in dotfiles)

@~/.claude/CLAUDE.local.md
