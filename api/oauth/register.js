import { cors, json, dynamicClients } from '../../lib/store.js';
import { randomBytes } from 'crypto';

export default function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const redirectUris = body.redirect_uris || [];

  if (!redirectUris.length) {
    return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris required' });
  }

  for (const uri of redirectUris) {
    const p = new URL(uri);
    const ok = p.protocol === 'https:' ||
               (p.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(p.hostname));
    if (!ok) return res.status(400).json({ error: 'invalid_redirect_uri', error_description: `Invalid URI: ${uri}` });
  }

  const clientId = 'dyn_' + randomBytes(12).toString('hex');
  const client = {
    client_id:                   clientId,
    client_name:                 body.client_name || 'Unknown Client',
    redirect_uris:               redirectUris,
    grant_types:                 body.grant_types || ['authorization_code'],
    response_types:              body.response_types || ['code'],
    token_endpoint_auth_method:  body.token_endpoint_auth_method || 'none',
    client_id_issued_at:         Math.floor(Date.now() / 1000),
  };

  dynamicClients.set(clientId, client);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(201).json(client);
}
