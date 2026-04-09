/**
 * Persistent Google OAuth callback service
 * - GET  /auth        → redirect to Google OAuth (generates fresh state each time)
 * - GET  /oauth/callback → handle Google redirect, save credentials
 * - GET  /status      → list authenticated accounts
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://vbpagent.com/oauth/callback';
const PORT = parseInt(process.env.PORT || '9876');
const XDG_DATA_HOME = process.env.XDG_DATA_HOME || '/data/share';
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || '/data/config';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
];

// In-memory state store (state → timestamp)
const stateStore = new Map();

// Clean expired states every minute
setInterval(() => {
  const now = Date.now();
  for (const [state, ts] of stateStore) {
    if (now - ts > 30 * 60 * 1000) stateStore.delete(state); // 30 min expiry
  }
}, 60_000);

function generateAuthUrl() {
  const state = randomBytes(16).toString('hex');
  stateStore.set(state, Date.now());
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function getAccounts() {
  const accountsFile = `${XDG_CONFIG_HOME}/google-workspace-mcp/accounts.json`;
  if (!existsSync(accountsFile)) return [];
  try {
    return JSON.parse(readFileSync(accountsFile, 'utf8')).accounts || [];
  } catch { return []; }
}

function saveCredentials(email, tokenData) {
  const credDir = `${XDG_DATA_HOME}/google-workspace-mcp/credentials`;
  const cfgDir = `${XDG_CONFIG_HOME}/google-workspace-mcp`;
  mkdirSync(credDir, { recursive: true });
  mkdirSync(cfgDir, { recursive: true });

  const slug = email.replace('@', '_at_').replace(/\./g, '_dot_');
  writeFileSync(`${credDir}/${slug}.json`, JSON.stringify({
    type: 'authorized_user',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokenData.refresh_token,
    scopes: SCOPES,
  }, null, 2), { mode: 0o600 });

  const accountsFile = `${cfgDir}/accounts.json`;
  const accounts = getAccounts();
  if (!accounts.find(a => a.email === email)) {
    accounts.push({ email, category: 'personal', description: '' });
  }
  writeFileSync(accountsFile, JSON.stringify({ accounts }, null, 2));
  console.log(`[oauth] Saved credentials for ${email}`);
}

function htmlPage({ icon, title, subtitle, body, hint, link }) {
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
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #111;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 48px 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
    .subtitle { font-size: 15px; color: #555; margin-bottom: 8px; line-height: 1.6; }
    .email {
      display: inline-block;
      background: #f0f4ff;
      color: #3b5bdb;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      margin: 8px 0 16px;
    }
    .hint { font-size: 13px; color: #999; margin-top: 16px; }
    .error-box {
      background: #fff5f5;
      border: 1px solid #ffc9c9;
      border-radius: 10px;
      padding: 14px 18px;
      font-size: 13px;
      color: #c92a2a;
      text-align: left;
      margin: 16px 0;
      word-break: break-word;
    }
    a.btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 24px;
      background: #3b5bdb;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.15s;
    }
    a.btn:hover { background: #2f4ac0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    ${body || ''}
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    ${link ? `<a href="${link.href}" class="btn">${link.label}</a>` : ''}
  </div>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // GET /auth → redirect to Google
  if (url.pathname === '/auth' || url.pathname === '/') {
    const authUrl = generateAuthUrl();
    res.writeHead(302, { Location: authUrl });
    res.end();
    console.log(`[oauth] New auth flow started`);
    return;
  }

  // GET /status → list accounts
  if (url.pathname === '/status') {
    const accounts = getAccounts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ accounts }, null, 2));
    return;
  }

  // GET /oauth/callback → handle Google redirect
  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({
        icon: '❌',
        title: 'Xác thực thất bại',
        subtitle: 'Google đã từ chối yêu cầu xác thực.',
        body: `<div class="error-box">${error}</div>`,
        link: { href: '/auth', label: 'Thử lại' },
      }));
      return;
    }

    if (!code || !state || !stateStore.has(state)) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({
        icon: '⚠️',
        title: 'Yêu cầu không hợp lệ',
        subtitle: 'State không khớp hoặc thiếu mã xác thực. Vui lòng thử lại.',
        link: { href: '/auth', label: 'Thử lại' },
      }));
      return;
    }

    stateStore.delete(state);

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.refresh_token) {
        throw new Error('No refresh_token returned. Try revoking access at https://myaccount.google.com/permissions and retry.');
      }

      // Get email
      const userRes = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      const userInfo = await userRes.json();
      const email = userInfo.email;

      saveCredentials(email, tokenData);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({
        icon: '✅',
        title: 'Xác thực thành công!',
        subtitle: 'Tài khoản đã được kết nối với hệ thống.',
        body: `<div class="email">${email}</div>`,
        hint: 'Bạn có thể đóng tab này.',
      }));
    } catch (err) {
      console.error('[oauth] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage({
        icon: '🔧',
        title: 'Đã xảy ra lỗi',
        subtitle: 'Không thể hoàn tất xác thực. Vui lòng thử lại.',
        body: `<div class="error-box">${err.message}</div>`,
        link: { href: '/auth', label: 'Thử lại' },
      }));
    }
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[oauth] Service running on port ${PORT}`);
  console.log(`[oauth] Auth URL: ${REDIRECT_URI.replace('/oauth/callback', '/auth')}`);
  console.log(`[oauth] Callback: ${REDIRECT_URI}`);
});
