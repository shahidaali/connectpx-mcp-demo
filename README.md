# ConnectPX MCP OAuth Demo

MCP server with OAuth 2.1 + PKCE that binds an AI client to an **existing app user**.

**Stack:** Node.js · Vercel serverless · Stateless JWT tokens (no DB needed)

---

## Product flow (what this demo implements)

1. User already exists / is signed into ConnectPX (dashboard sets an app session cookie — in production this is your Laravel session)
2. User clicks **Connect Claude**
3. AI client starts OAuth 2.1 + PKCE
4. User approves on the consent page (no password re-entry when app session is present)
5. System associates the AI client with that user (`user_id` in auth code + access token)
6. MCP receives a Bearer JWT
7. Tools read `token.sub` / `username` and return **only that user’s** data

---

## Deploy to Vercel (free, 2 minutes)

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
cd connectpx-mcp-demo
vercel          # follow prompts, get instant HTTPS URL
```

### Option B — GitHub + Vercel Dashboard

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Framework: **Other** · Root: `/` · No build command needed
4. Click **Deploy** → get your URL (e.g. `https://connectpx-mcp.vercel.app`)

### Optional: Set JWT secret (more secure)

In Vercel Dashboard → Project → Settings → Environment Variables:
```
JWT_SECRET = any-random-32-char-string-you-generate
MCP_BASE_URL = https://your-project.vercel.app
```

---

## Try the Connect flow in the browser

**Important:** Claude reaches your MCP server from Anthropic’s cloud. Use a **public HTTPS** URL (Vercel). `localhost` will not work.

1. Deploy and open `https://your-project.vercel.app/`
2. Pick **Ahmad** or **Sara** (establishes app session)
3. Click **Connect Claude** → **Open Claude to Connect**
4. In Claude: **Add** the connector, then click **Connect**
5. Browser opens ConnectPX consent → **Allow Access**
6. You’re redirected to `claude.ai` — connector shows as **Connected**

Deep link used by the button:
```
https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=ConnectPX&connectorUrl=https%3A%2F%2Fyour-project.vercel.app%2Fmcp
```

Use **Try locally** only to simulate OAuth without Claude (stays on this site).

---

## Test it live (API)

```bash
BASE=https://your-project.vercel.app

# 1. Protected Resource Metadata (RFC9728)
curl $BASE/.well-known/oauth-protected-resource

# 2. AS Metadata — check PKCE is S256
curl $BASE/.well-known/oauth-authorization-server

# 3. Register a client
curl -X POST $BASE/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test","redirect_uris":["http://localhost:3000/callback"]}'

# 4. MCP without token → 401 + WWW-Authenticate
curl -si -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Add to Claude Desktop / Claude with remote MCP

Point the client at your MCP URL (OAuth discovery does the rest):

```
https://your-project.vercel.app/mcp
```

Optional explicit config:
```json
{
  "mcpServers": {
    "connectpx": {
      "url": "https://your-project.vercel.app/mcp"
    }
  }
}
```

When Claude opens the authorize URL on your domain, if the user already has a ConnectPX session cookie, they only approve — then Claude receives a token for that user.

---

## Demo credentials (consent page fallback)

| User | Username | Password | Data |
|------|----------|----------|------|
| Ahmad Raza (Premium) | `ahmad` | `demo123` | 3 orders, 3 invoices, 1 subscription |
| Sara Khan (Standard) | `sara` | `demo456` | 2 orders, 2 invoices, 1 subscription |

If the dashboard (or Laravel) already set the app session cookie, password fields are hidden.

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_my_profile` | Profile of the authenticated user |
| `get_my_orders` | Orders (filter by status, limit) |
| `get_my_invoices` | Invoices by year with totals |
| `get_my_subscriptions` | Active software subscriptions |
| `get_usage_stats` | Usage stats by period |

---

## Replace demo data with real Laravel

1. **App session:** Replace `/app/login` cookie with your real Laravel session validation in `getAppSession()` (`lib/store.js`).
2. **Tools:** In `lib/tools.js`, call your Laravel API with the JWT `sub` (user id):

```js
async function getOrders(userId, args) {
  const resp = await fetch(`${process.env.LARAVEL_API}/users/${userId}/orders`, {
    headers: { Authorization: `Bearer ${process.env.INTERNAL_KEY}` }
  });
  const orders = await resp.json();
  return textResult(JSON.stringify(orders, null, 2));
}
```

---

## Architecture

```
User (already logged into ConnectPX / Laravel)
    │
    │ Click "Connect Claude"
    │
AI Client (Claude)
    │ POST /mcp → 401 + WWW-Authenticate: resource_metadata=...
    │ GET  /.well-known/oauth-protected-resource  (RFC9728)
    │ GET  /.well-known/oauth-authorization-server (RFC8414 + PKCE S256)
    │ POST /oauth/register   (RFC7591 Dynamic Registration)  [optional]
    │ GET  /oauth/authorize  → Consent (uses app session if present)
    │ POST /oauth/token      (PKCE verifier → JWT with user_id)
    │ POST /mcp + Bearer JWT → user-scoped tool results
    ▼
  ConnectPX MCP Server (Vercel)
    → Tools return only THIS user's data (user_id from JWT sub claim)
```
