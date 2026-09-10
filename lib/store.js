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

export function findUserById(id) {
  return Object.values(USERS).find(u => u.id === Number(id)) || null;
}

export function findUserByUsername(username) {
  return USERS[username] || null;
}

// ── App session (simulates "already logged into Laravel") ─────────────
// Cookie set when user is on the ConnectPX dashboard. Authorize reads it
// so a real AI client (Claude) can skip re-login if the user is already
// authenticated in the app — matching the Laravel product flow.

export const APP_SESSION_COOKIE = 'connectpx_session';

export async function createAppSession(user) {
  return signToken({
    type:     'app_session',
    sub:      String(user.id),
    username: user.username,
    name:     user.name,
  }, '8h');
}

export async function verifyAppSession(token) {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'app_session') return null;
  const user = findUserById(payload.sub);
  if (!user) return null;
  return { id: user.id, username: user.username, name: user.name, email: user.email, plan: user.plan };
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setAppSessionCookie(res, token, req) {
  // Only mark Secure on HTTPS — vercel dev on http://localhost must omit it
  let secure = false;
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    secure = proto === 'https' || (process.env.MCP_BASE_URL || '').startsWith('https://');
  } else {
    secure = (process.env.MCP_BASE_URL || '').startsWith('https://');
  }
  const parts = [
    `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=28800',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAppSessionCookie(res) {
  res.setHeader('Set-Cookie', `${APP_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function getAppSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[APP_SESSION_COOKIE];
  if (!token) return null;
  return verifyAppSession(token);
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
  try {
    // Skip audience check — jose validates aud by default but our aud
    // can vary between function invocations if baseUrl() isn't stable.
    // We verify type + signature instead; good enough for a demo.
    const { payload } = await jose.jwtVerify(token, SECRET, {
      algorithms: ['HS256'],
    });
    if (!payload || payload.type !== 'access') return null;
    return payload;
  } catch {
    return null;
  }
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
  // type MUST come last — spreading tokenData first would overwrite with type:'access'
  return signToken({
    sub:       tokenData.sub,
    username:  tokenData.username,
    client_id: tokenData.client_id,
    scope:     tokenData.scope,
    type:      'session',
  }, '1h');
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
  // Allow explicit override via env var — most reliable on Vercel
  if (process.env.MCP_BASE_URL) return process.env.MCP_BASE_URL.replace(/\/$/, '');

  // Vercel sets x-forwarded-host correctly; fall back to host header
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Accept, Last-Event-ID');
}
