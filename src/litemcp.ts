import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  objectFromShape,
  safeParse,
  getParseErrorMessage,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import { z } from 'zod';

import type { ToolConfig, ToolHandler, InternalTool, LiteMCPOptions, ToolInfo } from './types.js';

export class LiteMCP {
  private readonly name: string;
  private readonly version: string;
  private readonly tools: Map<string, InternalTool> = new Map();
  private server: McpServer | null = null;

  constructor(name: string, options: LiteMCPOptions = {}) {
    this.name = name;
    this.version = options.version ?? '1.0.0';
  }

  /** Register a tool */
  tool<TInput extends z.ZodRawShape>(
    name: string,
    config: ToolConfig<TInput>,
    handler: ToolHandler<z.infer<z.ZodObject<TInput>>>
  ): this {
    this.tools.set(name, {
      name,
      description: config.description,
      inputSchema: config.input,
      handler: handler as ToolHandler<unknown>,
    });

    return this;
  }

  /** Convert internal tools to ToolInfo format for search results */
  private getToolInfos(query?: string): ToolInfo[] {
    const allTools = Array.from(this.tools.values());

    const filtered = query
      ? allTools.filter(
          (t) =>
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.description.toLowerCase().includes(query.toLowerCase())
        )
      : allTools;

    return filtered.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: toJsonSchemaCompat(objectFromShape(tool.inputSchema)),
    }));
  }

  /** Start the MCP server with stdio transport */
  async start(): Promise<void> {
    this.server = new McpServer({
      name: this.name,
      version: this.version,
    });

    // Register the `search` tool
    this.server.registerTool(
      'search',
      {
        description:
          'Search available tools. Returns tool names, descriptions, and input schemas.',
        inputSchema: {
          query: z.string().optional().describe('Filter tools by name or description'),
        },
      },
      async ({ query }) => {
        const tools = this.getToolInfos(query);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(tools, null, 2),
            },
          ],
        };
      }
    );

    // Register the `execute` tool
    this.server.registerTool(
      'execute',
      {
        description: 'Execute a tool by name with the provided arguments.',
        inputSchema: {
          tool: z.string().describe('Name of the tool to execute'),
          arguments: z
            .record(z.string(), z.unknown())
            .optional()
            .default({})
            .describe('Arguments to pass to the tool'),
        },
      },
      async ({ tool: toolName, arguments: args }) => {
        const tool = this.tools.get(toolName);

        if (!tool) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `Unknown tool: "${toolName}". Use the search tool to list available tools.`,
              },
            ],
          };
        }

        const schema = objectFromShape(tool.inputSchema);
        const parseResult = safeParse(schema, args);

        if (!parseResult.success) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `Invalid arguments: ${getParseErrorMessage(parseResult.error)}`,
              },
            ],
          };
        }

        try {
          const result = await tool.handler(parseResult.data);

          return {
            content: [
              {
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }
    );

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
