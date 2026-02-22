/**
 * Basic LiteMCP Example
 *
 * This creates an MCP server with a few sample tools.
 * Clients will only see `search` and `execute` tools.
 *
 * Run with: bun run examples/basic.ts
 */

import { z } from 'zod';
import { LiteMCP } from '../src/index.js';

// Create the server
const mcp = new LiteMCP('example-server', { version: '1.0.0' });

// Register some tools
mcp
  .tool(
    'greet',
    {
      description: 'Greet a user by name',
      input: {
        name: z.string().describe('The name to greet'),
      },
    },
    async ({ name }) => {
      return `Hello, ${name}!`;
    }
  )
  .tool(
    'add',
    {
      description: 'Add two numbers together',
      input: {
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      },
    },
    async ({ a, b }) => {
      return { result: a + b };
    }
  )
  .tool(
    'get_weather',
    {
      description: 'Get the current weather for a city',
      input: {
        city: z.string().describe('City name'),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
      },
    },
    async ({ city, units }) => {
      // Simulated weather data
      const temp = units === 'celsius' ? 22 : 72;
      return {
        city,
        temperature: temp,
        units,
        condition: 'sunny',
      };
    }
  );

// Start the server
await mcp.start();
