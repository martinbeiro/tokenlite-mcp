# LiteMCP

A lightweight wrapper for the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) that reduces token usage by exposing only `search` and `execute` tools to clients.

## Why?

MCP servers can expose hundreds of tools. Each tool definition consumes tokens in the LLM's context. LiteMCP wraps your tools and exposes only two:

- **`search`** - Query available tools by name or description
- **`execute`** - Run any tool by name with arguments

This reduces token usage significantly while maintaining full functionality.

## Installation

```bash
bun add litemcp-ts
# or
npm install litemcp-ts
```

## Usage

LiteMCP has the **exact same API** as `McpServer` from the official SDK:

```typescript
import { LiteMCP } from 'litemcp-ts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Create server - same API as McpServer
const server = new LiteMCP({ name: 'my-server', version: '1.0.0' });

// Register tools - same API as McpServer.registerTool
server.registerTool(
  'greet',
  {
    description: 'Greet a user by name',
    inputSchema: { name: z.string() },
  },
  async ({ name }) => ({
    content: [{ type: 'text', text: `Hello, ${name}!` }],
  })
);

server.registerTool(
  'add',
  {
    description: 'Add two numbers',
    inputSchema: { a: z.number(), b: z.number() },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: String(a + b) }],
  })
);

// Connect - same API as McpServer.connect
const transport = new StdioServerTransport();
await server.connect(transport);
```

## What Clients See

Instead of seeing all your tools directly, clients see:

```json
{
  "tools": [
    {
      "name": "search",
      "description": "Search available tools. Returns tool names, descriptions, and input schemas.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Optional filter by name or description" }
        }
      }
    },
    {
      "name": "execute",
      "description": "Execute a tool by name with the provided arguments.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tool": { "type": "string", "description": "Name of the tool to execute" },
          "arguments": { "type": "object", "description": "Arguments to pass to the tool" }
        },
        "required": ["tool"]
      }
    }
  ]
}
```

### Search Example

```json
// Request
{ "name": "search", "arguments": { "query": "greet" } }

// Response
[
  {
    "name": "greet",
    "description": "Greet a user by name",
    "inputSchema": { "type": "object", "properties": { "name": { "type": "string" } } }
  }
]
```

### Execute Example

```json
// Request
{ "name": "execute", "arguments": { "tool": "greet", "arguments": { "name": "World" } } }

// Response
{ "content": [{ "type": "text", "text": "Hello, World!" }] }
```

## API Compatibility

LiteMCP extends `McpServer` from the official SDK, so all methods work identically:

- `registerTool()` - Register a tool
- `registerResource()` - Register a resource
- `registerPrompt()` - Register a prompt
- `connect()` - Connect to a transport
- All other `McpServer` methods

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Format code
bun run format
```

## License

MIT
