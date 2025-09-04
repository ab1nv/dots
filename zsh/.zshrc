export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git)
source $ZSH/oh-my-zsh.sh
alias ls="eza --icons --git --long -a"
alias stow-all='cd ~/projects/dotfiles && stow -v -t ~ *'
