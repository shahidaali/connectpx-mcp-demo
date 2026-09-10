import * as jose from 'jose';
import { createHash, randomBytes } from 'crypto';

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

// ── Users ────────────────────────────────────────────────────────────

export const USERS = {
  ahmad: { id: 1, username: 'ahmad', password: 'demo123', name: 'Ahmad Raza',  email: 'ahmad@connectpx.com', plan: 'Premium'  },
  sara:  { id: 2, username: 'sara',  password: 'demo456', name: 'Sara Khan',   email: 'sara@connectpx.com',  plan: 'Standard' },
};

export function authenticateUser(username, password) {
  const user = USERS[username];
  if (user && user.password === password) return user;
  return null;
}

// ── Client registration — stateless, no storage ───────────────────────
// Returns a short opaque ID. The client_id + redirect_uri get embedded
// in the signed auth code, so we never need to look anything up later.

export function registerClient() {
  return randomBytes(12).toString('hex'); // short, URL-safe
}

// ── Auth codes ────────────────────────────────────────────────────────

export async function createAuthCode(data) {
  return signToken({ type: 'auth_code', ...data }, '10m');
}

export async function verifyAuthCode(code) {
  const payload = await verifyToken(code);
  if (!payload || payload.type !== 'auth_code') return null;
  return payload;
}

// ── Access tokens ─────────────────────────────────────────────────────

export async function createAccessToken(userId, clientId, scope, resource) {
  const user = Object.values(USERS).find(u => u.id === Number(userId));
  return signToken({
    type:      'access',
    sub:       String(userId),
    username:  user?.username,
    client_id: clientId,
    scope,
    resource,
    aud:       resource,
  }, '1h');
}

export async function validateAccessToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'access') return null;
  return payload;
}

// ── Refresh tokens ────────────────────────────────────────────────────

export async function createRefreshToken(userId, clientId, scope, resource) {
  return signToken({ type: 'refresh', sub: String(userId), client_id: clientId, scope, resource }, '30d');
}

export async function verifyRefreshToken(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'refresh') return null;
  return payload;
}

// ── MCP Sessions ──────────────────────────────────────────────────────

export async function createSession(tokenData) {
  return signToken({ type: 'session', ...tokenData }, '1h');
}

export async function validateSession(sessionId) {
  const payload = await verifyToken(sessionId);
  if (!payload || payload.type !== 'session') return null;
  return payload;
}

// ── PKCE ─────────────────────────────────────────────────────────────

export function verifyPkce(verifier, challenge, method) {
  if (method !== 'S256') return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return computed === challenge;
}

// ── Shared ────────────────────────────────────────────────────────────

export function baseUrl(req) {
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Accept, Last-Event-ID');
}
