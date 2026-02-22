# LiteMCP

A drop-in replacement for the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) that adds **intelligent tool discovery** for MCP clients.

## The Problem

Many AI agents and MCP clients don't have native tool searching. When your server exposes 50+ tools, the client loads *all* tool definitions into the LLM context - wasting tokens and overwhelming the model.

LiteMCP solves this by wrapping your tools with:

- **`search`** - BM25-ranked tool discovery by name/description
- **`execute`** - Run any tool by name with arguments

Now clients can search for relevant tools instead of loading everything upfront.

## Token Savings

With 10 tools, LiteMCP reduces base context usage by **~80%**:

```
┌─────────────────┬─────────────┐
│ Approach        │ Tokens      │
├─────────────────┼─────────────┤
│ Traditional MCP │         917 │
│ LiteMCP (base)  │         162 │
└─────────────────┴─────────────┘
```

Run `bun run compare-tokens` to see stats for your own tools.

## Installation

```bash
bun add tokenlite-mcp
# or
npm install tokenlite-mcp
```

## Usage

LiteMCP has the **exact same API** as `McpServer`:

```typescript
import { LiteMCP } from 'tokenlite-mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new LiteMCP({ name: 'my-server', version: '1.0.0' });

// Register tools exactly like McpServer
server.registerTool(
  'create_user',
  {
    description: 'Create a new user account',
    inputSchema: {
      email: z.string().email(),
      name: z.string(),
    },
  },
  async ({ email, name }) => ({
    content: [{ type: 'text', text: JSON.stringify({ id: '123', email, name }) }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## What Clients See

Instead of all your tools, clients see two meta-tools:

```json
{
  "tools": [
    { "name": "search", "description": "Search available tools..." },
    { "name": "execute", "description": "Execute a tool by name..." }
  ]
}
```

### Search with BM25 Ranking

```json
// Request
{ "name": "search", "arguments": { "query": "user" } }

// Response - ranked by relevance
{
  "tools": [
    { "name": "create_user", "description": "Create a new user account", "inputSchema": {...} },
    { "name": "get_user", "description": "Get user by ID", "inputSchema": {...} },
    { "name": "delete_user", "description": "Delete a user", "inputSchema": {...} }
  ],
  "total": 3,
  "limit": 10
}
```

Search features:
- Splits `snake_case` and `camelCase` into words
- Matches across name and description
- IDF-weighted scoring (rare terms rank higher)
- Exact name matches get boosted

### Execute Tools

```json
// Request
{ "name": "execute", "arguments": { "tool": "create_user", "arguments": { "email": "a@b.com", "name": "Alice" } } }

// Response
{ "content": [{ "type": "text", "text": "{\"id\":\"123\",\"email\":\"a@b.com\",\"name\":\"Alice\"}" }] }
```

## Options

```typescript
const server = new LiteMCP(
  { name: 'my-server', version: '1.0.0' },
  {
    liteMode: true,  // Enable search+execute (default: true)
                     // Set to false for traditional MCP behavior
  }
);
```

## Programmatic Token Stats

```typescript
const stats = server.getTokenStats();
console.log(stats);
// {
//   toolCount: 10,
//   traditional: { tokens: 917, characters: 3667 },
//   liteMcp: { baseTokens: 162, baseCharacters: 646, avgSearchTokens: 283 },
//   savingsPercent: 82
// }
```

## Development

```bash
bun install          # Install dependencies
bun test             # Run tests (40 tests)
bun run example      # Run example server
bun run inspector    # Test with MCP Inspector
bun run compare-tokens  # See token comparison
```

## License

MIT
