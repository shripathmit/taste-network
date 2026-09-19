/* Taste Network — Node smoke harness.
   Loads every app JS file in browser order with a stubbed DOM + mocked
   Supabase client, hydrates realistic rows, then renders all views.
   Run: node tests/smoke.js   (exit 0 = all views render clean) */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/* ---------- stub DOM ---------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || "DIV").toUpperCase(),
    _html: "",
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [],
    parentNode: null,
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html; },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertAdjacentHTML() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    closest() { return makeEl(); },
    focus() {}, click() {}, select() {}, remove() {},
  };
  return el;
}
const appEl = makeEl("main");
const els = { app: appEl, "site-header": makeEl(), "site-footer": makeEl(), "toast-root": makeEl(), "modal-root": makeEl(), "form-err": makeEl() };
global.document = {
  getElementById: (id) => els[id] || makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: (t) => makeEl(t),
  addEventListener: () => {},
  body: makeEl("body"),
  documentElement: makeEl("html"),
};
global.window = global;
global.window.scrollTo = () => {};
global.location = { hash: "#/", origin: "http://localhost", pathname: "/" };
Object.defineProperty(global, "navigator", { value: { clipboard: null }, configurable: true });
const _ls = {};
global.localStorage = {
  getItem: (k) => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: (k) => { delete _ls[k]; },
};

/* ---------- load app files in browser order ---------- */
const files = [
  "assets/js/config.js", "assets/js/ui.js", "assets/js/sb.js", "assets/js/store.js",
  "assets/js/auth.js", "assets/js/seed.js",
  "assets/js/views/landing.js", "assets/js/views/auth.js", "assets/js/views/dashboard.js",
  "assets/js/views/wizard.js", "assets/js/views/respond.js", "assets/js/views/results.js",
  "assets/js/views/admin.js", "assets/js/views/misc.js", "assets/js/router.js",
];
for (const f of files) {
  const code = fs.readFileSync(path.join(ROOT, f), "utf8");
  vm.runInThisContext(code, { filename: f });
}

/* ---------- mock Supabase ---------- */
const now = Date.now();
const iso = (ts) => new Date(ts).toISOString();
const mockRows = {
  tests: [{
    id: "t_demo0001", public_id: "demo0001", owner_id: "u_admin", title: "Which landing-page headline is clearest?",
    type: "headline", context: "Homepage hero.", question: "Which headline makes this product clearest?",
    goal: "clarity", variations: [
      { id: "v_a", label: "Option A", text: "Clarity for complex products.", imageUrl: "", externalUrl: "" },
      { id: "v_b", label: "Option B", text: "We make the complex clear.", imageUrl: "", externalUrl: "" },
    ],
    config: { targetResponses: 15, access: "link", invitedEmails: [], anonymous: "visible", deadline: 0, requireReason: true },
    status: "live", created_at: iso(now - 3 * 864e5), published_at: iso(now - 3 * 864e5), closed_at: null, decision: null,
  }],
  responses: [{
    id: "r_1", test_id: "t_demo0001", session_fp: "fp1", choice: "v_a",
    reason: "Says what it is and who it is for. No guessing.", followup: "A clarity tool.",
    confidence: "very", order_shown: ["v_a", "v_b"], duration_ms: 91000, created_at: iso(now - 864e5),
    respondent_name: "Maya", respondent_email: "", want_more_feedback: false,
    flags: [], moderation: { status: "valid", creatorMark: null },
  }],
  credit_ledger: [{ id: "cr_1", user_id: "u_admin", delta: 1, reason: "Thoughtful feedback", created_at: iso(now - 864e5) }],
  profiles: [
    { id: "u_admin", email: "admin@taste.network", name: "Admin", role: "creator", is_admin: true, created_at: iso(now - 30 * 864e5) },
    { id: "u_2", email: "taster@example.com", name: "Tess", role: "taster", is_admin: false, created_at: iso(now - 864e5) },
  ],
};
function q(rows) {
  const chain = {
    select() { return chain; }, order() { return chain; }, limit() { return chain; },
    eq() { return chain; },
    upsert() { return Promise.resolve({ error: null }); },
    insert() { return Promise.resolve({ error: null }); },
    update() { return Promise.resolve({ error: null }); },
    then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
  };
  return chain;
}
TN.sb.configured = () => true;
TN.sb.client = () => ({
  from: (t) => q(mockRows[t] || []),
  rpc: () => Promise.resolve({ data: [], error: null }),
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => {} },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "http://x/y.jpg" } }) }) },
});
// signed-in admin user
TN.auth.currentUser = () => ({ id: "u_admin", email: "admin@taste.network", name: "Admin", role: "creator", is_admin: true });

/* ---------- run ---------- */
(async () => {
  const failures = [];
  await TN.store.refresh();
  const V = TN.views;
  const cases = [
    ["landing", () => V.landing()],
    ["login", () => V.login()],
    ["signup", () => V.signup()],
    ["magicSent", () => { global.location.hash = "#/magic?e=a@b.c"; V.magicSent(); }],
    ["onboarding", () => V.onboarding()],
    ["dashboard", () => V.dashboard()],
    ["wizard", () => V.wizard()],
    ["respond", () => V.respond("demo0001")],
    ["results", () => V.results("t_demo0001")],
    ["demoResults", () => V.demoResults()],
    ["give", () => V.give()],
    ["how", () => V.how()],
    ["profile", () => V.profile()],
    ["credits", () => V.credits()],
    ["admin", () => V.admin()],
    ["privacy", () => V.privacy()],
    ["terms", () => V.terms()],
    ["notFound", () => V.notFound("x")],
    ["published", () => V.published("t_demo0001")],
    ["respond-closed", () => {
      const t = TN.store.getTest("t_demo0001"); const s = t.status; t.status = "closed";
      try { V.respond("demo0001"); } finally { t.status = s; }
    }],
  ];
  for (const [name, fn] of cases) {
    try { await fn(); console.log("  ok  " + name); }
    catch (e) { failures.push(name + ": " + (e && e.stack || e)); console.log("  FAIL " + name); }
  }
  console.log("\n" + (cases.length - failures.length) + " passed, " + failures.length + " failed");
  if (failures.length) { console.log(failures.join("\n\n")); process.exit(1); }
})();
