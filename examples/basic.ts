/**
 * LiteMCP Example - Simulated API Server
 *
 * This example registers 10 tools to simulate a real API.
 * Clients will only see `search` and `execute` tools.
 *
 * Run with: bun run example
 * Test with: bun run inspector
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LiteMCP } from '../src/index.js';

const server = new LiteMCP({ name: 'api-server', version: '1.0.0' });

// User Management
server.registerTool(
  'create_user',
  {
    description: 'Create a new user account',
    inputSchema: {
      email: z.string().email().describe('User email address'),
      name: z.string().describe('Full name'),
      role: z.enum(['admin', 'user', 'guest']).default('user').describe('User role'),
    },
  },
  async ({ email, name, role }) => ({
    content: [{ type: 'text', text: JSON.stringify({ id: 'usr_' + Math.random().toString(36).slice(2, 10), email, name, role, createdAt: new Date().toISOString() }) }],
  })
);

server.registerTool(
  'get_user',
  {
    description: 'Get user details by ID',
    inputSchema: {
      userId: z.string().describe('User ID'),
    },
  },
  async ({ userId }) => ({
    content: [{ type: 'text', text: JSON.stringify({ id: userId, email: 'user@example.com', name: 'John Doe', role: 'user', createdAt: '2024-01-15T10:30:00Z' }) }],
  })
);

server.registerTool(
  'list_users',
  {
    description: 'List all users with optional filtering',
    inputSchema: {
      role: z.enum(['admin', 'user', 'guest']).optional().describe('Filter by role'),
      limit: z.number().default(10).describe('Max results'),
    },
  },
  async ({ role, limit }) => ({
    content: [{ type: 'text', text: JSON.stringify({ users: [{ id: 'usr_1', name: 'Alice' }, { id: 'usr_2', name: 'Bob' }], total: 2, limit }) }],
  })
);

server.registerTool(
  'delete_user',
  {
    description: 'Delete a user account',
    inputSchema: {
      userId: z.string().describe('User ID to delete'),
    },
  },
  async ({ userId }) => ({
    content: [{ type: 'text', text: JSON.stringify({ success: true, deletedId: userId }) }],
  })
);

// Content Management
server.registerTool(
  'create_post',
  {
    description: 'Create a new blog post',
    inputSchema: {
      title: z.string().describe('Post title'),
      content: z.string().describe('Post content in markdown'),
      tags: z.array(z.string()).optional().describe('Post tags'),
      published: z.boolean().default(false).describe('Publish immediately'),
    },
  },
  async ({ title, content, tags, published }) => ({
    content: [{ type: 'text', text: JSON.stringify({ id: 'post_' + Math.random().toString(36).slice(2, 10), title, tags, published, createdAt: new Date().toISOString() }) }],
  })
);

server.registerTool(
  'search_posts',
  {
    description: 'Search blog posts by keyword',
    inputSchema: {
      query: z.string().describe('Search query'),
      limit: z.number().default(10).describe('Max results'),
    },
  },
  async ({ query, limit }) => ({
    content: [{ type: 'text', text: JSON.stringify({ results: [{ id: 'post_1', title: `Post about ${query}`, score: 0.95 }], total: 1 }) }],
  })
);

// Analytics
server.registerTool(
  'get_analytics',
  {
    description: 'Get website analytics for a date range',
    inputSchema: {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      metrics: z.array(z.enum(['pageviews', 'visitors', 'bounceRate'])).describe('Metrics to include'),
    },
  },
  async ({ startDate, endDate, metrics }) => ({
    content: [{ type: 'text', text: JSON.stringify({ startDate, endDate, data: { pageviews: 15420, visitors: 3200, bounceRate: 0.42 } }) }],
  })
);

// Notifications
server.registerTool(
  'send_email',
  {
    description: 'Send an email notification',
    inputSchema: {
      to: z.string().email().describe('Recipient email'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body (HTML supported)'),
    },
  },
  async ({ to, subject }) => ({
    content: [{ type: 'text', text: JSON.stringify({ messageId: 'msg_' + Math.random().toString(36).slice(2, 10), to, subject, status: 'sent' }) }],
  })
);

server.registerTool(
  'send_sms',
  {
    description: 'Send an SMS notification',
    inputSchema: {
      phone: z.string().describe('Phone number with country code'),
      message: z.string().max(160).describe('SMS message (max 160 chars)'),
    },
  },
  async ({ phone, message }) => ({
    content: [{ type: 'text', text: JSON.stringify({ messageId: 'sms_' + Math.random().toString(36).slice(2, 10), phone, status: 'delivered' }) }],
  })
);

// System
server.registerTool(
  'health_check',
  {
    description: 'Check system health and status',
    inputSchema: {},
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify({ status: 'healthy', uptime: '14d 3h 22m', version: '1.0.0', services: { database: 'up', cache: 'up', queue: 'up' } }) }],
  })
);

// Connect
const transport = new StdioServerTransport();
await server.connect(transport);
