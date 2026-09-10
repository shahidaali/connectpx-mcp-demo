import { cors, baseUrl, validateAccessToken, createSession, validateSession } from '../lib/store.js';
import { listTools, callTool } from '../lib/tools.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST')   return handlePost(req, res);
  if (req.method === 'GET')    return handleGet(req, res);
  if (req.method === 'DELETE') return handleDelete(req, res);
  return res.status(405).end();
}

// ── Token validation ──────────────────────────────────────────────────

async function requireToken(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { unauthorized(req, res, 'Bearer token required'); return null; }

  const token = auth.slice(7);
  const data  = await validateAccessToken(token);
  if (!data) { unauthorized(req, res, 'Token invalid or expired'); return null; }

  return data;
}

function unauthorized(req, res, msg) {
  const base = baseUrl(req);
  // Claude looks for resource_metadata on the 401 (preferred over probing well-known)
  res.setHeader('WWW-Authenticate',
    `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${base}/.well-known/oauth-protected-resource/mcp", scope="mcp:read profile"`
  );
  res.status(401).json(rpcErr(-32001, `Unauthorized: ${msg}`, null));
}

// ── POST — JSON-RPC ───────────────────────────────────────────────────

async function handlePost(req, res) {
  const tokenData = await requireToken(req, res);
  if (!tokenData) return;

  const body = req.body;
  if (!body || body.jsonrpc !== '2.0') {
    return res.status(400).json(rpcErr(-32600, 'Invalid JSON-RPC', null));
  }

  const { id, method, params = {} } = body;

  // ── initialize: issue MCP session ──
  if (method === 'initialize') {
    const sessionId = await createSession(tokenData);
    res.setHeader('MCP-Session-Id', sessionId);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(rpcOk({
      protocolVersion: '2025-11-25',
      capabilities:    { tools: { listChanged: false } },
      serverInfo:      { name: 'ConnectPX MCP Demo', version: '1.0.0' },
      _meta: {
        userId:   tokenData.sub,
        username: tokenData.username,
        scope:    tokenData.scope,
      },
    }, id));
  }

  // Notifications (no id) — just acknowledge
  if (id === null || id === undefined) return res.status(202).end();

  // All other methods require a valid session
  const sessionHeader = req.headers['mcp-session-id'];
  const session = sessionHeader ? await validateSession(sessionHeader) : null;
  if (!session) {
    return res.status(400).json(rpcErr(-32001, 'No valid session — call initialize first', id));
  }

  // Scope check for write tools
  if (method === 'tools/call') {
    const writeTool = ['create_order', 'update_profile'].includes(params.name);
    if (writeTool && !tokenData.scope?.includes('mcp:write')) {
      return res.status(200).json(rpcErr(-32003, 'Insufficient scope: mcp:write required', id));
    }
  }

  const response = (() => {
    switch (method) {
      case 'tools/list':
        return rpcOk({ tools: listTools() }, id);
      case 'tools/call': {
        if (!params.name) return rpcErr(-32602, 'tools/call requires params.name', id);
        try {
          return rpcOk(callTool(params.name, params.arguments || {}, tokenData), id);
        } catch (e) {
          return rpcErr(-32603, `Tool error: ${e.message}`, id);
        }
      }
      case 'ping':
        return rpcOk({ pong: true }, id);
      default:
        return rpcErr(-32601, `Method not found: ${method}`, id);
    }
  })();

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(response);
}

// ── GET — minimal SSE (Vercel times out at 25s; just an ack stream) ───

async function handleGet(req, res) {
  const tokenData = await requireToken(req, res);
  if (!tokenData) return;

  const accept = req.headers.accept || '';
  if (!accept.includes('text/event-stream')) return res.status(405).send('Requires text/event-stream');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write(`id: init\ndata: \n\n`);
  res.write(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  // Vercel serverless: can't hold open; client will reconnect
  res.end();
}

// ── DELETE — terminate session ────────────────────────────────────────

async function handleDelete(req, res) {
  const tokenData = await requireToken(req, res);
  if (!tokenData) return;
  // Sessions are stateless JWTs — nothing to delete server-side
  res.status(200).json({ terminated: true });
}

// ── Helpers ───────────────────────────────────────────────────────────

function rpcOk(result, id)         { return { jsonrpc: '2.0', id, result }; }
function rpcErr(code, message, id) { return { jsonrpc: '2.0', id, error: { code, message } }; }
