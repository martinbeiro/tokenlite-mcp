import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
  type Tool,
  type Implementation,
} from '@modelcontextprotocol/sdk/types.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { TokenStats, TokenLiteOptions } from './types.js';
import { bm25Search } from './search.js';

/** Meta-tool definitions for search and execute */
const SEARCH_TOOL: Tool = {
  name: 'search',
  description: 'Search available tools. Returns tool names, descriptions, and input schemas.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Filter by name or description' },
      limit: { type: 'number', description: 'Max results to return (default: 10)' },
    },
  },
};

const EXECUTE_TOOL: Tool = {
  name: 'execute',
  description: 'Execute a tool by name with the provided arguments.',
  inputSchema: {
    type: 'object',
    properties: {
      tool: { type: 'string', description: 'Name of the tool to execute' },
      arguments: { type: 'object', description: 'Arguments to pass to the tool', additionalProperties: true },
    },
    required: ['tool'],
  },
};

export class TokenLite extends McpServer {
  private readonly _liteMode: boolean;

  constructor(serverInfo: Implementation, options?: TokenLiteOptions) {
    super(serverInfo, options);
    this._liteMode = options?.liteMode ?? true;
  }

  /** Check if lite mode is enabled */
  get liteMode(): boolean {
    return this._liteMode;
  }

  /** Access registered tools from parent class */
  private get registeredTools(): Record<string, RegisteredTool> {
    return (this as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;
  }

  override async connect(transport: Transport): Promise<void> {
    if (!this._liteMode) {
      await super.connect(transport);
      return;
    }

    // Override tools/list to expose visible tools + search + execute
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const visibleTools = this.getVisibleTools();
      return { tools: [...visibleTools, SEARCH_TOOL, EXECUTE_TOOL] };
    });

    // Override tools/call to handle visible tools directly + route through search/execute
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      // Check if it's an always-visible tool - call directly
      const tool = this.registeredTools[name];
      if (tool && tool._meta?.alwaysVisible) {
        return this.callTool(tool, args as Record<string, unknown>);
      }

      if (name === 'search') {
        return this.handleSearch(
          args['query'] as string | undefined,
          args['limit'] as number | undefined
        );
      }

      if (name === 'execute') {
        return this.handleExecute(
          args['tool'] as string,
          (args['arguments'] ?? {}) as Record<string, unknown>
        );
      }

      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}. Use 'search' and 'execute'.` }],
      };
    });

    await super.connect(transport);
  }

  /** Get tools marked as alwaysVisible */
  private getVisibleTools(): Tool[] {
    return Object.entries(this.registeredTools)
      .filter(([, tool]) => tool.enabled && tool._meta?.alwaysVisible)
      .map(([name, tool]) => {
        const schema = tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : {};
        return {
          name,
          description: tool.description,
          inputSchema: { type: 'object' as const, ...schema },
        };
      });
  }

  /** Call a tool handler */
  private async callTool(
    tool: RegisteredTool,
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    if (!tool.enabled) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Tool is disabled.' }],
      };
    }

    try {
      const handler = tool.handler as (
        args: Record<string, unknown>,
        extra: unknown
      ) => Promise<CallToolResult>;
      return await handler(args, {});
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool error: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }

  private handleSearch(query?: string, limit: number = 10): CallToolResult {
    // Exclude alwaysVisible tools from search (they're already exposed directly)
    const tools = Object.entries(this.registeredTools)
      .filter(([, tool]) => tool.enabled && !tool._meta?.alwaysVisible)
      .map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : undefined,
      }));

    // Use BM25 ranking when query is provided
    const results = query ? bm25Search(tools, query).map((r) => r.doc) : tools;

    const total = results.length;
    const limited = results.slice(0, limit);

    return {
      content: [{ type: 'text', text: JSON.stringify({ tools: limited, total, limit }, null, 2) }],
    };
  }

  private async handleExecute(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    const tool = this.registeredTools[toolName];

    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: "${toolName}". Use the search tool to list available tools.` }],
      };
    }

    return this.callTool(tool, args);
  }

  /**
   * Get token usage statistics comparing traditional MCP vs TokenLite approach.
   * Uses ~4 characters per token as approximation.
   */
  getTokenStats(): TokenStats {
    const allToolSchemas = Object.entries(this.registeredTools)
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : undefined,
      }));

    const visibleToolSchemas = Object.entries(this.registeredTools)
      .filter(([, tool]) => tool.enabled && tool._meta?.alwaysVisible)
      .map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : { type: 'object' },
      }));

    const traditionalJson = JSON.stringify({ tools: allToolSchemas });
    const tokenLiteBase = JSON.stringify({
      tools: [...visibleToolSchemas, SEARCH_TOOL, EXECUTE_TOOL],
    });

    const charsPerToken = 4;
    const traditionalTokens = Math.ceil(traditionalJson.length / charsPerToken);
    const tokenLiteBaseTokens = Math.ceil(tokenLiteBase.length / charsPerToken);

    const searchableTools = allToolSchemas.filter(
      (t) => !visibleToolSchemas.some((v) => v.name === t.name)
    );
    const sampleSearchResult = JSON.stringify({
      tools: searchableTools.slice(0, 3),
      total: searchableTools.length,
      limit: 10,
    });
    const avgSearchTokens = Math.ceil(sampleSearchResult.length / charsPerToken);

    const savings = traditionalTokens > 0
      ? Math.round((1 - tokenLiteBaseTokens / traditionalTokens) * 100)
      : 0;

    return {
      toolCount: allToolSchemas.length,
      traditional: { tokens: traditionalTokens, characters: traditionalJson.length },
      tokenLite: { baseTokens: tokenLiteBaseTokens, baseCharacters: tokenLiteBase.length, avgSearchTokens },
      savingsPercent: savings,
    };
  }
}
