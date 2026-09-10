import {
  cors, findClient, consumeAuthCode, consumeRefreshToken,
  createAccessToken, createRefreshToken, verifyPkce
} from '../../lib/store.js';

export default async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const grant = body.grant_type;

  if (grant === 'authorization_code') return authCodeGrant(req, res, body);
  if (grant === 'refresh_token')      return refreshTokenGrant(req, res, body);
  return err(res, 'unsupported_grant_type');
}

async function authCodeGrant(req, res, body) {
  const { code, redirect_uri, client_id, code_verifier } = body;
  if (!code || !redirect_uri || !client_id) return err(res, 'invalid_request', 'Missing parameters');

  // Validate client (async — dynamic clients are JWT-verified)
  const client = await findClient(client_id);
  if (!client) return err(res, 'invalid_client', 'Unknown client');

  // Consume auth code (JWT — already validated expiry)
  const authCode = await consumeAuthCode(code);
  if (!authCode)                          return err(res, 'invalid_grant', 'Auth code invalid or expired');
  if (authCode.client_id !== client_id)   return err(res, 'invalid_grant', 'client_id mismatch');
  if (authCode.redirect_uri !== redirect_uri) return err(res, 'invalid_grant', 'redirect_uri mismatch');

  // PKCE — mandatory
  if (!code_verifier) return err(res, 'invalid_grant', 'code_verifier required (PKCE)');
  if (!verifyPkce(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return err(res, 'invalid_grant', 'PKCE verification failed');
  }

  const resource = body.resource || authCode.resource;
  const access  = await createAccessToken(authCode.user_id, client_id, authCode.scope, resource);
  const refresh = await createRefreshToken(authCode.user_id, client_id, authCode.scope, resource);

  return res.status(200).json({
    access_token:  access,
    token_type:    'Bearer',
    expires_in:    3600,
    refresh_token: refresh,
    scope:         authCode.scope,
  });
}

async function refreshTokenGrant(req, res, body) {
  const { refresh_token, client_id } = body;
  if (!refresh_token || !client_id) return err(res, 'invalid_request', 'Missing parameters');

  const stored = await consumeRefreshToken(refresh_token);
  if (!stored || stored.client_id !== client_id) return err(res, 'invalid_grant', 'Refresh token invalid');

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
