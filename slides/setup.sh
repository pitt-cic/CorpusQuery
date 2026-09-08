#!/usr/bin/env bash
set -euo pipefail

# Check / install bun
if command -v bun &>/dev/null; then
    echo "bun $(bun --version) already installed"
else
    echo "bun not found."
    echo ""
    echo "Select your platform:"
    echo "  1) Mac / Linux "
    echo "  2) Windows (native PowerShell)"
    read -rp "Enter 1 or 2: " platform

    if [ "$platform" = "2" ]; then
        echo ""
        echo "Run the following in PowerShell, then re-run the setup script:"
        echo ""
        echo "  irm bun.sh/install.ps1 | iex"
        echo ""
        exit 0
    else
        curl -fsSL https://bun.sh/install | bash

        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"

        if command -v bun &>/dev/null; then
            echo "bun $(bun --version) installed"
            echo "Add to your shell profile to persist:"
            echo '  export BUN_INSTALL="$HOME/.bun"'
            echo '  export PATH="$BUN_INSTALL/bin:$PATH"'
        else
            echo "bun installation failed. Visit https://bun.sh to install manually."
            exit 1
        fi
    fi
fi

# Register deckx authoring skill for Claude Code
bunx skills add samuelcolvin/deckx 2>/dev/null || true

# Initialise bun project & install dependencies
bun init -y
bun add @samuelcolvin/deckx
bun add -d @types/react

echo ""
echo "Slides setup complete!"
echo ""
echo "  bunx deckx dev   -> live dev server at http://localhost:5173"
echo "  bunx deckx html  -> build to dist/index.html"
echo "  bunx deckx pdf   -> export to PDF"
echo ""
