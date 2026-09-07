# Aliases
alias v="NVIM_APPNAME=astronvim nvim"
alias avim="NVIM_APPNAME=astronvim nvim"
alias lvim="NVIM_APPNAME=lazyvim nvim"
alias conf="cd ~/dotfiles && v ./"
alias lg="lazygit"
alias nnn="yazi"
alias ya="yazi"
alias cr="tuicr"
alias oc="opencode"
alias nix-rebuild="sudo darwin-rebuild switch --flake ~/.config/nix-darwin#dzonatan"
alias cl="claude"
alias ncl="nono run --profile claude-default -- claude --dangerously-skip-permissions"
alias npi="nono run --profile pi -- pi"
alias lazypodman='DOCKER_HOST="unix://$(podman machine inspect --format "{{.ConnectionInfo.PodmanSocket.Path}}")" lazydocker'
clt() {
  CLAUDE_CODE_TASK_LIST_ID="$1" claude "${@:2}"
}

# Set default editor
export EDITOR="env NVIM_APPNAME=astronvim nvim"

# emacs mode (^f for accept suggestion)
bindkey -e

# Custom PATHS
export PATH="$HOME/.npm-packages/bin:$PATH"
export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@25"
# pnpm
export PNPM_HOME="/Users/dzonatan/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

## Zoxide
eval "$(zoxide init zsh --cmd j)"

## Starship prompt
eval "$(starship init zsh)"

## fzf integration
eval "$(fzf --zsh)"

## homebrew integration
eval "$(/opt/homebrew/bin/brew shellenv)"

## fnm (node version manager) — auto-switch on cd via .nvmrc/.node-version
eval "$(fnm env --use-on-cd --shell zsh)"

## yazi shorcut with support of current working directory change
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ -n "$cwd" ] && [ "$cwd" != "$PWD" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

# Private stuff that shouldn't be public
source ~/.zshrc_private

# Lazy-load Angular CLI autocompletion (only when ng is first used)
ng() {
  unfunction ng
  source <(command ng completion script)
  command ng "$@"
}

# zinit
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"
[ ! -d $ZINIT_HOME ] && mkdir -p "$(dirname $ZINIT_HOME)"
[ ! -d $ZINIT_HOME/.git ] && git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
source "${ZINIT_HOME}/zinit.zsh" 

# zinit plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions   # only adds to fpath; must be loaded before compinit

# Completion system.
# nix-darwin's /etc/zshrc already ran compinit against ~/.zcompdump before this
# file. We use a separate dump file so the two don't keep invalidating each
# other's cache (that was rebuilding completions on every shell start, ~1s).
# The full fpath scan runs only when our dump is older than 24h; otherwise the
# cached dump is trusted as-is (-C).
# NOTE: new completion files (e.g. after `brew install <tool>`, a nix rebuild or
# a zinit plugin update) are only picked up on the next daily rebuild. To pick
# them up immediately run `compinit-rebuild`.
ZSH_COMPDUMP="$HOME/.zcompdump-user"
ZINIT[ZCOMPDUMP_PATH]="$ZSH_COMPDUMP"
autoload -Uz compinit
compinit-rebuild() { rm -f "$ZSH_COMPDUMP"; compinit -d "$ZSH_COMPDUMP"; echo "completion dump rebuilt: $ZSH_COMPDUMP"; }
_zsh_compdump_stale=( "$ZSH_COMPDUMP"(N.mh+24) )
if (( $#_zsh_compdump_stale )); then
  compinit -d "$ZSH_COMPDUMP"      # stale (>24h): full scan + rebuild
else
  compinit -C -d "$ZSH_COMPDUMP"   # trust the cached dump (or create it if missing)
fi
unset _zsh_compdump_stale

zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab   # must come after compinit

# zinit configuration
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

export PATH="/Users/dzonatan/.local/bin:$PATH"
