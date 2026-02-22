// Re-export SDK types for convenience
export type {
  CallToolResult,
  Tool,
  Implementation,
} from '@modelcontextprotocol/sdk/types.js';

export type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

export type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';

export type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';

/** TokenLite server options */
export interface TokenLiteOptions extends ServerOptions {
  /**
   * Enable lite mode (search + execute).
   * When false, behaves like standard McpServer (all tools exposed directly).
   * @default true
   */
  liteMode?: boolean;
}

/** Token usage statistics for comparing traditional MCP vs TokenLite */
export interface TokenStats {
  /** Number of registered tools */
  toolCount: number;
  /** Traditional MCP approach (all tools in tools/list) */
  traditional: {
    tokens: number;
    characters: number;
  };
  /** TokenLite approach (search + execute only) */
  tokenLite: {
    /** Base tokens for search + execute tools */
    baseTokens: number;
    baseCharacters: number;
    /** Average tokens for a search result (3 tools) */
    avgSearchTokens: number;
  };
  /** Percentage savings in base context */
  savingsPercent: number;
}
