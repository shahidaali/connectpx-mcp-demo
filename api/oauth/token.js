import {
  cors, verifyAuthCode, verifyRefreshToken,
  createAccessToken, createRefreshToken, verifyPkce,
} from '../../lib/store.js';

export default async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Wrap everything — any uncaught throw must return a proper OAuth error
  // string, not Vercel's {"error": {object}} which breaks clients
  try {
    const body = await parseBody(req);

    if (body.grant_type === 'authorization_code') return await authCodeGrant(res, body);
    if (body.grant_type === 'refresh_token')      return await refreshGrant(res, body);
    return res.status(400).json({ error: 'unsupported_grant_type' });

  } catch (e) {
    console.error('token endpoint crash:', e);
    // Must be a string per OAuth spec — not an object
    return res.status(500).json({ error: 'server_error', error_description: String(e.message || e) });
  }
}

async function authCodeGrant(res, body) {
  const code          = body.code;
  const redirect_uri  = body.redirect_uri;
  const client_id     = body.client_id;
  const code_verifier = body.code_verifier;

  if (!code)          return err(res, 'invalid_request', 'Missing code');
  if (!redirect_uri)  return err(res, 'invalid_request', 'Missing redirect_uri');
  if (!client_id)     return err(res, 'invalid_request', 'Missing client_id');
  if (!code_verifier) return err(res, 'invalid_grant',   'Missing code_verifier (PKCE required)');

  // Verify the auth code JWT — it was signed by us and embeds all the
  // original request params, so we don't need a client store at all
  const authCode = await verifyAuthCode(code);
  if (!authCode) return err(res, 'invalid_grant', 'Auth code invalid, expired, or already used');

  // Redirect URI must match exactly
  if (authCode.redirect_uri !== redirect_uri) {
    return err(res, 'invalid_grant', `redirect_uri mismatch: got ${redirect_uri}, expected ${authCode.redirect_uri}`);
  }

  // PKCE — verify the verifier matches the challenge stored in the code
  if (!verifyPkce(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return err(res, 'invalid_grant', 'PKCE verification failed: code_verifier does not match challenge');
  }

  // client_id check: we do a loose match because some clients (MCPJam, Claude)
  // use a metadata URL as client_id at token time which differs from the short
  // id we handed back at registration. As long as PKCE passed we know it's
  // the same client — the PKCE verifier proves it.
  // For strict matching uncomment: if (authCode.client_id !== client_id) return err(res, 'invalid_grant', 'client_id mismatch');

  const resource = body.resource || authCode.resource;
  const access   = await createAccessToken(authCode.user_id, client_id, authCode.scope, resource);
  const refresh  = await createRefreshToken(authCode.user_id, client_id, authCode.scope, resource);

  return res.status(200).json({
    access_token:  access,
    token_type:    'Bearer',
    expires_in:    3600,
    refresh_token: refresh,
    scope:         authCode.scope,
  });
}

async function refreshGrant(res, body) {
  const { refresh_token, client_id } = body;
  if (!refresh_token || !client_id) return err(res, 'invalid_request', 'Missing refresh_token or client_id');

  const stored = await verifyRefreshToken(refresh_token);
  if (!stored) return err(res, 'invalid_grant', 'Refresh token invalid or expired');

  const access  = await createAccessToken(Number(stored.sub), client_id, stored.scope, stored.resource);
  const refresh = await createRefreshToken(Number(stored.sub), client_id, stored.scope, stored.resource);

  return res.status(200).json({
    access_token:  access,
    token_type:    'Bearer',
    expires_in:    3600,
    refresh_token: refresh,
    scope:         stored.scope,
  });
}

function err(res, error, description) {
  // error must always be a plain string per OAuth spec (RFC 6749 §5.2)
  return res.status(400).json({ error: String(error), error_description: String(description || '') });
}

/** Accept JSON or application/x-www-form-urlencoded (OAuth clients use both). */
async function parseBody(req) {
  // Vercel usually pre-parses JSON / form bodies into req.body
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length) {
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('application/json')) {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return {};
}
