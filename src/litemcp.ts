import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
  type Tool,
  type Implementation,
} from '@modelcontextprotocol/sdk/types.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { TokenStats, LiteMCPOptions } from './types.js';
import { bm25Search } from './search.js';

export class LiteMCP extends McpServer {
  private _liteMode: boolean;

  constructor(serverInfo: Implementation, options?: LiteMCPOptions) {
    super(serverInfo, options);
    this._liteMode = options?.liteMode ?? true;
  }

  /** Check if lite mode is enabled */
  get liteMode(): boolean {
    return this._liteMode;
  }

  /** Set lite mode on/off */
  set liteMode(value: boolean) {
    this._liteMode = value;
  }

  override async connect(transport: Transport): Promise<void> {
    // Access private _registeredTools via any cast
    const registeredTools = (this as unknown as { _registeredTools: Record<string, RegisteredTool> })
      ._registeredTools;

    // Build lite mode tool definitions
    const searchTool: Tool = {
      name: 'search',
      description: 'Search available tools. Returns tool names, descriptions, and input schemas.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Filter by name or description',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default: 10)',
          },
        },
      },
    };

    const executeTool: Tool = {
      name: 'execute',
      description: 'Execute a tool by name with the provided arguments.',
      inputSchema: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            description: 'Name of the tool to execute',
          },
          arguments: {
            type: 'object',
            description: 'Arguments to pass to the tool',
            additionalProperties: true,
          },
        },
        required: ['tool'],
      },
    };

    const setModeTool: Tool = {
      name: 'set_mode',
      description: 'Toggle between lite mode (search + execute) and traditional mode (all tools). Returns the new mode.',
      inputSchema: {
        type: 'object',
        properties: {
          lite: {
            type: 'boolean',
            description: 'Enable lite mode (true) or traditional mode (false)',
          },
        },
        required: ['lite'],
      },
    };

    // Override tools/list based on current mode
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (this._liteMode) {
        return { tools: [searchTool, executeTool, setModeTool] };
      }
      // Traditional mode: expose all registered tools + set_mode
      const allTools = Object.entries(registeredTools)
        .filter(([, tool]) => tool.enabled)
        .map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : undefined,
        }));
      return { tools: [...allTools, setModeTool] };
    });

    // Override tools/call to route based on mode
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      // set_mode is always available
      if (name === 'set_mode') {
        this._liteMode = args['lite'] as boolean;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              mode: this._liteMode ? 'lite' : 'traditional',
              message: this._liteMode
                ? 'Lite mode enabled. Use search + execute to discover and call tools.'
                : 'Traditional mode enabled. All tools are now directly available.',
            }),
          }],
        };
      }

      if (this._liteMode) {
        // Lite mode: only search and execute
        if (name === 'search') {
          return this.handleSearch(
            registeredTools,
            args['query'] as string | undefined,
            args['limit'] as number | undefined
          );
        }

        if (name === 'execute') {
          return this.handleExecute(
            registeredTools,
            args['tool'] as string,
            (args['arguments'] ?? {}) as Record<string, unknown>
          );
        }

        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${name}. In lite mode, use 'search' and 'execute'.` }],
        };
      }

      // Traditional mode: call registered tools directly
      return this.handleExecute(registeredTools, name, args as Record<string, unknown>);
    });

    await super.connect(transport);
  }

  private handleSearch(
    registeredTools: Record<string, RegisteredTool>,
    query?: string,
    limit: number = 10
  ): CallToolResult {
    const tools = Object.entries(registeredTools)
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema
          ? toJsonSchemaCompat(tool.inputSchema)
          : undefined,
      }));

    // Use BM25 ranking when query is provided
    let results: typeof tools;
    if (query) {
      const ranked = bm25Search(tools, query);
      results = ranked.map((r) => r.doc);
    } else {
      results = tools;
    }

    // Apply limit
    const total = results.length;
    const limited = results.slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tools: limited, total, limit }, null, 2),
        },
      ],
    };
  }

  /**
   * Get token usage statistics comparing traditional MCP vs LiteMCP approach.
   * Uses ~4 characters per token as approximation.
   */
  getTokenStats(): TokenStats {
    const registeredTools = (this as unknown as { _registeredTools: Record<string, RegisteredTool> })
      ._registeredTools;

    // Build all tool schemas as they'd appear in traditional tools/list
    const allToolSchemas = Object.entries(registeredTools)
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema ? toJsonSchemaCompat(tool.inputSchema) : undefined,
      }));

    const traditionalJson = JSON.stringify({ tools: allToolSchemas });

    // LiteMCP base: just search + execute
    const liteMcpBase = JSON.stringify({
      tools: [
        {
          name: 'search',
          description: 'Search available tools. Returns tool names, descriptions, and input schemas.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Filter by name or description' },
              limit: { type: 'number', description: 'Max results to return (default: 10)' },
            },
          },
        },
        {
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
        },
      ],
    });

    // Estimate tokens (~4 chars per token)
    const charsPerToken = 4;
    const traditionalTokens = Math.ceil(traditionalJson.length / charsPerToken);
    const liteMcpBaseTokens = Math.ceil(liteMcpBase.length / charsPerToken);

    // Average search result (3 tools)
    const sampleSearchResult = JSON.stringify({
      tools: allToolSchemas.slice(0, 3),
      total: allToolSchemas.length,
      limit: 10,
    });
    const avgSearchTokens = Math.ceil(sampleSearchResult.length / charsPerToken);

    const savings = traditionalTokens > 0
      ? Math.round((1 - liteMcpBaseTokens / traditionalTokens) * 100)
      : 0;

    return {
      toolCount: allToolSchemas.length,
      traditional: {
        tokens: traditionalTokens,
        characters: traditionalJson.length,
      },
      liteMcp: {
        baseTokens: liteMcpBaseTokens,
        baseCharacters: liteMcpBase.length,
        avgSearchTokens,
      },
      savingsPercent: savings,
    };
  }

  private async handleExecute(
    registeredTools: Record<string, RegisteredTool>,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    const tool = registeredTools[toolName];

    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: "${toolName}". Use the search tool to list available tools.`,
          },
        ],
      };
    }

    if (!tool.enabled) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool "${toolName}" is disabled.` }],
      };
    }

    try {
      // Call the original handler
      const handler = tool.handler as (
        args: Record<string, unknown>,
        extra: unknown
      ) => Promise<CallToolResult>;

      const result = await handler(args, {});
      return result;
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
}
