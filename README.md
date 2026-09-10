# ConnectPX MCP OAuth Demo

MCP server with full OAuth 2.1 + PKCE authentication.  
**Stack:** Node.js · Vercel serverless · Stateless JWT tokens (no DB needed)  
**Deploy time:** ~2 minutes from GitHub push

---

## Deploy to Vercel (free, 2 minutes)

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
cd mcp-oauth-vercel
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
```

---

## Test it live

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

## Add to Claude Desktop

In `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "connectpx": {
      "url": "https://your-project.vercel.app/mcp",
      "oauth": {
        "authorizationEndpoint": "https://your-project.vercel.app/oauth/authorize",
        "tokenEndpoint": "https://your-project.vercel.app/oauth/token",
        "clientId": "connectpx-dashboard",
        "scope": "mcp:read profile"
      }
    }
  }
}
```

---

## Demo credentials (consent page)

| User | Username | Password | Data |
|------|----------|----------|------|
| Ahmad Raza (Premium) | `ahmad` | `demo123` | 3 orders, 3 invoices, 1 subscription |
| Sara Khan (Standard) | `sara` | `demo456` | 2 orders, 2 invoices, 1 subscription |

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

In `lib/tools.js`, replace the in-memory arrays with real API calls:

```js
// Before (demo):
const ORDERS = [ { id: 'ORD-1001', user_id: 1, ... }, ... ];

// After (real Laravel API):
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
AI Client (Claude/ChatGPT/Cursor)
    │
    │ POST /mcp → 401 + WWW-Authenticate: resource_metadata=...
    │ GET  /.well-known/oauth-protected-resource  (RFC9728)
    │ GET  /.well-known/oauth-authorization-server (RFC8414 + PKCE S256)
    │ POST /oauth/register   (RFC7591 Dynamic Registration)
    │ GET  /oauth/authorize  → Login + Consent page
    │ POST /oauth/token      (PKCE verifier → JWT access token)
    │ POST /mcp + Bearer JWT → user-scoped tool results
    ▼
  ConnectPX MCP Server (Vercel)
    → Tools return only THIS user's data (user_id from JWT sub claim)
```
