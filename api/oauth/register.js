import { cors, registerClient } from '../../lib/store.js';

/**
 * Dynamic Client Registration (RFC7591) — stateless.
 *
 * We accept any client and return a short opaque client_id.
 * We don't store anything — the client_id + redirect_uri get
 * embedded in the signed auth code when the user approves,
 * so token exchange just verifies the code signature.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const redirectUris = body.redirect_uris || [];

  if (!redirectUris.length) {
    return res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'redirect_uris is required',
    });
  }

  // Validate redirect URIs — must be https or http localhost
  for (const uri of redirectUris) {
    try {
      const p = new URL(uri);
      const ok = p.protocol === 'https:' ||
                 (p.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(p.hostname));
      if (!ok) return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: `URI must be https or localhost: ${uri}`,
      });
    } catch {
      return res.status(400).json({ error: 'invalid_redirect_uri', error_description: `Malformed URI: ${uri}` });
    }
  }

  const clientId = await registerClient(body);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(201).json({
    client_id:                   clientId,
    client_name:                 body.client_name || 'Unknown Client',
    redirect_uris:               redirectUris,
    grant_types:                 body.grant_types    || ['authorization_code'],
    response_types:              body.response_types  || ['code'],
    token_endpoint_auth_method:  body.token_endpoint_auth_method || 'none',
    client_id_issued_at:         Math.floor(Date.now() / 1000),
  });
}
