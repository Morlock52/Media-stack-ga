#!/bin/bash
# Setup MCP servers (shadcn + Context7) for Windsurf and Codex
# Usage: ./setup-mcp.sh [--context7-key YOUR_KEY]

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CONTEXT7_KEY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --context7-key)
            CONTEXT7_KEY="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       MCP Server Setup: shadcn/ui + Context7               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# WINDSURF CONFIGURATION
# ============================================================================
echo -e "${GREEN}[1/2] Configuring Windsurf MCP...${NC}"

WINDSURF_CONFIG_DIR="$HOME/.codeium/windsurf"
WINDSURF_CONFIG="$WINDSURF_CONFIG_DIR/mcp_config.json"

mkdir -p "$WINDSURF_CONFIG_DIR"

if [ -n "$CONTEXT7_KEY" ]; then
    CONTEXT7_WINDSURF=$(cat <<EOF
{
      "serverUrl": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "$CONTEXT7_KEY"
      }
    }
EOF
)
else
    CONTEXT7_WINDSURF=$(cat <<EOF
{
      "serverUrl": "https://mcp.context7.com/mcp"
    }
EOF
)
fi

cat > "$WINDSURF_CONFIG" <<EOF
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    },
    "context7": $CONTEXT7_WINDSURF
  }
}
EOF

echo -e "  ${GREEN}✓${NC} Created $WINDSURF_CONFIG"

# Create .windsurfrules in project if not exists
WINDSURFRULES="$(pwd)/.windsurfrules"
if [ ! -f "$WINDSURFRULES" ]; then
    cat > "$WINDSURFRULES" <<'EOF'
Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.
EOF
    echo -e "  ${GREEN}✓${NC} Created .windsurfrules (auto-invoke context7)"
else
    echo -e "  ${YELLOW}⚠${NC} .windsurfrules already exists, skipping"
fi

# ============================================================================
# CODEX CONFIGURATION
# ============================================================================
echo -e "${GREEN}[2/2] Configuring Codex MCP...${NC}"

CODEX_CONFIG_DIR="$HOME/.codex"
CODEX_CONFIG="$CODEX_CONFIG_DIR/config.toml"

mkdir -p "$CODEX_CONFIG_DIR"

# Check if config.toml exists and has content
if [ -f "$CODEX_CONFIG" ] && [ -s "$CODEX_CONFIG" ]; then
    # Backup existing config
    cp "$CODEX_CONFIG" "$CODEX_CONFIG.backup.$(date +%Y%m%d%H%M%S)"
    echo -e "  ${YELLOW}⚠${NC} Backed up existing config.toml"
    
    # Check if MCP servers already defined
    if grep -q "\[mcp_servers" "$CODEX_CONFIG"; then
        echo -e "  ${YELLOW}⚠${NC} MCP servers already configured in config.toml"
        echo -e "  ${YELLOW}  ${NC} Please manually add shadcn and context7 if not present"
    else
        # Append MCP config
        if [ -n "$CONTEXT7_KEY" ]; then
            cat >> "$CODEX_CONFIG" <<EOF

[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp", "--api-key", "$CONTEXT7_KEY"]
EOF
        else
            cat >> "$CODEX_CONFIG" <<EOF

[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
EOF
        fi
        echo -e "  ${GREEN}✓${NC} Appended MCP config to $CODEX_CONFIG"
    fi
else
    # Create new config
    if [ -n "$CONTEXT7_KEY" ]; then
        cat > "$CODEX_CONFIG" <<EOF
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp", "--api-key", "$CONTEXT7_KEY"]
EOF
    else
        cat > "$CODEX_CONFIG" <<EOF
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
EOF
    fi
    echo -e "  ${GREEN}✓${NC} Created $CODEX_CONFIG"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ MCP Setup Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Restart Windsurf and/or Codex to load the MCP servers"
echo "  2. Test shadcn: 'Show me all available shadcn components'"
echo "  3. Test Context7: 'use context7 to explain React hooks'"
echo ""
if [ -z "$CONTEXT7_KEY" ]; then
    echo -e "${YELLOW}Tip:${NC} For higher rate limits, get a free API key at:"
    echo "     https://context7.com/dashboard"
    echo "     Then re-run: ./setup-mcp.sh --context7-key YOUR_KEY"
fi
echo ""
