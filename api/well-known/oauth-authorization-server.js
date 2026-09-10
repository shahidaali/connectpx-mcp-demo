import { cors, baseUrl } from '../../lib/store.js';

export default function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const base = baseUrl(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({
    issuer:                      base,
    authorization_endpoint:      `${base}/oauth/authorize`,
    token_endpoint:              `${base}/oauth/token`,
    registration_endpoint:       `${base}/oauth/register`,
    response_types_supported:    ['code'],
    grant_types_supported:       ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    // PKCE S256 — mandatory per MCP spec
    code_challenge_methods_supported: ['S256'],
    scopes_supported:            ['mcp:read', 'mcp:write', 'profile'],
    // Dynamic Client Registration (RFC7591)
    registration_endpoint_auth_methods_supported: ['none'],
    // Client ID Metadata Documents
    client_id_metadata_document_supported: true,
    // Resource Indicators (RFC8707)
    resource_indicators_supported: true,
    service_documentation:       `${base}/`,
  });
}
