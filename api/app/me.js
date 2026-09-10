import { cors, getAppSession } from '../../lib/store.js';

/** Returns the currently logged-in ConnectPX app user (if any). */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const session = await getAppSession(req);
  if (!session) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  return res.status(200).json(session);
}
