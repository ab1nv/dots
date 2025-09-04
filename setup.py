#!/usr/bin/env python3
import os
import re
import shutil
import sys

DEBUG = "--debug" in sys.argv

DOTFILES_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(DOTFILES_DIR, "dotfiles.conf")

def log(msg):
    print(msg)

def debug(msg):
    if DEBUG:
        print(f"🐞 {msg}")

def expand_path(path: str) -> str:
    return os.path.expanduser(path)

def process_package(name: str, target: str, ignore: list[str]):
    src = os.path.join(DOTFILES_DIR, name)
    if not os.path.isdir(src):
        log(f"⚠️  Skipping {name} (no folder {src})")
        return

    target = expand_path(target)
    log(f"📦 Linking {name} → {target}")
    os.makedirs(target, exist_ok=True)

    for item in os.listdir(src):
        if item in ignore:
            log(f"  ⏭️  Ignoring {item}")
            continue

        src_item = os.path.join(src, item)
        dest_item = os.path.join(target, item)

        if os.path.exists(dest_item) and not os.path.islink(dest_item):
            backup = dest_item + ".bak"
            shutil.move(dest_item, backup)
            log(f"  🔒 Backed up {dest_item} → {backup}")

        if os.path.islink(dest_item) or os.path.exists(dest_item):
            os.remove(dest_item)

        os.symlink(src_item, dest_item)
        log(f"  🔗 {dest_item} → {src_item}")

def main():
    if not os.path.isfile(CONFIG_FILE):
        log(f"❌ Config file not found: {CONFIG_FILE}")
        sys.exit(1)

    log(f"🔗 Installing dotfiles from {DOTFILES_DIR}")

    current_package = None
    target = None
    ignore = []

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            debug(f"LINE: '{line}'")

            if not line or line.startswith("#"):
                continue

            section = re.match(r"^\[(.+)\]$", line)
            if section:
                if current_package and target:
                    process_package(current_package, target, ignore)
                current_package = section.group(1)
                target = None
                ignore = []
                continue

            match = re.match(r"^target=(.+)$", line)
            if match:
                target = match.group(1)
                continue

            match = re.match(r"^ignore=(.+)$", line)
            if match:
                ignore = match.group(1).split()
                continue

    if current_package and target:
        process_package(current_package, target, ignore)

    log("------------Completed------------")

if __name__ == "__main__":
    main()
