# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git zsh-autosuggestions)

source $ZSH/oh-my-zsh.sh

# Aliases
alias nv="nvim"
alias v="NVIM_APPNAME=astronvim nvim"
alias conf="cd ~/dotfiles && v ./"
alias lg="lazygit"
alias cdf="cd $(find . -type d -print | fzf)"

# Custom key bindings
bindkey '^@' autosuggest-accept

# Custom PATHS
export PATH=$HOME/.local/bin:$PATH
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools/"
export CPPFLAGS="-I/opt/homebrew/opt/openjdk@17/include"

## Path of node version manager
export N_PREFIX=$HOME/.n
export PATH=$N_PREFIX/bin:$PATH

## Jump https://github.com/gsamokovarov/jump
eval "$(jump shell)"

## Starship prompt
eval "$(starship init zsh)"

## Syntax highlighting
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# Private stuff that shouldn't be public
source ~/.zshrc_private

# bun completions
[ -s "/Users/dzonatan/.bun/_bun" ] && source "/Users/dzonatan/.bun/_bun"
