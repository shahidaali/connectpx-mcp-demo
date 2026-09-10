import { cors, signToken } from '../../lib/store.js';

/**
 * Dynamic Client Registration (RFC7591) — stateless version.
 *
 * The problem: Vercel serverless functions spin up fresh for every request,
 * so an in-memory Map() is wiped between /oauth/register and /oauth/token.
 *
 * The fix: encode the client's redirect_uris into a signed JWT and return
 * THAT as the client_id. The token endpoint verifies the JWT directly —
 * no database or shared memory needed.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const redirectUris = body.redirect_uris || [];

  if (!redirectUris.length) {
    return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris required' });
  }

  // Accept any https redirect URI, or http localhost — standard OAuth rule
  for (const uri of redirectUris) {
    try {
      const p = new URL(uri);
      const ok = p.protocol === 'https:' ||
                 (p.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(p.hostname));
      if (!ok) return res.status(400).json({ error: 'invalid_redirect_uri', error_description: `Invalid URI: ${uri}` });
    } catch {
      return res.status(400).json({ error: 'invalid_redirect_uri', error_description: `Malformed URI: ${uri}` });
    }
  }

  const clientName = body.client_name || 'Unknown Client';
  const issuedAt   = Math.floor(Date.now() / 1000);

  // Encode the client registration INTO the client_id as a signed JWT.
  // This survives across serverless invocations — no storage needed.
  const clientId = await signToken({
    type:          'dyn_client',
    client_name:   clientName,
    redirect_uris: redirectUris,
    issued_at:     issuedAt,
  }, '365d'); // long-lived — it's an identity, not a secret

  const response = {
    client_id:                   clientId,
    client_name:                 clientName,
    redirect_uris:               redirectUris,
    grant_types:                 body.grant_types    || ['authorization_code'],
    response_types:              body.response_types  || ['code'],
    token_endpoint_auth_method:  body.token_endpoint_auth_method || 'none',
    client_id_issued_at:         issuedAt,
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(201).json(response);
}
