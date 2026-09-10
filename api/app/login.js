import {
  cors,
  findUserByUsername,
  authenticateUser,
  createAppSession,
  setAppSessionCookie,
  clearAppSessionCookie,
} from '../../lib/store.js';

/**
 * Simulates "user is already logged into the Laravel app".
 * Dashboard calls this when switching the demo user.
 * Authorize reads the cookie and skips password when present.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'DELETE') {
    clearAppSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const username = String(body.username || '').trim();

  // Demo shortcut: selecting a user on the dashboard (password optional).
  // Real Laravel would only set this cookie after a real app login.
  let user = null;
  if (body.password) {
    user = authenticateUser(username, body.password);
  } else {
    user = findUserByUsername(username);
  }

  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials', error_description: 'Unknown user' });
  }

  const token = await createAppSession(user);
  setAppSessionCookie(res, token, req);

  return res.status(200).json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    plan: user.plan,
  });
}
