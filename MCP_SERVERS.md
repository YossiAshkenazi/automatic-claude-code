# MCP Servers Installation Guide

## Status: ✅ Working MCP Servers

The following MCP servers are confirmed working and can be used with Claude Code:

### 1. Playwright MCP Server (@playwright/mcp)
**Status:** ✅ Working
**Command:** `npx @playwright/mcp@latest`
**Description:** Browser automation with Playwright, enabling web interaction without screenshots
**Features:**
- Fast and lightweight browser automation
- LLM-friendly (no vision models needed)
- Deterministic tool application
- Options: --isolated, --device, --headless

### 2. Memory MCP Server (@modelcontextprotocol/server-memory)
**Status:** ✅ Working  
**Command:** `npx -y @modelcontextprotocol/server-memory`
**Description:** Knowledge graph-based persistent memory system
**Features:**
- Create entities and relations
- Add observations
- Search and read graph
- Persistent storage in JSON

### 3. Context7 MCP Server (@upstash/context7-mcp)
**Status:** ✅ Working
**Command:** `npx -y @upstash/context7-mcp`
**Description:** Access Context7 documentation for various libraries
**Features:**
- Resolve library names to IDs
- Fetch up-to-date documentation
- Focus on specific topics

## Testing MCP Servers

You can test each server using JSON-RPC:

```bash
# Test Memory server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y @modelcontextprotocol/server-memory

# Test Context7 server  
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y @upstash/context7-mcp

# Test Playwright server (runs interactively)
npx @playwright/mcp@latest
```

## Claude Desktop Configuration

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

## Notes

- GitHub MCP server (@modelcontextprotocol/server-github) is marked as deprecated
- Archon MCP server package name couldn't be found in npm registry
- These servers use npx for easy execution without global installation
- All servers communicate via stdio using JSON-RPC protocol