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

alias vim="lvim"
alias vi="lvim"
alias v="lvim"
alias conf="cd ~/dotfiles && lvim ./"
alias lg="lazygit"

# Custom key bindings

bindkey '^ ' autosuggest-accept

# Custom PATHS

export PATH=$HOME/.local/bin:$PATH

## Path of node version manager
export N_PREFIX=$HOME/.n
export PATH=$N_PREFIX/bin:$PATH

# Load custom prompt
# fpath=( "$HOMEBecho $ZSH_VERSIONREW_PREFIX/share/zsh/site-functions" $fpath )

## Jump https://github.com/gsamokovarov/jump
eval "$(jump shell)"

## Spaceship prompt
# source /opt/homebrew/opt/spaceship/spaceship.zsh

## Starship prompt
eval "$(starship init zsh)"

## Syntax highlighting
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# Private stuff that shouldn't be public
source ~/.zshrc_private
