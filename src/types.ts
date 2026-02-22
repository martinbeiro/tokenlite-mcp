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

/** LiteMCP server options */
export interface LiteMCPOptions extends ServerOptions {
  /**
   * Enable lite mode (search + execute) by default.
   * Clients can toggle this at runtime via the set_mode tool.
   * @default true
   */
  liteMode?: boolean;
}

/** Token usage statistics for comparing traditional MCP vs LiteMCP */
export interface TokenStats {
  /** Number of registered tools */
  toolCount: number;
  /** Traditional MCP approach (all tools in tools/list) */
  traditional: {
    tokens: number;
    characters: number;
  };
  /** LiteMCP approach (search + execute only) */
  liteMcp: {
    /** Base tokens for search + execute tools */
    baseTokens: number;
    baseCharacters: number;
    /** Average tokens for a search result (3 tools) */
    avgSearchTokens: number;
  };
  /** Percentage savings in base context */
  savingsPercent: number;
}
