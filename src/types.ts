import type { z } from 'zod';

/** Handler function that executes a tool */
export type ToolHandler<T = Record<string, unknown>> = (args: T) => Promise<unknown>;

/** Configuration when registering a tool */
export interface ToolConfig<TInput extends z.ZodRawShape = z.ZodRawShape> {
  description: string;
  input: TInput;
}

/** Internal representation of a registered tool */
export interface InternalTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: ToolHandler<unknown>;
}

/** Tool info returned by the search tool */
export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Options when creating a LiteMCP instance */
export interface LiteMCPOptions {
  version?: string;
}
