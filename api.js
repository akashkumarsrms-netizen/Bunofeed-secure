/**
 * ============================================================
 *  BUNOFEED — API Configuration  (api.js)
 *
 *  This is the ONLY file you need to change when you deploy
 *  your Cloudflare Worker. Replace the URL below with your
 *  actual Worker URL after deployment.
 *
 *  ✅ NO secrets here — just the public Worker endpoint.
 *  ✅ The Worker holds all secrets (GAS_URL, GAS_SECRET).
 * ============================================================
 */

window.BUNOFEED_API = {

  // ── Replace this with your Cloudflare Worker URL after deploying ──
  // Example: "https://bunofeed-api.YOUR-USERNAME.workers.dev"
  BASE_URL: 'https://bunofeed-api.YOUR-USERNAME.workers.dev',

  // ── API Endpoints ──
  endpoints: {
    createOrder: '/api/order/create',   // POST — save new order
    lookupOrder: '/api/order/lookup',   // GET  — fetch order by ID + phone
    updateOrder: '/api/order/update',   // POST — update return/cancel status
  },

  // ── Helper: full URL builder ──
  url(endpoint) {
    return this.BASE_URL + this.endpoints[endpoint];
  },

  // ── Helper: POST JSON ──
  async post(endpoint, body) {
    const res = await fetch(this.url(endpoint), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    return res.json();
  },

  // ── Helper: GET with query params ──
  async get(endpoint, params = {}) {
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(`${this.url(endpoint)}?${qs}`);
    return res.json();
  },
};
