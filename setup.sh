#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="dotfiles.conf"
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔗 Installing dotfiles from $DOTFILES_DIR"

current_package=""
target=""
ignore_list=()

while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(echo "$line" | xargs)"
    [[ -z "$line" || "$line" =~ ^# ]] && continue

    if [[ "$line" =~ ^\[(.*)\]$ ]]; then
        current_package="${BASH_REMATCH[1]}"
        target=""
        ignore_list=()
    elif [[ "$line" =~ ^target=(.*)$ ]]; then
        target="${BASH_REMATCH[1]}"
        target="${target/#\~/$HOME}" # expand ~
    elif [[ "$line" =~ ^ignore=(.*)$ ]]; then
        ignore_list=(${BASH_REMATCH[1]})
    fi

    if [[ -n "$current_package" && -n "$target" && ( "$line" =~ ^\[.*\]$ || -z "$line" ) ]]; then
        src="$DOTFILES_DIR/$current_package"
        if [[ ! -d "$src" ]]; then
            echo "⚠️  Skipping $current_package (no folder $src)"
        else
            echo "📦 Linking $current_package → $target"
            mkdir -p "$target"

            for item in "$src"/*; do
                base=$(basename "$item")

                if [[ " ${ignore_list[*]} " =~ " $base " ]]; then
                    echo "  ⏭️  Ignoring $base"
                    continue
                fi

                dest="$target/$base"

                if [[ -e "$dest" && ! -L "$dest" ]]; then
                    mv "$dest" "$dest.bak"
                    echo "  🔒 Backed up $dest → $dest.bak"
                fi

                ln -sfn "$item" "$dest"
                echo "  🔗 $dest → $item"
            done
        fi

        target=""
        ignore_list=()
    fi
done < "$CONFIG_FILE"

echo "------------Completed------------"
