/**
 * Facebook OAuth Service
 * - GET /fb/auth          → redirect to Facebook login
 * - GET /fb/callback      → handle Facebook redirect, save page tokens
 * - GET /fb/status        → list connected accounts
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APP_ID     = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://vbpagent.com/fb/callback';
const PORT = parseInt(process.env.PORT || '9878');
const DATA_DIR = process.env.XDG_DATA_HOME || '/data';
const CREDS_DIR = join(DATA_DIR, 'facebook', 'credentials');

const FB_AUTH_URL  = 'https://www.facebook.com/v19.0/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
const FB_API       = 'https://graph.facebook.com/v19.0';

const SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_show_list',
  'public_profile',
].join(',');

// In-memory state store (CSRF protection + agent_id)
const stateStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [s, data] of stateStore) {
    if (now - data.timestamp > 30 * 60 * 1000) stateStore.delete(s);
  }
}, 60_000);

// Assignment file path
const ASSIGNMENTS_FILE = join(DATA_DIR, 'facebook', 'assignments.json');

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureDirs() {
  mkdirSync(CREDS_DIR, { recursive: true });
}

async function fbFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
  return data;
}

async function getLongLivedToken(shortToken) {
  const url = `${FB_TOKEN_URL}?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  return fbFetch(url);
}

async function getPageTokens(longLivedToken) {
  const url = `${FB_API}/me/accounts?access_token=${longLivedToken}&fields=id,name,category,access_token,tasks`;
  return fbFetch(url);
}

async function getUserInfo(token) {
  const url = `${FB_API}/me?access_token=${token}&fields=id,name,email`;
  return fbFetch(url);
}

function savePageCredential(page, userEmail) {
  ensureDirs();
  const filePath = join(CREDS_DIR, `page_${page.id}.json`);
  writeFileSync(filePath, JSON.stringify({
    page_id:      page.id,
    page_name:    page.name,
    category:     page.category || '',
    access_token: page.access_token,
    connected_by: userEmail,
    connected_at: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
}

function loadAllPages() {
  if (!existsSync(CREDS_DIR)) return [];
  try {
    return readdirSync(CREDS_DIR)
      .filter(f => f.startsWith('page_') && f.endsWith('.json'))
      .map(f => {
        try {
          const d = JSON.parse(readFileSync(join(CREDS_DIR, f), 'utf8'));
          return { page_id: d.page_id, page_name: d.page_name, category: d.category, connected_by: d.connected_by, connected_at: d.connected_at };
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function loadAssignments() {
  if (!existsSync(ASSIGNMENTS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(ASSIGNMENTS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveAssignments(assignments) {
  ensureDirs();
  writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(assignments, null, 2), { mode: 0o600 });
}

function getPageCredentials(pageId) {
  const filePath = join(CREDS_DIR, `page_${pageId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

// ── HTML pages ─────────────────────────────────────────────────────────────

function htmlPage({ icon, title, subtitle, body = '', hint = '', link }) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #f0f2f5; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 24px; color: #1c1e21; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 2px 20px rgba(0,0,0,0.1);
            padding: 48px 40px; max-width: 460px; width: 100%; text-align: center; }
    .icon { font-size: 52px; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
    .subtitle { font-size: 15px; color: #65676b; line-height: 1.6; }
    .badge { display: inline-flex; align-items: center; gap: 8px; background: #e7f3ff;
             color: #1877f2; font-weight: 500; padding: 6px 16px; border-radius: 20px;
             font-size: 14px; margin: 12px 0 4px; }
    .pages { margin-top: 16px; text-align: left; }
    .page-item { background: #f0f2f5; border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; }
    .page-name { font-weight: 600; font-size: 15px; }
    .page-meta { font-size: 12px; color: #65676b; margin-top: 2px; }
    .hint { font-size: 13px; color: #bbb; margin-top: 20px; }
    .error-box { background: #fff0f0; border: 1px solid #ffc0c0; border-radius: 10px;
                 padding: 14px 18px; font-size: 13px; color: #c00; text-align: left; margin: 16px 0; word-break: break-word; }
    a.btn { display: inline-block; margin-top: 20px; padding: 10px 28px; background: #1877f2;
            color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px;
            font-weight: 600; transition: background 0.15s; }
    a.btn:hover { background: #166fe5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    ${body}
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    ${link ? `<a href="${link.href}" class="btn">${link.label}</a>` : ''}
  </div>
</body>
</html>`;
}

// ── HTTP Server ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ── GET /fb/auth → redirect to Facebook ──────────────────────────────────
  if (url.pathname === '/fb/auth' || url.pathname === '/fb') {
    if (!APP_ID || !APP_SECRET) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({ icon: '⚙️', title: 'Chưa cấu hình', subtitle: 'FACEBOOK_APP_ID và FACEBOOK_APP_SECRET chưa được thiết lập.' }));
      return;
    }
    const state = randomBytes(16).toString('hex');
    const agentId = url.searchParams.get('agent_id');
    stateStore.set(state, { timestamp: Date.now(), agent_id: agentId });
    const authUrl = new URL(FB_AUTH_URL);
    authUrl.searchParams.set('client_id', APP_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
    console.log('[fb-oauth] Auth flow started', agentId ? `for agent ${agentId}` : '');
    return;
  }

  // ── GET /fb/callback → handle Facebook redirect ───────────────────────────
  if (url.pathname === '/fb/callback') {
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description') || error;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({ icon: '❌', title: 'Xác thực thất bại', subtitle: 'Facebook từ chối yêu cầu.',
        body: `<div class="error-box">${errorDesc}</div>`, link: { href: '/fb/auth', label: 'Thử lại' } }));
      return;
    }

    if (!code || !state || !stateStore.has(state)) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({ icon: '⚠️', title: 'Yêu cầu không hợp lệ', subtitle: 'State không khớp hoặc đã hết hạn.',
        link: { href: '/fb/auth', label: 'Thử lại' } }));
      return;
    }
    const stateData = stateStore.get(state);
    const agentId = stateData.agent_id;
    console.log('[fb-oauth] Callback received, agentId from state:', agentId);
    stateStore.delete(state);

    try {
      // 1. Exchange code → short-lived user token
      const tokenData = await fbFetch(
        `${FB_TOKEN_URL}?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${code}`
      );

      // 2. Exchange → long-lived user token (valid 60 days)
      const longToken = await getLongLivedToken(tokenData.access_token);

      // 3. Get user info
      const user = await getUserInfo(longToken.access_token);

      // 4. Get all managed pages (page tokens never expire)
      const pagesData = await getPageTokens(longToken.access_token);
      const pages = pagesData.data || [];

      if (pages.length === 0) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlPage({
          icon: '⚠️',
          title: 'Không tìm thấy Page',
          subtitle: `Tài khoản <strong>${user.name}</strong> không quản lý Facebook Page nào.`,
          hint: 'Bạn cần là Admin của ít nhất một Facebook Page.',
          link: { href: '/fb/auth', label: 'Thử lại' },
        }));
        return;
      }

      // 5. Save page credentials
      pages.forEach(p => savePageCredential(p, user.email || user.name));
      console.log(`[fb-oauth] Saved ${pages.length} page(s) for ${user.email || user.name}`);

      // 6. Auto-assign all pages to agent if agent_id provided
      console.log('[fb-oauth] Checking auto-assign condition:', { agentId, pagesLength: pages.length });
      if (agentId && pages.length > 0) {
        const assignments = loadAssignments();
        assignments[agentId] = {
          user_id: user.id,
          user_name: user.name,
          user_email: user.email || '',
          pages: pages.map(p => ({
            page_id: p.id,
            page_name: p.name,
            category: p.category || '',
          })),
          assigned_at: new Date().toISOString(),
        };
        saveAssignments(assignments);
        console.log(`[fb-oauth] Auto-assigned ${pages.length} page(s) to agent ${agentId}`);
      } else {
        console.log('[fb-oauth] Skipping auto-assign:', agentId ? 'no pages' : 'no agentId');
      }

      const pagesHtml = pages.map(p => `
        <div class="page-item">
          <div class="page-name">${p.name}</div>
          <div class="page-meta">ID: ${p.id}${p.category ? ` · ${p.category}` : ''}</div>
        </div>`).join('');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({
        icon: '✅',
        title: 'Kết nối thành công!',
        subtitle: `Đã lưu token cho <strong>${pages.length}</strong> Facebook Page.`,
        body: `<div class="badge">👤 ${user.name}${user.email ? ' · ' + user.email : ''}</div><div class="pages">${pagesHtml}</div>`,
        hint: agentId ? 'Vui lòng quay lại trang Agent và F5 để xem kết nối.' : 'Bạn có thể đóng tab này.',
      }));
    } catch (err) {
      console.error('[fb-oauth] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({ icon: '🔧', title: 'Đã xảy ra lỗi', subtitle: 'Không thể hoàn tất xác thực.',
        body: `<div class="error-box">${err.message}</div>`, link: { href: '/fb/auth', label: 'Thử lại' } }));
    }
    return;
  }

  // ── GET /fb/status → list connected pages ────────────────────────────────
  if (url.pathname === '/fb/status') {
    const pages = [];
    if (existsSync(CREDS_DIR)) {
      for (const f of readdirSync(CREDS_DIR).filter(f => f.startsWith('page_'))) {
        try {
          const d = JSON.parse(readFileSync(join(CREDS_DIR, f), 'utf8'));
          pages.push({ page_id: d.page_id, page_name: d.page_name, category: d.category, connected_by: d.connected_by, connected_at: d.connected_at });
        } catch {}
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pages }, null, 2));
    return;
  }

  // ── GET /fb/pages/:page_id → get page credentials ────────────────────────
  const pageMatch = url.pathname.match(/^\/fb\/pages\/([^/]+)$/);
  if (pageMatch && req.method === 'GET') {
    const pageId = pageMatch[1];
    const creds = getPageCredentials(pageId);
    if (!creds) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Page not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(creds));
    return;
  }

  // ── GET /fb/agent/:agent_id → get assigned pages for agent ───────────────
  const agentMatch = url.pathname.match(/^\/fb\/agent\/([^/]+)$/);
  if (agentMatch && req.method === 'GET') {
    const agentId = agentMatch[1];
    console.log(`[fb-oauth] GET /fb/agent/${agentId}`);
    const assignments = loadAssignments();
    const assignment = assignments[agentId];
    if (!assignment) {
      console.log(`[fb-oauth] No assignment found for agent ${agentId}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assigned: false }));
      return;
    }
    console.log(`[fb-oauth] Returning ${assignment.pages.length} pages for agent ${agentId}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      assigned: true,
      user_id: assignment.user_id,
      user_name: assignment.user_name,
      user_email: assignment.user_email,
      pages: assignment.pages,
      assigned_at: assignment.assigned_at,
    }));
    return;
  }


  // ── DELETE /fb/assign/:agent_id → unassign page from agent ───────────────
  const unassignMatch = url.pathname.match(/^\/fb\/assign\/([^/]+)$/);
  if (unassignMatch && req.method === 'DELETE') {
    const agentId = unassignMatch[1];
    const assignments = loadAssignments();
    delete assignments[agentId];
    saveAssignments(assignments);
    console.log(`[fb-oauth] Unassigned agent ${agentId}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[fb-oauth] Running on port ${PORT}`);
  console.log(`[fb-oauth] Auth URL: https://vbpagent.com/fb/auth`);
  console.log(`[fb-oauth] App ID: ${APP_ID || '(not set)'}`);
});
