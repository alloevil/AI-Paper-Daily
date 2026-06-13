export ZSH="/root/.openclaw/workspace/.oh-my-zsh"
export PATH="/root/.openclaw/workspace/.local/bin:$PATH"
ZSH_THEME="robbyrussell"
plugins=(git zsh-autosuggestions zsh-syntax-highlighting zsh-completions)
source $ZSH/oh-my-zsh.sh

# Aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# History
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history
