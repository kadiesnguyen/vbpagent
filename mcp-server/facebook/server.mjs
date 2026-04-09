/**
 * Facebook MCP Server — Graph API tools for Facebook Pages
 * Tools: fb_list_pages, fb_post, fb_get_posts, fb_get_comments,
 *        fb_reply_comment, fb_delete_post, fb_get_insights
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = process.env.XDG_DATA_HOME || '/data';
const CREDS_DIR = join(DATA_DIR, 'facebook', 'credentials');
const FB_API = 'https://graph.facebook.com/v19.0';

// ── Credential helpers ─────────────────────────────────────────────────────

function loadPageToken(pageId) {
  const path = join(CREDS_DIR, `page_${pageId}.json`);
  if (!existsSync(path)) throw new Error(`Page ${pageId} not connected. Use fb_list_pages to see available pages.`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadAllPages() {
  if (!existsSync(CREDS_DIR)) return [];
  return readdirSync(CREDS_DIR)
    .filter(f => f.startsWith('page_') && f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(CREDS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

// ── Graph API helper ───────────────────────────────────────────────────────

async function graph(path, method = 'GET', params = {}, token) {
  const url = new URL(`${FB_API}${path}`);
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'facebook-mcp/1.0' },
  };
  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  } else {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(params);
  }
  const res = await fetch(url.toString(), opts);
  const data = await res.json();
  if (data.error) throw new Error(`Graph API: [${data.error.code}] ${data.error.message}`);
  return data;
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'facebook-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fb_list_pages',
      description: 'List all connected Facebook Pages with their IDs and names.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'fb_post',
      description: 'Create a post on a Facebook Page. Can post text, link preview, or schedule for later.',
      inputSchema: {
        type: 'object',
        required: ['page_id', 'message'],
        properties: {
          page_id: { type: 'string', description: 'Facebook Page ID (from fb_list_pages)' },
          message: { type: 'string', description: 'Post text content' },
          link: { type: 'string', description: 'Optional URL — generates a link preview card' },
          scheduled_unix: { type: 'number', description: 'Optional: Unix timestamp (10 min–30 days ahead) to schedule post' },
        },
      },
    },
    {
      name: 'fb_get_posts',
      description: 'Get recent posts from a Facebook Page.',
      inputSchema: {
        type: 'object',
        required: ['page_id'],
        properties: {
          page_id: { type: 'string' },
          limit: { type: 'number', description: 'Number of posts to return (default 10, max 100)', default: 10 },
        },
      },
    },
    {
      name: 'fb_get_comments',
      description: 'Get comments on a specific post.',
      inputSchema: {
        type: 'object',
        required: ['post_id'],
        properties: {
          post_id: { type: 'string', description: 'Post ID in format pageId_postId' },
          limit: { type: 'number', default: 25 },
        },
      },
    },
    {
      name: 'fb_reply_comment',
      description: 'Reply to a comment on a post.',
      inputSchema: {
        type: 'object',
        required: ['comment_id', 'page_id', 'message'],
        properties: {
          comment_id: { type: 'string', description: 'Comment ID to reply to' },
          page_id: { type: 'string', description: 'Page ID (required for auth)' },
          message: { type: 'string', description: 'Reply content' },
        },
      },
    },
    {
      name: 'fb_delete_post',
      description: 'Delete a post from a Facebook Page.',
      inputSchema: {
        type: 'object',
        required: ['post_id', 'page_id'],
        properties: {
          post_id: { type: 'string' },
          page_id: { type: 'string' },
        },
      },
    },
    {
      name: 'fb_get_insights',
      description: 'Get performance statistics for a Facebook Page (reach, engagement, fans, etc.).',
      inputSchema: {
        type: 'object',
        required: ['page_id'],
        properties: {
          page_id: { type: 'string' },
          metric: {
            type: 'string',
            description: 'Comma-separated metrics',
            default: 'page_impressions,page_engaged_users,page_fans,page_fan_adds',
          },
          period: {
            type: 'string',
            enum: ['day', 'week', 'days_28', 'month'],
            default: 'week',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {

      case 'fb_list_pages': {
        const pages = loadAllPages();
        if (pages.length === 0) {
          return { content: [{ type: 'text', text: 'No Facebook Pages connected yet.\nAsk the user to visit https://vbpagent.com/fb/auth to connect their Facebook account.' }] };
        }
        const list = pages.map(p => `• ${p.page_name} (ID: ${p.page_id})${p.category ? ` — ${p.category}` : ''}`).join('\n');
        return { content: [{ type: 'text', text: `Connected pages:\n${list}` }] };
      }

      case 'fb_post': {
        const { page_id, message, link, scheduled_unix } = args;
        const cred = loadPageToken(page_id);
        const params = { message };
        if (link) params.link = link;
        if (scheduled_unix) {
          params.scheduled_publish_time = scheduled_unix;
          params.published = false;
        }
        const result = await graph(`/${page_id}/feed`, 'POST', params, cred.access_token);
        return { content: [{ type: 'text', text: `Post published. ID: ${result.id}` }] };
      }

      case 'fb_get_posts': {
        const { page_id, limit = 10 } = args;
        const cred = loadPageToken(page_id);
        const result = await graph(`/${page_id}/posts`, 'GET', {
          fields: 'id,message,story,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true)',
          limit: Math.min(limit, 100),
        }, cred.access_token);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }

      case 'fb_get_comments': {
        const { post_id, limit = 25 } = args;
        const pageId = post_id.split('_')[0];
        const cred = loadPageToken(pageId);
        const result = await graph(`/${post_id}/comments`, 'GET', {
          fields: 'id,message,from,created_time,like_count,user_likes',
          limit,
        }, cred.access_token);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }

      case 'fb_reply_comment': {
        const { comment_id, page_id, message } = args;
        const cred = loadPageToken(page_id);
        const result = await graph(`/${comment_id}/comments`, 'POST', { message }, cred.access_token);
        return { content: [{ type: 'text', text: `Reply posted. ID: ${result.id}` }] };
      }

      case 'fb_delete_post': {
        const { post_id, page_id } = args;
        const cred = loadPageToken(page_id);
        await graph(`/${post_id}`, 'DELETE', {}, cred.access_token);
        return { content: [{ type: 'text', text: `Post ${post_id} deleted.` }] };
      }

      case 'fb_get_insights': {
        const { page_id, metric = 'page_impressions,page_engaged_users,page_fans,page_fan_adds', period = 'week' } = args;
        const cred = loadPageToken(page_id);
        const result = await graph(`/${page_id}/insights`, 'GET', { metric, period }, cred.access_token);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
