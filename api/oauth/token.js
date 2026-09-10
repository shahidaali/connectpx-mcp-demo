import {
  cors, verifyAuthCode, verifyRefreshToken,
  createAccessToken, createRefreshToken, verifyPkce
} from '../../lib/store.js';

export default async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};

  if (body.grant_type === 'authorization_code') return authCodeGrant(res, body);
  if (body.grant_type === 'refresh_token')      return refreshGrant(res, body);
  return err(res, 'unsupported_grant_type');
}

async function authCodeGrant(res, body) {
  const { code, redirect_uri, client_id, code_verifier } = body;

  if (!code || !redirect_uri || !client_id) {
    return err(res, 'invalid_request', 'Missing code, redirect_uri, or client_id');
  }

  // Auth code is a JWT we signed — verify it directly, no client store lookup needed
  const authCode = await verifyAuthCode(code);
  if (!authCode) return err(res, 'invalid_grant', 'Auth code invalid or expired');

  // Verify the client presenting the code is the same one that received it
  if (authCode.client_id !== client_id) {
    return err(res, 'invalid_grant', 'client_id mismatch');
  }

  // Verify redirect_uri matches what was used at authorize time
  if (authCode.redirect_uri !== redirect_uri) {
    return err(res, 'invalid_grant', 'redirect_uri mismatch');
  }

  // PKCE verification — mandatory
  if (!code_verifier) return err(res, 'invalid_grant', 'code_verifier required (PKCE)');
  if (!verifyPkce(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return err(res, 'invalid_grant', 'PKCE code_verifier does not match challenge');
  }

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
  if (!stored || stored.client_id !== client_id) {
    return err(res, 'invalid_grant', 'Refresh token invalid or expired');
  }

  const access  = await createAccessToken(parseInt(stored.sub), client_id, stored.scope, stored.resource);
  const refresh = await createRefreshToken(parseInt(stored.sub), client_id, stored.scope, stored.resource);

  return res.status(200).json({
    access_token:  access,
    token_type:    'Bearer',
    expires_in:    3600,
    refresh_token: refresh,
    scope:         stored.scope,
  });
}

function err(res, error, description) {
  return res.status(400).json({ error, ...(description && { error_description: description }) });
}
