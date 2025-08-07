# Path to your oh-my-zsh installation.
# export ZSH="$HOME/.oh-my-zsh"

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
# plugins=(git zsh-autosuggestions)

# source $ZSH/oh-my-zsh.sh

# Aliases
alias nv="nvim"
alias av="NVIM_APPNAME=astronvim nvim"
alias conf="cd ~/dotfiles && v ./"
alias lg="lazygit"
alias cl="claude"

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

## Syntax highlighting
# source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# Private stuff that shouldn't be public
#source ~/.zshrc_private

# bun completions
# [ -s "/Users/dzonatan/.bun/_bun" ] && source "/Users/dzonatan/.bun/_bun"

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
