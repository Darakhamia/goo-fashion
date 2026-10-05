module.exports = {
  routes: {
    "GET /api/admin/me": { isAdmin: true, isSuperAdmin: true, email: "admin@example.com", userId: "user_harness_admin" },
    "GET /api/exchange-rates": { base: "USD", rates: { USD: 1, EUR: 0.92, GBP: 0.79, UAH: 41.2 } },
    "GET /api/user/likes": { products: [], outfits: [] },
    "POST /api/analytics/pageview": { ok: true },
    "POST /api/analytics/web-vitals": { ok: true },
  },
};
