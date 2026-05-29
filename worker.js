/**
 * ============================================================
 *  BUNOFEED — Cloudflare Worker (Secure Backend Proxy)
 *  Deploy to: Cloudflare Workers
 *
 *  This worker sits between your frontend and Google Sheets.
 *  The SECRET and Google Apps Script URL are stored as
 *  Cloudflare Worker Secrets — never exposed to the browser.
 *
 *  ENVIRONMENT VARIABLES (set in Cloudflare Dashboard):
 *    GAS_URL    → Your Google Apps Script Web App URL
 *    GAS_SECRET → Your shared secret (same as in Apps Script)
 *    ADMIN_KEY  → A separate strong key for admin operations
 *
 *  ENDPOINTS:
 *    POST /api/order/create       → Save new order to sheet
 *    GET  /api/order/lookup       → Fetch order by ID + phone
 *    POST /api/order/update       → Update return/cancel status
 * ============================================================
 */

const ALLOWED_ORIGINS = [
  'https://akashkumarsrms-netizen.github.io',       // ← your GitHub Pages domain
  'https://bunofeed.in',             // ← your custom domain (if any)
  'http://127.0.0.1:5500',            // local dev (Live Server)
  'http://localhost:5500',
  'http://localhost:3000',
];

// ── Rate limiting store (in-memory, resets on worker restart) ──
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute
const RATE_LIMIT_MAX       = 20;      // max requests per IP per minute

function isRateLimited(ip) {
  const now  = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX;
}

// ── CORS helpers ──
function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(message, status, corsHeaders = {}) {
  return jsonResponse({ status: 'error', message }, status, corsHeaders);
}

// ── Input validation helpers ──
function validateOrderId(id) {
  // ORD + 13-digit timestamp + optional alphanumeric suffix (from crypto.getRandomValues)
  return typeof id === 'string' && /^ORD[A-Z0-9]{13,30}$/i.test(id.trim());
}
function validatePhone(phone) {
  return typeof phone === 'string' && /^\d{10}$/.test(phone.trim());
}
function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePincode(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin.trim());
}

// ── Sanitise string (basic XSS prevention) ──
function sanitise(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'`]/g, '').trim().substring(0, maxLen);
}

// ── Forward request to Google Apps Script ──
async function callGAS(env, method, params = {}) {
  const url = env.GAS_URL;
  if (!url) throw new Error('GAS_URL secret not configured.');

  if (method === 'GET') {
    const qs = new URLSearchParams({
      ...params,
      secret: env.GAS_SECRET,
    });
    const res = await fetch(`${url}?${qs}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  }

  // POST
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, secret: env.GAS_SECRET }),
  });
  return res.json();
}

// ============================================================
//  ROUTE HANDLERS
// ============================================================

// POST /api/order/create
async function handleOrderCreate(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return { status: 'error', message: 'Invalid JSON body.' }; }

  // Validate required fields
  const { order_id, customer_name, phone_number, email, address,
          pincode, product_id, product_name, quantity,
          product_price, total_amount, payment_id, payment_status } = body;

  if (!validateOrderId(order_id))
    return { status: 'error', message: 'Invalid order_id format.' };
  if (!validatePhone(phone_number))
    return { status: 'error', message: 'Invalid phone number.' };
  if (!validateEmail(email))
    return { status: 'error', message: 'Invalid email address.' };
  if (!validatePincode(pincode))
    return { status: 'error', message: 'Invalid pincode.' };
  if (!product_id || !product_name)
    return { status: 'error', message: 'Missing product info.' };
  if (typeof total_amount !== 'number' || total_amount < 0 || isNaN(total_amount))
    return { status: 'error', message: 'Invalid total amount.' };

  const sanitisedData = {
    order_id:       sanitise(order_id, 30),
    date_time:      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    customer_name:  sanitise(customer_name, 100),
    phone_number:   sanitise(phone_number, 10),
    email:          sanitise(email, 150),
    address:        sanitise(address, 300),
    pincode:        sanitise(pincode, 6),
    product_id:     sanitise(product_id, 50),
    product_name:   sanitise(product_name, 150),
    quantity:       Math.max(1, Math.min(100, parseInt(quantity) || 1)),
    product_price:  parseFloat(product_price) || 0,
    total_amount:   parseFloat(total_amount),
    payment_id:     sanitise(payment_id || '', 100),
    payment_status: ['Pending', 'Paid', 'Failed'].includes(payment_status)
                      ? payment_status : 'Pending',
    // ── Invoice fields (safe passthrough) ──
    hsn_code:         sanitise(body.hsn_code        || '', 20),
    discount:         parseFloat(body.discount)         || 0,
    coupon_discount:  parseFloat(body.coupon_discount)  || 0,
    shipping_charges: parseFloat(body.shipping_charges) || 0,
    gst_rate:         parseFloat(body.gst_rate)         || 0,
    gst_amount:       parseFloat(body.gst_amount)       || 0,
  };

  return callGAS(env, 'POST', { data: sanitisedData });
}

// GET /api/order/lookup?orderId=XXX&phone=XXXXXXXXXX
async function handleOrderLookup(request, env) {
  const url     = new URL(request.url);
  const orderId = (url.searchParams.get('orderId') || '').trim();
  const phone   = (url.searchParams.get('phone')   || '').trim();

  if (!validateOrderId(orderId))
    return { status: 'error', message: 'Invalid Order ID format.' };
  if (!validatePhone(phone))
    return { status: 'error', message: 'Invalid phone number.' };

  return callGAS(env, 'GET', { action: 'getOrder', orderId, phone });
}

// GET /api/invoice/lookup?orderId=XXX
async function handleInvoiceLookup(request, env) {
  const url     = new URL(request.url);
  const orderId = (url.searchParams.get('orderId') || '').trim();

  if (!validateOrderId(orderId))
    return { status: 'error', message: 'Invalid Order ID format.' };

  return callGAS(env, 'GET', { action: 'getInvoice', orderId });
}

// POST /api/order/update
async function handleOrderUpdate(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return { status: 'error', message: 'Invalid JSON body.' }; }

  const { orderId, newStatus, reason, comment } = body;

  if (!validateOrderId(orderId))
    return { status: 'error', message: 'Invalid order_id.' };

  const allowedStatuses = [
    'Requested Return', 'Requested Cancellation',
    'Cancelled', 'Return Request Approved', 'Return Received',
  ];
  if (!allowedStatuses.includes(newStatus))
    return { status: 'error', message: 'Invalid status value.' };

  return callGAS(env, 'POST', {
    action: 'updateReturnCancel',
    data: {
      orderId:   sanitise(orderId, 30),
      newStatus: sanitise(newStatus, 50),
      reason:    sanitise(reason   || '', 200),
      comment:   sanitise(comment  || '', 500),
    },
  });
}

// GET /api/shipping/lookup
// Reads the "Pin code and Shipping Charges" sheet via Apps Script
// and returns all rules as [{ pincode, packSize, charge }, ...]
// No sensitive data; no auth required beyond CORS origin check.
async function handleShippingLookup(request, env) {
  return callGAS(env, 'GET', { action: 'getShippingCharges' });
}

// ============================================================
//  MAIN FETCH HANDLER
// ============================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsH  = getCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH });
    }

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return errorResponse('Too many requests. Please slow down.', 429, corsH);
    }

    const url      = new URL(request.url);
    const pathname = url.pathname;

    let result;
    try {
      if (pathname === '/api/order/create' && request.method === 'POST') {
        result = await handleOrderCreate(request, env);

      } else if (pathname === '/api/order/lookup' && request.method === 'GET') {
        result = await handleOrderLookup(request, env);

      } else if (pathname === '/api/invoice/lookup' && request.method === 'GET') {
        result = await handleInvoiceLookup(request, env);

      } else if (pathname === '/api/order/update' && request.method === 'POST') {
        result = await handleOrderUpdate(request, env);

      } else if (pathname === '/api/shipping/lookup' && request.method === 'GET') {
        result = await handleShippingLookup(request, env);

      } else {
        return errorResponse('Not found.', 404, corsH);
      }
    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse('Internal server error.', 500, corsH);
    }

    const httpStatus = result.status === 'error' ? 400 : 200;
    return jsonResponse(result, httpStatus, corsH);
  },
};
