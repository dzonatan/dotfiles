# Aliases
alias v="NVIM_APPNAME=astronvim nvim"
alias conf="cd ~/dotfiles && v ./"
alias lg="lazygit"
alias cl="claude"
alias nix-rebuild="sudo darwin-rebuild switch --flake ~/.config/nix-darwin#dzonatan"

# Set default editor
export EDITOR="v"

# emacs mode (^f for accept suggestion)
bindkey -e

# Custom PATHS
# export PATH=$HOME/.local/bin:$PATH

## Jump https://github.com/gsamokovarov/jump
eval "$(jump shell)"

## Starship prompt
eval "$(starship init zsh)"

## fzf integration
eval  "$(fzf --zsh)"

## homebrew integration
eval "$(/opt/homebrew/bin/brew shellenv)"

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

# zinit
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"
[ ! -d $ZINIT_HOME ] && mkdir -p "$(dirname $ZINIT_HOME)"
[ ! -d $ZINIT_HOME/.git ] && git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
source "${ZINIT_HOME}/zinit.zsh" 

# zinit plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab

# zinit configuration
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
