/**
 * Basic LiteMCP Example
 *
 * Uses the exact same API as McpServer from the SDK.
 * Clients will only see `search` and `execute` tools.
 *
 * Run with: bun run examples/basic.ts
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LiteMCP } from '../src/index.js';

// Create the server - same API as McpServer
const server = new LiteMCP({ name: 'example-server', version: '1.0.0' });

// Register tools - same API as McpServer.registerTool
server.registerTool(
  'greet',
  {
    description: 'Greet a user by name',
    inputSchema: {
      name: z.string().describe('The name to greet'),
    },
  },
  async ({ name }) => ({
    content: [{ type: 'text', text: `Hello, ${name}!` }],
  })
);

server.registerTool(
  'add',
  {
    description: 'Add two numbers together',
    inputSchema: {
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: JSON.stringify({ result: a + b }) }],
  })
);

server.registerTool(
  'get_weather',
  {
    description: 'Get the current weather for a city',
    inputSchema: {
      city: z.string().describe('City name'),
      units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
    },
  },
  async ({ city, units }) => {
    const temp = units === 'celsius' ? 22 : 72;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ city, temperature: temp, units, condition: 'sunny' }),
        },
      ],
    };
  }
);

// Connect transport - same API as McpServer.connect
const transport = new StdioServerTransport();
await server.connect(transport);
