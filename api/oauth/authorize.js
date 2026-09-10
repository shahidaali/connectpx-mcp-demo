import { cors, authenticateUser, createAuthCode, getAppSession } from '../../lib/store.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET')  return showForm(req, res);
  if (req.method === 'POST') return processForm(req, res);
  return res.status(405).end();
}

// ── GET: show login + consent ─────────────────────────────────────────

async function showForm(req, res) {
  const p = req.query;

  // Validate required OAuth params
  if (!p.client_id)    return res.status(400).send(errorPage('Missing client_id'));
  if (!p.redirect_uri) return res.status(400).send(errorPage('Missing redirect_uri'));
  if (p.response_type !== 'code') return res.status(400).send(errorPage('response_type must be "code"'));
  if (!p.code_challenge) return res.status(400).send(errorPage('PKCE required: missing code_challenge'));
  if (p.code_challenge_method !== 'S256') return res.status(400).send(errorPage('code_challenge_method must be S256'));

  const clientName = deriveClientName(p.client_id, p.client_name);
  const scopes = (p.scope || 'mcp:read profile').split(' ').filter(Boolean);
  const scopeLabels = {
    'mcp:read':  'Read your orders, invoices & subscriptions',
    'mcp:write': 'Update data on your behalf',
    'profile':   'View your profile information',
  };
  const scopeHtml = scopes.map(s =>
    `<li><span class="check">✓</span>${scopeLabels[s] || esc(s)}</li>`
  ).join('');

  // Already logged into ConnectPX (simulates Laravel session)?
  const session = await getAppSession(req);
  const paramsEncoded = Buffer.from(JSON.stringify(p)).toString('base64');

  const accountBlock = session
    ? `<div class="session-box">
         <div class="session-label">Signed in as</div>
         <div class="session-name">${esc(session.name)}</div>
         <div class="session-sub">${esc(session.email)} · ${esc(session.plan)}</div>
       </div>`
    : `<label>Username</label>
       <input type="text" name="username" placeholder="your username" required autocomplete="username" value="${esc(p.login_hint || '')}">
       <label>Password</label>
       <input type="password" name="password" required autocomplete="current-password">
       <p class="err ${p._error ? 'visible' : ''}" id="errMsg">Invalid credentials. Try again.</p>`;

  const hint = session
    ? `<p class="hint">Approving links <strong>${esc(clientName)}</strong> to your existing ConnectPX account.</p>`
    : `<p class="hint">Demo credentials: ahmad / demo123 &nbsp;|&nbsp; sara / demo456</p>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize — ConnectPX</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
       background:#0f0f1a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#141428;border:1px solid #2d3055;border-radius:16px;
        padding:40px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.4)}
  .logo{font-size:20px;font-weight:700;color:#fff;margin-bottom:4px}
  .logo span{color:#818cf8}
  .sub{color:#64748b;font-size:13px;margin-bottom:28px}
  .client-box{background:#1a1a2e;border:1px solid #252545;border-radius:10px;padding:16px;margin-bottom:22px}
  .client-name{font-weight:700;font-size:15px;color:#e2e8f0}
  .client-sub{font-size:12px;color:#64748b;margin-top:3px}
  .resource{font-size:11px;color:#a78bfa;background:#1e1650;padding:2px 8px;border-radius:10px;display:inline-block;margin-top:8px;word-break:break-all}
  .session-box{background:#0f1f1a;border:1px solid #14532d;border-radius:10px;padding:14px 16px;margin-bottom:8px}
  .session-label{font-size:11px;color:#4ade80;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
  .session-name{font-size:15px;font-weight:700;color:#e2e8f0;margin-top:4px}
  .session-sub{font-size:12px;color:#64748b;margin-top:3px}
  ul.scopes{list-style:none;margin:0 0 24px;padding:0}
  ul.scopes li{display:flex;align-items:center;gap:10px;font-size:13px;color:#cbd5e1;padding:6px 0;border-bottom:1px solid #1e2035}
  ul.scopes li:last-child{border:none}
  .check{color:#10b981;font-weight:bold;font-size:15px}
  label{display:block;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:5px;margin-top:14px}
  input[type=text],input[type=password]{width:100%;padding:10px 13px;background:#0f0f1a;
    border:1px solid #2d3055;border-radius:8px;font-size:14px;color:#e2e8f0;outline:none}
  input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
  .err{color:#f87171;font-size:12px;margin-top:8px;display:none}
  .err.visible{display:block}
  .btns{display:flex;gap:10px;margin-top:24px}
  .btn{flex:1;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:.15s}
  .allow{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
  .allow:hover{opacity:.85}
  .deny{background:#1e2035;color:#94a3b8}
  .deny:hover{background:#252545}
  .hint{text-align:center;font-size:11px;color:#4b5563;margin-top:18px;line-height:1.5}
  .hint strong{color:#94a3b8}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Connect<span>PX</span></div>
  <div class="sub">AI Authorization Request</div>

  <div class="client-box">
    <div class="client-name">${esc(clientName)}</div>
    <div class="client-sub">is requesting access to your account</div>
    ${p.resource ? `<div class="resource">${esc(decodeURIComponent(p.resource))}</div>` : ''}
  </div>

  <ul class="scopes">${scopeHtml}</ul>

  <form method="POST">
    <input type="hidden" name="_params" value="${paramsEncoded}">
    ${accountBlock}
    <div class="btns">
      <button type="submit" name="action" value="approve" class="btn allow">✓ Allow Access</button>
      <button type="submit" name="action" value="deny"    class="btn deny">✗ Deny</button>
    </div>
  </form>
  ${hint}
</div>
</body>
</html>`);
}

// ── POST: validate login, issue auth code, redirect ───────────────────

async function processForm(req, res) {
  const body = await parseFormBody(req);

  let params;
  try {
    params = JSON.parse(Buffer.from(body._params, 'base64').toString());
  } catch {
    return res.status(400).send(errorPage('Invalid form state. Please try again.'));
  }

  if (body.action === 'deny') {
    return redirect(res, params.redirect_uri, { error: 'access_denied', state: params.state });
  }

  // Prefer existing app session (already logged into ConnectPX / Laravel).
  // Fall back to username/password on the consent form.
  let user = null;
  const session = await getAppSession(req);
  if (session) {
    user = { id: session.id, username: session.username, name: session.name, email: session.email, plan: session.plan };
  } else {
    user = authenticateUser(body.username?.trim(), body.password);
    if (!user) {
      const qs = new URLSearchParams({ ...params, _error: '1' }).toString();
      return res.redirect(302, `/oauth/authorize?${qs}`);
    }
  }

  // Auth code embeds user_id so the AI client token is bound to THIS user.
  const code = await createAuthCode({
    user_id:               user.id,
    username:              user.username,
    client_id:             params.client_id,
    redirect_uri:          params.redirect_uri,
    scope:                 params.scope || 'mcp:read profile',
    resource:              params.resource || null,
    code_challenge:        params.code_challenge,
    code_challenge_method: params.code_challenge_method,
  });

  redirect(res, params.redirect_uri, { code, state: params.state });
}

// ── Helpers ───────────────────────────────────────────────────────────

function deriveClientName(clientId, hint) {
  if (hint) return hint;
  if (clientId.startsWith('http')) {
    try { return new URL(clientId).hostname; } catch {}
  }
  if (clientId === 'connectpx-dashboard') return 'ConnectPX Demo';
  if (clientId.length < 40) return clientId;
  return 'AI Client';
}

function redirect(res, uri, params) {
  try {
    const u = new URL(uri);
    for (const [k, v] of Object.entries(params)) { if (v) u.searchParams.set(k, v); }
    res.redirect(302, u.toString());
  } catch {
    res.status(400).send(errorPage('Invalid redirect_uri'));
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function parseFormBody(req) {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length) {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return {};
}

function errorPage(msg) {
  return `<!DOCTYPE html><html><body style="font:16px sans-serif;padding:40px;background:#0f0f1a;color:#e2e8f0">
    <h2 style="color:#f87171">Authorization Error</h2>
    <p style="margin-top:12px;color:#94a3b8">${esc(msg)}</p>
    <p style="margin-top:20px"><a href="/" style="color:#818cf8">← Back to dashboard</a></p>
  </body></html>`;
}
