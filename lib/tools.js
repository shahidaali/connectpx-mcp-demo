/**
 * MCP Tools — user-scoped data
 * tokenData.sub  = user ID
 * tokenData.username = username
 *
 * Replace sampleData() with real DB queries in production.
 */

export function listTools() {
  return [
    {
      name: 'get_my_profile',
      description: "Returns the authenticated user's profile.",
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_my_orders',
      description: "Returns this user's orders. Filter by status (pending/completed/all).",
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'pending | completed | all (default: all)' },
          limit:  { type: 'integer', description: 'Max results (default 10, max 50)' },
        },
        required: [],
      },
    },
    {
      name: 'get_my_invoices',
      description: "Returns invoices for this user with totals.",
      inputSchema: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'Filter by year (default: current year)' },
        },
        required: [],
      },
    },
    {
      name: 'get_my_subscriptions',
      description: "Returns active software subscriptions for this user.",
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_usage_stats',
      description: "Returns usage statistics for this user.",
      inputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'this_month | last_month | this_year (default: this_month)' },
        },
        required: [],
      },
    },
  ];
}

export function callTool(name, args, tokenData) {
  const userId = parseInt(tokenData.sub, 10);
  const username = tokenData.username;

  switch (name) {
    case 'get_my_profile':       return getProfile(userId, username, tokenData);
    case 'get_my_orders':        return getOrders(userId, args);
    case 'get_my_invoices':      return getInvoices(userId, args);
    case 'get_my_subscriptions': return getSubscriptions(userId);
    case 'get_usage_stats':      return getUsageStats(userId, args);
    default:                     return errResult(`Unknown tool: '${name}'`);
  }
}

// ── Tool implementations ──────────────────────────────────────────────

const PROFILES = {
  1: { id: 1, username: 'ahmad', name: 'Ahmad Raza',  email: 'ahmad@connectpx.com', plan: 'Premium',  joined: '2023-06-15', company: 'Lahore Grand Restaurant' },
  2: { id: 2, username: 'sara',  name: 'Sara Khan',   email: 'sara@connectpx.com',  plan: 'Standard', joined: '2024-01-20', company: 'City Pharmacy Karachi' },
};

const ORDERS = [
  { id: 'ORD-1001', user_id: 1, product: 'iRestora POS License (Annual)',  amount_pkr: 336000, status: 'completed', date: '2024-11-01' },
  { id: 'ORD-1002', user_id: 1, product: 'POS Terminal Screen 15"',        amount_pkr:  96000, status: 'completed', date: '2024-11-15' },
  { id: 'ORD-1003', user_id: 1, product: 'Annual Support Plan',            amount_pkr:  48000, status: 'pending',   date: '2024-12-01' },
  { id: 'ORD-2001', user_id: 2, product: 'Pharmacy Manager License (Annual)', amount_pkr: 224000, status: 'completed', date: '2024-10-20' },
  { id: 'ORD-2002', user_id: 2, product: 'Barcode Scanner Bundle',         amount_pkr:  35000, status: 'shipped',   date: '2024-11-30' },
];

const INVOICES = [
  { id: 'INV-2024-001', user_id: 1, year: 2024, description: 'iRestora POS License',  amount_pkr: 336000, due: '2024-11-15', paid: true  },
  { id: 'INV-2024-002', user_id: 1, year: 2024, description: 'POS Terminal Screen',   amount_pkr:  96000, due: '2024-11-30', paid: true  },
  { id: 'INV-2024-003', user_id: 1, year: 2024, description: 'Annual Support Plan',   amount_pkr:  48000, due: '2024-12-15', paid: false },
  { id: 'INV-2024-010', user_id: 2, year: 2024, description: 'Pharmacy Manager',      amount_pkr: 224000, due: '2024-10-30', paid: true  },
  { id: 'INV-2024-011', user_id: 2, year: 2024, description: 'Barcode Scanner Bundle',amount_pkr:  35000, due: '2024-12-10', paid: false },
];

const SUBSCRIPTIONS = [
  { id: 'SUB-001', user_id: 1, product: 'iRestora POS',     plan: 'Annual', status: 'active', renews: '2025-11-01', price_pkr: 336000 },
  { id: 'SUB-010', user_id: 2, product: 'Pharmacy Manager', plan: 'Annual', status: 'active', renews: '2025-10-20', price_pkr: 224000 },
];

function getProfile(userId, username, token) {
  const p = PROFILES[userId];
  if (!p) return errResult('Profile not found');
  return textResult(JSON.stringify({ ...p, auth_scope: token.scope }, null, 2));
}

function getOrders(userId, args) {
  const status = args.status || 'all';
  const limit  = Math.min(args.limit || 10, 50);
  let orders = ORDERS.filter(o => o.user_id === userId);
  if (status !== 'all') orders = orders.filter(o => o.status === status);
  orders = orders.slice(0, limit);
  if (!orders.length) return textResult(`No orders found${status !== 'all' ? ` with status '${status}'` : ''}.`);
  return textResult(JSON.stringify(orders, null, 2));
}

function getInvoices(userId, args) {
  const year = args.year || new Date().getFullYear();
  const inv  = INVOICES.filter(i => i.user_id === userId && i.year === year);
  if (!inv.length) return textResult(`No invoices found for ${year}.`);
  const total = inv.reduce((s, i) => s + i.amount_pkr, 0);
  return textResult(`Invoices for ${year} — Total: PKR ${total.toLocaleString()}\n\n${JSON.stringify(inv, null, 2)}`);
}

function getSubscriptions(userId) {
  const subs = SUBSCRIPTIONS.filter(s => s.user_id === userId);
  if (!subs.length) return textResult('No active subscriptions.');
  return textResult(JSON.stringify(subs, null, 2));
}

function getUsageStats(userId, args) {
  const period = args.period || 'this_month';
  return textResult(JSON.stringify({
    user_id:       userId,
    period,
    api_calls:     1240 + userId * 137,
    orders_placed: 8 + userId,
    login_count:   24 + userId * 3,
    data_exported: `${userId * 2} MB`,
    last_active:   new Date(Date.now() - userId * 600_000).toISOString(),
  }, null, 2));
}

// ── Helpers ───────────────────────────────────────────────────────────

function textResult(text) { return { content: [{ type: 'text', text }] }; }
function errResult(msg)   { return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }; }
