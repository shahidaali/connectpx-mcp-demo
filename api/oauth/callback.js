import { cors, baseUrl } from '../../lib/store.js';

/**
 * OAuth redirect_uri for the dashboard demo.
 *
 * Real AI clients (Claude) exchange the code server-side themselves.
 * Here we finish the exchange in the browser with the PKCE verifier
 * from localStorage, then call MCP to prove tools are user-scoped.
 */
export default async function handler(req, res) {
  cors(res);

  const { code, state, error, error_description } = req.query;
  const base = baseUrl(req);

  if (error) {
    return res.status(200).send(page('Authorization Denied', `
      <div class="status error">
        <div class="icon">✗</div>
        <h2>Access Denied</h2>
        <p>${esc(error_description || error)}</p>
      </div>
      <a href="/" class="btn-back">← Back to Dashboard</a>
    `, ''));
  }

  if (!code) {
    return res.status(400).send(page('Error', `
      <div class="status error"><div class="icon">!</div><h2>Missing Code</h2><p>No authorization code received.</p></div>
      <a href="/" class="btn-back">← Back to Dashboard</a>
    `, ''));
  }

  // Shell page — JS completes token exchange + MCP proof
  return res.status(200).send(page('Connecting…', `
    <div class="status pending" id="statusBox">
      <div class="icon" id="statusIcon">⟳</div>
      <h2 id="statusTitle">Completing authorization…</h2>
      <p id="statusDesc">Exchanging authorization code for an access token.</p>
    </div>

    <div class="flow-summary" id="flow" style="display:none"></div>
    <div id="blocks"></div>
    <div class="actions" id="actions" style="display:none">
      <a href="/" class="btn-back">← Back to Dashboard</a>
    </div>
  `, `
<script>
(async function () {
  const code  = ${JSON.stringify(code)};
  const state = ${JSON.stringify(state || '')};
  const base  = ${JSON.stringify(base)};

  const statusBox   = document.getElementById('statusBox');
  const statusIcon  = document.getElementById('statusIcon');
  const statusTitle = document.getElementById('statusTitle');
  const statusDesc  = document.getElementById('statusDesc');
  const flowEl      = document.getElementById('flow');
  const blocksEl    = document.getElementById('blocks');
  const actionsEl   = document.getElementById('actions');

  function fail(msg) {
    statusBox.className = 'status error';
    statusIcon.textContent = '✗';
    statusTitle.textContent = 'Authorization Failed';
    statusDesc.textContent = msg;
    actionsEl.style.display = 'flex';
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  const expectedState = localStorage.getItem('oauth_state');
  if (state && expectedState && state !== expectedState) {
    return fail('State mismatch — possible CSRF. Start Connect again from the dashboard.');
  }

  const verifier = localStorage.getItem('pkce_verifier');
  if (!verifier) {
    return fail('PKCE verifier missing. Open Connect from this site’s dashboard so the verifier is stored, then try again.');
  }

  const clientId = localStorage.getItem('oauth_client_id') || 'connectpx-dashboard';
  const redirectUri = base + '/oauth/callback';
  const resource = base + '/mcp';

  let tokenJson;
  try {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      code_verifier: verifier,
      resource,
    });
    const resp = await fetch(base + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    tokenJson = await resp.json();
    if (!resp.ok) {
      return fail(tokenJson.error_description || tokenJson.error || 'Token exchange failed');
    }
  } catch (e) {
    return fail('Token request failed: ' + e.message);
  }

  // Clean one-time PKCE material
  localStorage.removeItem('pkce_verifier');
  localStorage.removeItem('oauth_state');

  const access = tokenJson.access_token;
  let claims = {};
  try {
    const part = access.split('.')[1];
    claims = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
  } catch {}

  const username = claims.username || 'user';
  const userId   = claims.sub || '?';
  const scope    = tokenJson.scope || claims.scope || '';

  // Prove MCP tools are scoped to this user
  let profileText = '';
  let mcpOk = false;
  try {
    const init = await fetch(base + '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + access,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'ConnectPX Dashboard', version: '1.0' } },
      }),
    });
    const sessionId = init.headers.get('MCP-Session-Id');
    const initJson = await init.json();
    if (!init.ok || initJson.error) throw new Error(initJson.error?.message || 'initialize failed');

    const call = await fetch(base + '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + access,
        'Accept': 'application/json',
        ...(sessionId ? { 'MCP-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'get_my_profile', arguments: {} },
      }),
    });
    const callJson = await call.json();
    profileText = callJson.result?.content?.[0]?.text || JSON.stringify(callJson, null, 2);
    mcpOk = !callJson.error;
  } catch (e) {
    profileText = 'MCP call failed: ' + e.message;
  }

  statusBox.className = 'status success';
  statusIcon.textContent = '✓';
  statusTitle.textContent = 'Connected!';
  statusDesc.innerHTML = '<strong>' + esc(username) + '</strong> is linked to the AI client. MCP tools will return only this user’s data.';

  flowEl.style.display = 'flex';
  flowEl.innerHTML = [
    ['User authenticated', 'Logged in as <code>' + esc(username) + '</code> (user_id: ' + esc(userId) + ')'],
    ['AI client associated', 'client_id bound in access token'],
    ['Access token issued', 'Bearer JWT · ' + esc(scope)],
    ['MCP tools ready', mcpOk ? 'get_my_profile returned this user’s data' : 'Token issued; MCP probe had an issue'],
  ].map((row, i) => \`
    <div class="flow-step done">
      <span class="badge">\${i + 1}</span>
      <div><strong>\${row[0]}</strong><span>\${row[1]}</span></div>
    </div>\`).join('');

  blocksEl.innerHTML = \`
    <div class="code-block">
      <div class="code-label">Access token (truncated)</div>
      <div class="code-val">\${esc(access.slice(0, 72))}…</div>
    </div>
    <div class="code-block">
      <div class="code-label">Token claims</div>
      <pre class="code-val">\${esc(JSON.stringify({ sub: claims.sub, username: claims.username, client_id: claims.client_id, scope: claims.scope, type: claims.type }, null, 2))}</pre>
    </div>
    <div class="code-block">
      <div class="code-label">MCP get_my_profile (user-scoped)</div>
      <pre class="code-val">\${esc(profileText)}</pre>
    </div>\`;

  actionsEl.style.display = 'flex';
})();
</script>
`));
}

function page(title, body, extraScript) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — ConnectPX</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         background:#0f0f1a;color:#e2e8f0;min-height:100vh;padding:40px 20px}
    .wrap{max-width:600px;margin:0 auto}
    .logo{font-size:18px;font-weight:700;color:#fff;margin-bottom:36px}
    .logo span{color:#818cf8}
    .status{text-align:center;padding:36px 24px;border-radius:16px;margin-bottom:28px}
    .status.success{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25)}
    .status.error  {background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25)}
    .status.pending{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.25)}
    .status .icon{font-size:40px;margin-bottom:12px}
    .status.success .icon{color:#10b981}
    .status.error   .icon{color:#ef4444}
    .status.pending .icon{color:#818cf8}
    .status h2{font-size:22px;font-weight:700;color:#fff;margin-bottom:8px}
    .status p {font-size:14px;color:#94a3b8;line-height:1.5}
    .status strong{color:#e2e8f0}
    .flow-summary{display:flex;flex-direction:column;gap:0;margin-bottom:24px;
                  background:#141428;border:1px solid #1e2035;border-radius:12px;overflow:hidden}
    .flow-step{display:flex;align-items:flex-start;gap:14px;padding:14px 18px;
               border-bottom:1px solid #1e2035}
    .flow-step:last-child{border:none}
    .flow-step.done .badge{background:#10b981;color:#fff}
    .badge{width:24px;height:24px;border-radius:50%;background:#1e2035;
           display:flex;align-items:center;justify-content:center;
           font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px}
    .flow-step div{display:flex;flex-direction:column;gap:3px}
    .flow-step strong{font-size:13px;font-weight:600;color:#e2e8f0}
    .flow-step span{font-size:12px;color:#64748b}
    .flow-step code{font-size:12px;color:#a78bfa;font-family:monospace}
    .code-block{background:#141428;border:1px solid #1e2035;border-radius:10px;
                padding:16px;margin-bottom:14px;overflow:hidden}
    .code-label{font-size:11px;color:#64748b;font-weight:600;
                text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
    .code-val{font-family:monospace;font-size:12px;color:#a78bfa;
              word-break:break-all;white-space:pre-wrap;line-height:1.6}
    .actions{display:flex;gap:12px;margin-top:28px}
    .btn-back{flex:1;display:block;text-align:center;padding:12px;
              background:#1e2035;color:#94a3b8;border-radius:8px;
              text-decoration:none;font-weight:600;font-size:14px}
    .btn-back:hover{background:#252545}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Connect<span>PX</span> <span style="color:#64748b;font-weight:400;font-size:14px">· OAuth Callback</span></div>
    ${body}
  </div>
  ${extraScript || ''}
</body>
</html>`;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}
