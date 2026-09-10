import { cors, baseUrl } from '../../lib/store.js';

export default function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const base = baseUrl(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({
    resource:               `${base}/mcp`,
    authorization_servers:  [base],
    scopes_supported:        ['mcp:read', 'mcp:write', 'profile'],
    bearer_methods_supported: ['header'],
    resource_documentation:  `${base}/`,
  });
}
