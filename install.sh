#!/usr/bin/env bash

echo -e "\\nCreating symlinks"
echo "=============================="
symlinks=(
  ".zshrc" 
  ".gitconfig"
  ".config/astronvim"
)
for file in ${symlinks[@]}; do
    from="$HOME/dotfiles/symlinks/$file"
    target="$HOME/$file"
    if [ -e "$target" ]; then
        echo "~$target already exists... skipping."
    else
        echo "Creating symlink for ~$target"
        ln -s "$from" "$target"
    fi
done

