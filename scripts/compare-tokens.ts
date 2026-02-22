#!/usr/bin/env bun
/**
 * Token Comparison CLI
 *
 * Compares token usage between traditional MCP (all tools exposed)
 * and LiteMCP (search + execute only).
 *
 * Run with: bun run scripts/compare-tokens.ts
 */

import { z } from 'zod';
import { LiteMCP } from '../src/index.js';

// Create server with same tools as basic example
const server = new LiteMCP({ name: 'api-server', version: '1.0.0' });

// Register all 10 tools from the example
server.registerTool('create_user', {
  description: 'Create a new user account',
  inputSchema: {
    email: z.string().email().describe('User email address'),
    name: z.string().describe('Full name'),
    role: z.enum(['admin', 'user', 'guest']).default('user').describe('User role'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('get_user', {
  description: 'Get user details by ID',
  inputSchema: { userId: z.string().describe('User ID') },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('list_users', {
  description: 'List all users with optional filtering',
  inputSchema: {
    role: z.enum(['admin', 'user', 'guest']).optional().describe('Filter by role'),
    limit: z.number().default(10).describe('Max results'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('delete_user', {
  description: 'Delete a user account',
  inputSchema: { userId: z.string().describe('User ID to delete') },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('create_post', {
  description: 'Create a new blog post',
  inputSchema: {
    title: z.string().describe('Post title'),
    content: z.string().describe('Post content in markdown'),
    tags: z.array(z.string()).optional().describe('Post tags'),
    published: z.boolean().default(false).describe('Publish immediately'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('search_posts', {
  description: 'Search blog posts by keyword',
  inputSchema: {
    query: z.string().describe('Search query'),
    limit: z.number().default(10).describe('Max results'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('get_analytics', {
  description: 'Get website analytics for a date range',
  inputSchema: {
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    metrics: z.array(z.enum(['pageviews', 'visitors', 'bounceRate'])).describe('Metrics to include'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('send_email', {
  description: 'Send an email notification',
  inputSchema: {
    to: z.string().email().describe('Recipient email'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (HTML supported)'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('send_sms', {
  description: 'Send an SMS notification',
  inputSchema: {
    phone: z.string().describe('Phone number with country code'),
    message: z.string().max(160).describe('SMS message (max 160 chars)'),
  },
}, async () => ({ content: [{ type: 'text', text: '' }] }));

server.registerTool('health_check', {
  description: 'Check system health and status',
  inputSchema: {},
}, async () => ({ content: [{ type: 'text', text: '' }] }));

// Get stats and print comparison
const stats = server.getTokenStats();

console.log('\n┌─────────────────────────────────────────────────────────────┐');
console.log('│               LiteMCP Token Comparison                      │');
console.log('└─────────────────────────────────────────────────────────────┘\n');

console.log(`  Registered tools: ${stats.toolCount}\n`);

console.log('  ┌─────────────────┬─────────────┬──────────────┐');
console.log('  │ Approach        │ Tokens      │ Characters   │');
console.log('  ├─────────────────┼─────────────┼──────────────┤');
console.log(`  │ Traditional MCP │ ${String(stats.traditional.tokens).padStart(11)} │ ${String(stats.traditional.characters).padStart(12)} │`);
console.log(`  │ LiteMCP (base)  │ ${String(stats.liteMcp.baseTokens).padStart(11)} │ ${String(stats.liteMcp.baseCharacters).padStart(12)} │`);
console.log('  └─────────────────┴─────────────┴──────────────┘\n');

console.log(`  Base context savings: ${stats.savingsPercent}%\n`);

console.log('  Per-query costs:');
console.log(`  • Search (3 tools): ~${stats.liteMcp.avgSearchTokens} tokens`);
console.log(`  • Execute call: ~50 tokens (tool name + args)\n`);

const typicalSession = stats.liteMcp.baseTokens + stats.liteMcp.avgSearchTokens * 2;
console.log('  Typical session (2 searches + executions):');
console.log(`  • Traditional: ${stats.traditional.tokens} tokens (constant)`);
console.log(`  • LiteMCP: ~${typicalSession} tokens\n`);

const sessionSavings = Math.round((1 - typicalSession / stats.traditional.tokens) * 100);
console.log(`  Session savings: ${sessionSavings}%\n`);
