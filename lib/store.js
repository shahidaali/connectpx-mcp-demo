/**
 * Stateless token store using signed JWTs.
 * Vercel serverless functions don't share memory between invocations,
 * so we encode all state INTO the token itself — no DB needed for a demo.
 *
 * In production: replace with a real DB (Postgres, Redis, etc.)
 */

import * as jose from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'connectpx-mcp-demo-secret-change-in-prod-32chars'
);

// ── JWT helpers ──────────────────────────────────────────────────────

export async function signToken(payload, expiresIn = '1h') {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

// ── Users (simulated Laravel users table) ────────────────────────────

export const USERS = {
  ahmad: { id: 1, username: 'ahmad', password: 'demo123', name: 'Ahmad Raza',  email: 'ahmad@connectpx.com', plan: 'Premium' },
  sara:  { id: 2, username: 'sara',  password: 'demo456', name: 'Sara Khan',   email: 'sara@connectpx.com',  plan: 'Standard' },
};

export function authenticateUser(username, password) {
  const user = USERS[username];
  if (user && user.password === password) return user; // Use bcrypt in real app
  return null;
}

// ── Pre-registered clients ────────────────────────────────────────────

const STATIC_CLIENTS = {
  'connectpx-dashboard': {
    client_id:   'connectpx-dashboard',
    client_name: 'ConnectPX Dashboard',
    redirect_uris: [], // accepts any for dashboard demo
    token_endpoint_auth_method: 'none',
  },
};

/**
 * Find a client by its client_id.
 *
 * Supports two kinds:
 *   1. Static pre-registered clients (simple string ID lookup)
 *   2. Dynamic clients — client_id IS a signed JWT containing redirect_uris.
 *      We verify the JWT signature to confirm we issued it. No DB needed.
 */
export async function findClient(clientId) {
  // Static client
  if (STATIC_CLIENTS[clientId]) return STATIC_CLIENTS[clientId];

  // Dynamic client: client_id is a JWT we signed at registration time
  try {
    const payload = await verifyToken(clientId);
    if (payload?.type === 'dyn_client') {
      return {
        client_id:                  clientId,
        client_name:                payload.client_name,
        redirect_uris:              payload.redirect_uris || [],
        token_endpoint_auth_method: 'none',
      };
    }
  } catch {}

  return null;
}

// ── Auth codes: short-lived JWT (10 min) ─────────────────────────────

export async function createAuthCode(data) {
  return signToken({ type: 'auth_code', ...data }, '10m');
}

export async function consumeAuthCode(code) {
  const payload = await verifyToken(code);
  if (!payload || payload.type !== 'auth_code') return null;
  return payload;
  // Note: JWTs can't be "consumed" (single-use) without a DB.
  // For a demo this is fine. Production: store used codes in Redis with TTL.
}

// ── Access tokens: JWT (1h) ───────────────────────────────────────────

export async function createAccessToken(userId, clientId, scope, resource) {
  const user = Object.values(USERS).find(u => u.id === userId);
  return signToken({
    type: 'access',
    sub: String(userId),
    username: user?.username,
    client_id: clientId,
    scope,
    resource,
    aud: resource, // audience = MCP server URL (RFC8707)
  }, '1h');
}

export async function validateAccessToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'access') return null;
  return payload;
}

// ── Refresh tokens: JWT (30d) ─────────────────────────────────────────

export async function createRefreshToken(userId, clientId, scope, resource) {
  return signToken({ type: 'refresh', sub: String(userId), client_id: clientId, scope, resource }, '30d');
}

export async function consumeRefreshToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'refresh') return null;
  return payload;
}

// ── MCP Sessions: JWT (1h) ────────────────────────────────────────────

export async function createSession(tokenData) {
  return signToken({ type: 'session', ...tokenData }, '1h');
}

export async function validateSession(sessionId) {
  const payload = await verifyToken(sessionId);
  if (!payload || payload.type !== 'session') return null;
  return payload;
}

// ── PKCE ─────────────────────────────────────────────────────────────

import { createHash } from 'crypto';

export function verifyPkce(verifier, challenge, method) {
  if (method !== 'S256') return false;
  const computed = createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return computed === challenge;
}

// ── Shared helpers ───────────────────────────────────────────────────

export function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Accept, Last-Event-ID');
}

export function json(res, data, status = 200) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
}
