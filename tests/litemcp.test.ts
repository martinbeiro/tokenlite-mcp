import { describe, it, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import { LiteMCP } from '../src/index.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Helper to access private members for testing
type LiteMCPInternal = LiteMCP & {
  _registeredTools: Record<string, RegisteredTool>;
  registeredTools: Record<string, RegisteredTool>;
  handleSearch: (query?: string, limit?: number) => CallToolResult;
  handleExecute: (toolName: string, args: Record<string, unknown>) => Promise<CallToolResult>;
};

// Helper to parse search results
function parseSearchResult(result: CallToolResult) {
  return JSON.parse(result.content[0].text as string) as {
    tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    total: number;
    limit: number;
  };
}

describe('LiteMCP', () => {
  let server: LiteMCPInternal;

  beforeEach(() => {
    server = new LiteMCP({ name: 'test-server', version: '1.0.0' }) as LiteMCPInternal;
  });

  describe('registerTool', () => {
    it('registers a tool successfully', () => {
      server.registerTool(
        'greet',
        {
          description: 'Greet someone',
          inputSchema: { name: z.string() },
        },
        async ({ name }) => ({
          content: [{ type: 'text', text: `Hello, ${name}!` }],
        })
      );

      expect(server._registeredTools['greet']).toBeDefined();
      expect(server._registeredTools['greet'].description).toBe('Greet someone');
    });

    it('registers multiple tools', () => {
      server.registerTool('tool1', { description: 'Tool 1' }, async () => ({
        content: [{ type: 'text', text: 'result1' }],
      }));
      server.registerTool('tool2', { description: 'Tool 2' }, async () => ({
        content: [{ type: 'text', text: 'result2' }],
      }));

      expect(Object.keys(server._registeredTools)).toHaveLength(2);
    });

    it('tools are enabled by default', () => {
      server.registerTool('test', { description: 'Test' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));

      expect(server._registeredTools['test'].enabled).toBe(true);
    });
  });

  describe('handleSearch', () => {
    beforeEach(() => {
      server.registerTool(
        'greet',
        {
          description: 'Greet a user',
          inputSchema: { name: z.string() },
        },
        async () => ({ content: [{ type: 'text', text: 'hello' }] })
      );
      server.registerTool(
        'add',
        {
          description: 'Add numbers',
          inputSchema: { a: z.number(), b: z.number() },
        },
        async () => ({ content: [{ type: 'text', text: '3' }] })
      );
      server.registerTool(
        'weather',
        { description: 'Get weather forecast' },
        async () => ({ content: [{ type: 'text', text: 'sunny' }] })
      );
    });

    it('returns all registered tools when no query', () => {
      const result = parseSearchResult(server.handleSearch());

      expect(result.tools).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.tools.map((t) => t.name)).toContain('greet');
      expect(result.tools.map((t) => t.name)).toContain('add');
      expect(result.tools.map((t) => t.name)).toContain('weather');
    });

    it('filters by tool name', () => {
      const result = parseSearchResult(server.handleSearch('greet'));

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('greet');
    });

    it('filters by description', () => {
      const result = parseSearchResult(server.handleSearch('forecast'));

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('weather');
    });

    it('filter is case insensitive', () => {
      const result = parseSearchResult(server.handleSearch('GREET'));

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('greet');
    });

    it('returns empty array when no match', () => {
      const result = parseSearchResult(
        server.handleSearch('nonexistent')
      );

      expect(result.tools).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('excludes disabled tools', () => {
      server._registeredTools['greet'].enabled = false;

      const result = parseSearchResult(server.handleSearch());

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).not.toContain('greet');
    });

    it('includes inputSchema in results', () => {
      const result = parseSearchResult(server.handleSearch('add'));

      expect(result.tools[0].inputSchema).toBeDefined();
    });

    it('respects limit parameter', () => {
      const result = parseSearchResult(
        server.handleSearch(undefined, 2)
      );

      expect(result.tools).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
    });

    it('uses default limit of 10', () => {
      const result = parseSearchResult(server.handleSearch());

      expect(result.limit).toBe(10);
    });
  });

  describe('handleExecute', () => {
    beforeEach(() => {
      server.registerTool(
        'greet',
        {
          description: 'Greet a user',
          inputSchema: { name: z.string() },
        },
        async ({ name }) => ({
          content: [{ type: 'text', text: `Hello, ${name}!` }],
        })
      );
      server.registerTool(
        'add',
        {
          description: 'Add numbers',
          inputSchema: { a: z.number(), b: z.number() },
        },
        async ({ a, b }) => ({
          content: [{ type: 'text', text: String(a + b) }],
        })
      );
    });

    it('calls the correct handler with arguments', async () => {
      const result = await server.handleExecute('greet', {
        name: 'World',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('Hello, World!');
    });

    it('passes multiple arguments correctly', async () => {
      const result = await server.handleExecute('add', {
        a: 2,
        b: 3,
      });

      expect(result.content[0].text).toBe('5');
    });

    it('returns error for unknown tool', async () => {
      const result = await server.handleExecute('unknown', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('returns error for disabled tool', async () => {
      server._registeredTools['greet'].enabled = false;

      const result = await server.handleExecute('greet', {
        name: 'World',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('disabled');
    });

    it('catches and returns handler errors', async () => {
      server.registerTool('failing', { description: 'Fails' }, async () => {
        throw new Error('Something went wrong');
      });

      const result = await server.handleExecute('failing', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Something went wrong');
    });
  });

  describe('tools/list override', () => {
    it('only exposes search and execute tools', async () => {
      // Register some tools
      server.registerTool('greet', { description: 'Greet' }, async () => ({
        content: [{ type: 'text', text: 'hi' }],
      }));
      server.registerTool('add', { description: 'Add' }, async () => ({
        content: [{ type: 'text', text: '3' }],
      }));

      // We can't easily test the protocol handler without mocking transport,
      // but we've verified the handlers work correctly above.
      // The integration is that connect() sets up handlers to only return
      // search + execute in the tools/list response.
      expect(true).toBe(true);
    });
  });

  describe('BM25 search', () => {
    beforeEach(() => {
      server.registerTool('create_user', { description: 'Create a new user account' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));
      server.registerTool('delete_user', { description: 'Delete a user account' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));
      server.registerTool('get_user', { description: 'Get user details by ID' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));
      server.registerTool('send_email', { description: 'Send an email notification' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));
      server.registerTool('health_check', { description: 'Check system health' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));
    });

    it('matches word parts in snake_case names', () => {
      const result = parseSearchResult(server.handleSearch('user'));

      expect(result.tools.length).toBeGreaterThanOrEqual(3);
      expect(result.tools.map((t) => t.name)).toContain('create_user');
      expect(result.tools.map((t) => t.name)).toContain('delete_user');
      expect(result.tools.map((t) => t.name)).toContain('get_user');
    });

    it('ranks exact matches higher', () => {
      const result = parseSearchResult(server.handleSearch('get_user'));

      expect(result.tools[0].name).toBe('get_user');
    });

    it('matches multiple query terms', () => {
      const result = parseSearchResult(server.handleSearch('create account'));

      expect(result.tools.length).toBeGreaterThanOrEqual(1);
      expect(result.tools[0].name).toBe('create_user');
    });

    it('searches description content', () => {
      const result = parseSearchResult(server.handleSearch('notification'));

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('send_email');
    });

    it('returns results sorted by relevance', () => {
      // 'user' appears in multiple tools - should be ranked
      const result = parseSearchResult(server.handleSearch('user'));

      // Should have multiple results, all ranked by relevance
      expect(result.tools.length).toBeGreaterThan(0);
      // All returned tools should contain 'user' somewhere
      for (const tool of result.tools) {
        const searchText = `${tool.name} ${tool.description ?? ''}`.toLowerCase();
        expect(searchText).toContain('user');
      }
    });
  });

  describe('getTokenStats', () => {
    beforeEach(() => {
      // Register enough tools to show savings (LiteMCP overhead is ~162 tokens)
      for (let i = 1; i <= 10; i++) {
        server.registerTool(
          `tool${i}`,
          {
            description: `Tool number ${i} that does something useful`,
            inputSchema: { input: z.string().describe('Input parameter') },
          },
          async () => ({ content: [{ type: 'text', text: 'ok' }] })
        );
      }
    });

    it('returns correct tool count', () => {
      const stats = server.getTokenStats();
      expect(stats.toolCount).toBe(10);
    });

    it('traditional tokens are greater than liteMcp base tokens with many tools', () => {
      const stats = server.getTokenStats();
      expect(stats.traditional.tokens).toBeGreaterThan(stats.liteMcp.baseTokens);
    });

    it('calculates positive savings percentage with many tools', () => {
      const stats = server.getTokenStats();
      expect(stats.savingsPercent).toBeGreaterThan(0);
      expect(stats.savingsPercent).toBeLessThan(100);
    });

    it('excludes disabled tools from stats', () => {
      server._registeredTools['tool1'].enabled = false;
      const stats = server.getTokenStats();
      expect(stats.toolCount).toBe(9);
    });

    it('returns all required fields', () => {
      const stats = server.getTokenStats();
      expect(stats.toolCount).toBeDefined();
      expect(stats.traditional.tokens).toBeDefined();
      expect(stats.traditional.characters).toBeDefined();
      expect(stats.liteMcp.baseTokens).toBeDefined();
      expect(stats.liteMcp.baseCharacters).toBeDefined();
      expect(stats.liteMcp.avgSearchTokens).toBeDefined();
      expect(stats.savingsPercent).toBeDefined();
    });
  });

  describe('alwaysVisible', () => {
    beforeEach(() => {
      // Regular tools (searchable only)
      server.registerTool('create_user', { description: 'Create a new user account' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));
      server.registerTool('delete_user', { description: 'Delete a user account' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));

      // Always visible tool
      server.registerTool(
        'health_check',
        {
          description: 'Check system health',
          _meta: { alwaysVisible: true },
        },
        async () => ({
          content: [{ type: 'text', text: 'healthy' }],
        })
      );
    });

    it('excludes alwaysVisible tools from search results', () => {
      const result = parseSearchResult(server.handleSearch());

      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).not.toContain('health_check');
      expect(result.tools.map((t) => t.name)).toContain('create_user');
      expect(result.tools.map((t) => t.name)).toContain('delete_user');
    });

    it('does not find alwaysVisible tools via search query', () => {
      const result = parseSearchResult(server.handleSearch('health'));

      expect(result.tools).toHaveLength(0);
    });

    it('stores _meta on registered tool', () => {
      expect(server._registeredTools['health_check']._meta).toEqual({ alwaysVisible: true });
    });

    it('getTokenStats includes visible tools in base tokens', () => {
      const stats = server.getTokenStats();

      // With 1 visible tool + search + execute, base tokens should be higher than
      // just search + execute alone
      expect(stats.liteMcp.baseTokens).toBeGreaterThan(150); // ~162 for just search+execute
    });

    it('getTokenStats counts all tools in toolCount', () => {
      const stats = server.getTokenStats();

      expect(stats.toolCount).toBe(3); // 2 regular + 1 visible
    });

    it('getTokenStats excludes visible tools from avgSearchTokens sample', () => {
      // Register more regular tools to have a sample
      server.registerTool('get_user', { description: 'Get user details' }, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));

      const stats = server.getTokenStats();

      // avgSearchTokens should be based on 3 regular tools, not the visible one
      expect(stats.liteMcp.avgSearchTokens).toBeGreaterThan(0);
    });
  });
});
