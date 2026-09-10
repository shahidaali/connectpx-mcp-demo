/**
 * MCP Tools — user-scoped demo data
 * tokenData.sub  = user ID
 * tokenData.username = username
 *
 * Replace these arrays with Laravel API calls in production.
 */

export function listTools() {
  return [
    {
      name: 'get_my_profile',
      description: "Returns the authenticated user's profile, company, and plan details.",
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_my_orders',
      description: "Returns this user's orders. Filter by status (pending/completed/shipped/all).",
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'pending | completed | shipped | all (default: all)' },
          limit:  { type: 'integer', description: 'Max results (default 20, max 50)' },
        },
        required: [],
      },
    },
    {
      name: 'get_my_invoices',
      description: "Returns invoices for this user with totals. Defaults to current year; use year=2024|2025|2026.",
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
      description: "Returns software subscriptions for this user (active and paused).",
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_usage_stats',
      description: "Returns usage statistics for this user by period.",
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

// ── Sample data ───────────────────────────────────────────────────────

const PROFILES = {
  1: {
    id: 1,
    username: 'ahmad',
    name: 'Ahmad Raza',
    email: 'ahmad@connectpx.com',
    phone: '+92-300-1112233',
    plan: 'Premium',
    joined: '2023-06-15',
    company: 'Lahore Grand Restaurant',
    city: 'Lahore',
    country: 'Pakistan',
    billing_address: '12 MM Alam Road, Gulberg III, Lahore',
    account_status: 'active',
    seats: 8,
  },
  2: {
    id: 2,
    username: 'sara',
    name: 'Sara Khan',
    email: 'sara@connectpx.com',
    phone: '+92-321-4455667',
    plan: 'Standard',
    joined: '2024-01-20',
    company: 'City Pharmacy Karachi',
    city: 'Karachi',
    country: 'Pakistan',
    billing_address: '45 Shahrah-e-Faisal, PECHS, Karachi',
    account_status: 'active',
    seats: 3,
  },
};

const ORDERS = [
  // Ahmad (user 1)
  { id: 'ORD-1001', user_id: 1, product: 'iRestora POS License (Annual)',     amount_pkr: 336000, status: 'completed', date: '2024-11-01', qty: 1 },
  { id: 'ORD-1002', user_id: 1, product: 'POS Terminal Screen 15"',           amount_pkr:  96000, status: 'completed', date: '2024-11-15', qty: 2 },
  { id: 'ORD-1003', user_id: 1, product: 'Annual Support Plan',               amount_pkr:  48000, status: 'completed', date: '2024-12-01', qty: 1 },
  { id: 'ORD-1004', user_id: 1, product: 'Kitchen Display System',            amount_pkr:  75000, status: 'completed', date: '2025-03-12', qty: 1 },
  { id: 'ORD-1005', user_id: 1, product: 'Thermal Receipt Printer x3',        amount_pkr:  54000, status: 'completed', date: '2025-06-20', qty: 3 },
  { id: 'ORD-1006', user_id: 1, product: 'iRestora POS License Renewal',      amount_pkr: 336000, status: 'completed', date: '2025-10-28', qty: 1 },
  { id: 'ORD-1007', user_id: 1, product: 'Online Ordering Module',            amount_pkr:  89000, status: 'shipped',   date: '2026-01-14', qty: 1 },
  { id: 'ORD-1008', user_id: 1, product: 'Staff Training Package (8 seats)',  amount_pkr:  40000, status: 'pending',   date: '2026-08-22', qty: 1 },
  { id: 'ORD-1009', user_id: 1, product: 'Extra Branch License — DHA Phase 5', amount_pkr: 168000, status: 'pending',  date: '2026-09-05', qty: 1 },

  // Sara (user 2)
  { id: 'ORD-2001', user_id: 2, product: 'Pharmacy Manager License (Annual)', amount_pkr: 224000, status: 'completed', date: '2024-10-20', qty: 1 },
  { id: 'ORD-2002', user_id: 2, product: 'Barcode Scanner Bundle',            amount_pkr:  35000, status: 'completed', date: '2024-11-30', qty: 2 },
  { id: 'ORD-2003', user_id: 2, product: 'Medicine Inventory Module',         amount_pkr:  62000, status: 'completed', date: '2025-02-18', qty: 1 },
  { id: 'ORD-2004', user_id: 2, product: 'Label Printer + Rolls',             amount_pkr:  28000, status: 'completed', date: '2025-05-09', qty: 1 },
  { id: 'ORD-2005', user_id: 2, product: 'Pharmacy Manager License Renewal',  amount_pkr: 224000, status: 'completed', date: '2025-10-15', qty: 1 },
  { id: 'ORD-2006', user_id: 2, product: 'SMS Reminder Pack (10k credits)',   amount_pkr:  15000, status: 'shipped',   date: '2026-04-02', qty: 1 },
  { id: 'ORD-2007', user_id: 2, product: 'Second Counter License',            amount_pkr:  88000, status: 'pending',   date: '2026-08-30', qty: 1 },
];

const INVOICES = [
  // Ahmad — 2024
  { id: 'INV-2024-001', user_id: 1, year: 2024, description: 'iRestora POS License',       amount_pkr: 336000, due: '2024-11-15', paid: true  },
  { id: 'INV-2024-002', user_id: 1, year: 2024, description: 'POS Terminal Screen',        amount_pkr:  96000, due: '2024-11-30', paid: true  },
  { id: 'INV-2024-003', user_id: 1, year: 2024, description: 'Annual Support Plan',        amount_pkr:  48000, due: '2024-12-15', paid: true  },
  // Ahmad — 2025
  { id: 'INV-2025-001', user_id: 1, year: 2025, description: 'Kitchen Display System',     amount_pkr:  75000, due: '2025-03-25', paid: true  },
  { id: 'INV-2025-002', user_id: 1, year: 2025, description: 'Thermal Receipt Printers',   amount_pkr:  54000, due: '2025-07-01', paid: true  },
  { id: 'INV-2025-003', user_id: 1, year: 2025, description: 'POS License Renewal',        amount_pkr: 336000, due: '2025-11-10', paid: true  },
  // Ahmad — 2026
  { id: 'INV-2026-001', user_id: 1, year: 2026, description: 'Online Ordering Module',     amount_pkr:  89000, due: '2026-01-28', paid: true  },
  { id: 'INV-2026-002', user_id: 1, year: 2026, description: 'Staff Training Package',     amount_pkr:  40000, due: '2026-09-05', paid: false },
  { id: 'INV-2026-003', user_id: 1, year: 2026, description: 'Extra Branch License (DHA)',  amount_pkr: 168000, due: '2026-09-20', paid: false },

  // Sara — 2024
  { id: 'INV-2024-010', user_id: 2, year: 2024, description: 'Pharmacy Manager License',   amount_pkr: 224000, due: '2024-10-30', paid: true  },
  { id: 'INV-2024-011', user_id: 2, year: 2024, description: 'Barcode Scanner Bundle',     amount_pkr:  35000, due: '2024-12-10', paid: true  },
  // Sara — 2025
  { id: 'INV-2025-010', user_id: 2, year: 2025, description: 'Medicine Inventory Module',  amount_pkr:  62000, due: '2025-03-01', paid: true  },
  { id: 'INV-2025-011', user_id: 2, year: 2025, description: 'Label Printer + Rolls',      amount_pkr:  28000, due: '2025-05-20', paid: true  },
  { id: 'INV-2025-012', user_id: 2, year: 2025, description: 'Pharmacy License Renewal',   amount_pkr: 224000, due: '2025-10-28', paid: true  },
  // Sara — 2026
  { id: 'INV-2026-010', user_id: 2, year: 2026, description: 'SMS Reminder Pack',          amount_pkr:  15000, due: '2026-04-15', paid: true  },
  { id: 'INV-2026-011', user_id: 2, year: 2026, description: 'Second Counter License',     amount_pkr:  88000, due: '2026-09-15', paid: false },
];

const SUBSCRIPTIONS = [
  // Ahmad
  { id: 'SUB-001', user_id: 1, product: 'iRestora POS',          plan: 'Annual',  status: 'active',  seats: 8, renews: '2026-11-01', price_pkr: 336000, started: '2023-11-01' },
  { id: 'SUB-002', user_id: 1, product: 'Online Ordering Add-on', plan: 'Annual',  status: 'active',  seats: 8, renews: '2027-01-14', price_pkr:  89000, started: '2026-01-14' },
  { id: 'SUB-003', user_id: 1, product: 'Premium Support',       plan: 'Annual',  status: 'active',  seats: 8, renews: '2026-12-01', price_pkr:  48000, started: '2024-12-01' },
  { id: 'SUB-004', user_id: 1, product: 'Legacy Loyalty Module', plan: 'Monthly', status: 'paused',  seats: 2, renews: null,         price_pkr:   4500, started: '2024-04-01' },

  // Sara
  { id: 'SUB-010', user_id: 2, product: 'Pharmacy Manager',      plan: 'Annual',  status: 'active',  seats: 3, renews: '2026-10-20', price_pkr: 224000, started: '2024-10-20' },
  { id: 'SUB-011', user_id: 2, product: 'SMS Reminders',         plan: 'Annual',  status: 'active',  seats: 3, renews: '2027-04-02', price_pkr:  15000, started: '2026-04-02' },
  { id: 'SUB-012', user_id: 2, product: 'Inventory Alerts',      plan: 'Monthly', status: 'active',  seats: 3, renews: '2026-10-01', price_pkr:   2500, started: '2025-02-18' },
];

const USAGE_BY_PERIOD = {
  1: {
    this_month: {
      api_calls: 2840, orders_placed: 12, login_count: 38, pos_transactions: 4120,
      data_exported_mb: 18, support_tickets: 1, avg_response_ms: 142,
      top_modules: ['POS', 'Kitchen Display', 'Online Ordering'],
    },
    last_month: {
      api_calls: 2510, orders_placed: 9, login_count: 34, pos_transactions: 3890,
      data_exported_mb: 14, support_tickets: 0, avg_response_ms: 138,
      top_modules: ['POS', 'Reports', 'Kitchen Display'],
    },
    this_year: {
      api_calls: 21400, orders_placed: 86, login_count: 290, pos_transactions: 31200,
      data_exported_mb: 128, support_tickets: 4, avg_response_ms: 145,
      top_modules: ['POS', 'Online Ordering', 'Inventory'],
    },
  },
  2: {
    this_month: {
      api_calls: 1180, orders_placed: 5, login_count: 22, pharmacy_sales: 1860,
      data_exported_mb: 6, support_tickets: 0, avg_response_ms: 155,
      top_modules: ['Pharmacy Manager', 'Inventory', 'SMS Reminders'],
    },
    last_month: {
      api_calls: 980, orders_placed: 4, login_count: 19, pharmacy_sales: 1620,
      data_exported_mb: 4, support_tickets: 1, avg_response_ms: 160,
      top_modules: ['Pharmacy Manager', 'Barcode', 'Reports'],
    },
    this_year: {
      api_calls: 9200, orders_placed: 41, login_count: 175, pharmacy_sales: 14800,
      data_exported_mb: 42, support_tickets: 2, avg_response_ms: 158,
      top_modules: ['Pharmacy Manager', 'Inventory', 'Label Printing'],
    },
  },
};

// ── Tool implementations ──────────────────────────────────────────────

function getProfile(userId, username, token) {
  const p = PROFILES[userId];
  if (!p) return errResult(`Profile not found for user_id=${userId} (${username || 'unknown'})`);
  return textResult(JSON.stringify({
    ...p,
    auth_scope: token.scope,
    authenticated_as: username || p.username,
  }, null, 2));
}

function getOrders(userId, args) {
  const status = args.status || 'all';
  const limit  = Math.min(args.limit || 20, 50);
  let orders = ORDERS.filter(o => o.user_id === userId);
  if (status !== 'all') orders = orders.filter(o => o.status === status);
  orders = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);

  if (!orders.length) {
    return textResult(`No orders found${status !== 'all' ? ` with status '${status}'` : ''} for this user.`);
  }

  const total = orders.reduce((s, o) => s + o.amount_pkr, 0);
  return textResult(
    `Found ${orders.length} order(s) — Total: PKR ${total.toLocaleString()}\n\n` +
    JSON.stringify(orders, null, 2)
  );
}

function getInvoices(userId, args) {
  const year = args.year || new Date().getFullYear();
  let inv = INVOICES.filter(i => i.user_id === userId && i.year === year);

  // If current year has no rows, fall back to the latest year that does
  if (!inv.length && !args.year) {
    const years = [...new Set(INVOICES.filter(i => i.user_id === userId).map(i => i.year))].sort((a, b) => b - a);
    if (years.length) {
      inv = INVOICES.filter(i => i.user_id === userId && i.year === years[0]);
      const total = inv.reduce((s, i) => s + i.amount_pkr, 0);
      const unpaid = inv.filter(i => !i.paid).reduce((s, i) => s + i.amount_pkr, 0);
      return textResult(
        `No invoices for ${year}; showing latest year ${years[0]} — Total: PKR ${total.toLocaleString()} (unpaid: PKR ${unpaid.toLocaleString()})\n\n` +
        JSON.stringify(inv, null, 2)
      );
    }
  }

  if (!inv.length) return textResult(`No invoices found for ${year}. Try year=2024, 2025, or 2026.`);

  const total = inv.reduce((s, i) => s + i.amount_pkr, 0);
  const unpaid = inv.filter(i => !i.paid).reduce((s, i) => s + i.amount_pkr, 0);
  return textResult(
    `Invoices for ${year} — Total: PKR ${total.toLocaleString()} (unpaid: PKR ${unpaid.toLocaleString()})\n\n` +
    JSON.stringify(inv, null, 2)
  );
}

function getSubscriptions(userId) {
  const subs = SUBSCRIPTIONS.filter(s => s.user_id === userId);
  if (!subs.length) return textResult('No subscriptions found for this user.');
  const active = subs.filter(s => s.status === 'active');
  const monthly = active.reduce((s, sub) => {
    const m = sub.plan === 'Monthly' ? sub.price_pkr : Math.round(sub.price_pkr / 12);
    return s + m;
  }, 0);
  return textResult(
    `${subs.length} subscription(s), ${active.length} active — ~PKR ${monthly.toLocaleString()}/mo\n\n` +
    JSON.stringify(subs, null, 2)
  );
}

function getUsageStats(userId, args) {
  const period = args.period || 'this_month';
  const byUser = USAGE_BY_PERIOD[userId];
  if (!byUser) return errResult('Usage stats not found for this user');
  const stats = byUser[period] || byUser.this_month;
  return textResult(JSON.stringify({
    user_id: userId,
    period: byUser[period] ? period : 'this_month',
    last_active: new Date(Date.now() - userId * 600_000).toISOString(),
    ...stats,
  }, null, 2));
}

// ── Helpers ───────────────────────────────────────────────────────────

function textResult(text) { return { content: [{ type: 'text', text }] }; }
function errResult(msg)   { return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }; }
