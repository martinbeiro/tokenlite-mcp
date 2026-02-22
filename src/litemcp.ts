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

export class LiteMCP extends McpServer {
  constructor(serverInfo: Implementation, options?: ServerOptions) {
    super(serverInfo, options);
  }

  override async connect(transport: Transport): Promise<void> {
    // Access private _registeredTools via any cast
    const registeredTools = (this as unknown as { _registeredTools: Record<string, RegisteredTool> })
      ._registeredTools;

    // Build search and execute tool definitions
    const searchTool: Tool = {
      name: 'search',
      description: 'Search available tools. Returns tool names, descriptions, and input schemas.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional filter by name or description',
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

    // Override tools/list to only expose search + execute
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: [searchTool, executeTool] };
    });

    // Override tools/call to route through search/execute
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      if (name === 'search') {
        return this.handleSearch(registeredTools, args['query'] as string | undefined);
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
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
    });

    await super.connect(transport);
  }

  private handleSearch(
    registeredTools: Record<string, RegisteredTool>,
    query?: string
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

    const filtered = query
      ? tools.filter(
          (t) =>
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            (t.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
        )
      : tools;

    return {
      content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
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
