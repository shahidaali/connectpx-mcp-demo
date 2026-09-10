import { cors, baseUrl, consumeAuthCode, createAccessToken, createRefreshToken, verifyPkce, createSession } from '../../lib/store.js';

export default async function handler(req, res) {
  cors(res);

  const { code, state, error, error_description } = req.query;

  // ── OAuth error from authorization server ──
  if (error) {
    return res.status(200).send(page('Authorization Denied', `
      <div class="status error">
        <div class="icon">✗</div>
        <h2>Access Denied</h2>
        <p>${esc(error_description || error)}</p>
      </div>
      <a href="/" class="btn-back">← Back to Dashboard</a>
    `));
  }

  if (!code) {
    return res.status(400).send(page('Error', `
      <div class="status error"><div class="icon">!</div><h2>Missing Code</h2><p>No authorization code received.</p></div>
      <a href="/" class="btn-back">← Back to Dashboard</a>
    `));
  }

  // ── Complete the token exchange (simulating what a real AI client would do) ──
  // In real life, the AI client holds the PKCE verifier and does this server-side.
  // Here we stored it in sessionStorage on the dashboard and pass it via the state param.
  // For the demo we decode the auth code JWT directly to show what's inside.

  const base = baseUrl(req);

  // Decode the auth code to show user info (it's a JWT signed by us)
  let codePayload = null;
  try {
    // JWT payload is base64url — decode without verifying for display
    const parts = code.split('.');
    if (parts.length === 3) {
      codePayload = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString());
    }
  } catch {}

  const username = codePayload?.username || 'user';
  const userId   = codePayload?.user_id || '?';
  const scope    = codePayload?.scope || 'mcp:read profile';
  const clientId = codePayload?.client_id || 'connectpx-dashboard';

  // Show success page with what just happened
  return res.status(200).send(page('Authorization Successful', `

    <div class="status success">
      <div class="icon">✓</div>
      <h2>Authorization Complete!</h2>
      <p>The AI client now has a token to access <strong>${esc(username)}</strong>'s data.</p>
    </div>

    <div class="flow-summary">
      <div class="flow-step done">
        <span class="badge">1</span>
        <div>
          <strong>User authenticated</strong>
          <span>Logged in as <code>${esc(username)}</code> (user_id: ${userId})</span>
        </div>
      </div>
      <div class="flow-step done">
        <span class="badge">2</span>
        <div>
          <strong>Authorization code issued</strong>
          <span>Short-lived JWT · 10 minute TTL · PKCE-protected</span>
        </div>
      </div>
      <div class="flow-step done">
        <span class="badge">3</span>
        <div>
          <strong>Scopes granted</strong>
          <span>${esc(scope)}</span>
        </div>
      </div>
      <div class="flow-step done">
        <span class="badge">4</span>
        <div>
          <strong>Next: token exchange</strong>
          <span>AI client POSTs code + PKCE verifier → /oauth/token → gets access token</span>
        </div>
      </div>
      <div class="flow-step done">
        <span class="badge">5</span>
        <div>
          <strong>MCP tools available</strong>
          <span>get_my_orders, get_my_invoices, get_my_subscriptions, get_my_profile, get_usage_stats</span>
        </div>
      </div>
    </div>

    <div class="code-block">
      <div class="code-label">Auth code received by AI client:</div>
      <div class="code-val">${esc(code.slice(0, 60))}...</div>
    </div>

    <div class="code-block">
      <div class="code-label">Next — AI client POSTs to /oauth/token:</div>
      <pre class="code-val">{
  "grant_type":    "authorization_code",
  "code":          "&lt;auth_code&gt;",
  "redirect_uri":  "${base}/oauth/callback",
  "client_id":     "${esc(clientId)}",
  "code_verifier": "&lt;pkce_verifier&gt;"  ← PKCE proof
}</pre>
    </div>

    <div class="code-block">
      <div class="code-label">Response — access token for MCP calls:</div>
      <pre class="code-val">{
  "access_token":  "eyJhbGci... (JWT containing user_id: ${userId})",
  "token_type":    "Bearer",
  "expires_in":    3600,
  "refresh_token": "eyJhbGci...",
  "scope":         "${esc(scope)}"
}</pre>
    </div>

    <div class="actions">
      <a href="/" class="btn-back">← Back to Dashboard</a>
      <a href="/oauth/authorize?response_type=code&client_id=connectpx-dashboard&redirect_uri=${encodeURIComponent(base+'/oauth/callback')}&scope=mcp%3Aread%20profile&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=demo" class="btn-try">Try Again</a>
    </div>
  `));
}

// ── Page shell ────────────────────────────────────────────────────────

function page(title, body) {
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

    /* Logo */
    .logo{font-size:18px;font-weight:700;color:#fff;margin-bottom:36px}
    .logo span{color:#818cf8}

    /* Status box */
    .status{text-align:center;padding:36px 24px;border-radius:16px;margin-bottom:28px}
    .status.success{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25)}
    .status.error  {background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25)}
    .status .icon{font-size:40px;margin-bottom:12px}
    .status.success .icon{color:#10b981}
    .status.error   .icon{color:#ef4444}
    .status h2{font-size:22px;font-weight:700;color:#fff;margin-bottom:8px}
    .status p {font-size:14px;color:#94a3b8;line-height:1.5}
    .status strong{color:#e2e8f0}

    /* Flow steps */
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

    /* Code blocks */
    .code-block{background:#141428;border:1px solid #1e2035;border-radius:10px;
                padding:16px;margin-bottom:14px;overflow:hidden}
    .code-label{font-size:11px;color:#64748b;font-weight:600;
                text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
    .code-val{font-family:monospace;font-size:12px;color:#a78bfa;
              word-break:break-all;white-space:pre-wrap;line-height:1.6}

    /* Buttons */
    .actions{display:flex;gap:12px;margin-top:28px}
    .btn-back{flex:1;display:block;text-align:center;padding:12px;
              background:#1e2035;color:#94a3b8;border-radius:8px;
              text-decoration:none;font-weight:600;font-size:14px}
    .btn-back:hover{background:#252545}
    .btn-try{flex:1;display:block;text-align:center;padding:12px;
             background:linear-gradient(135deg,#6366f1,#8b5cf6);
             color:#fff;border-radius:8px;text-decoration:none;
             font-weight:600;font-size:14px}
    .btn-try:hover{opacity:.85}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Connect<span>PX</span> <span style="color:#64748b;font-weight:400;font-size:14px">· OAuth Callback</span></div>
    ${body}
  </div>
</body>
</html>`;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}
