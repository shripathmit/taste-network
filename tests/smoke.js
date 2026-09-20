/* Taste Network — Node smoke harness (extended for review gate + code sign-in).
   Loads every app JS file in browser order with a stubbed DOM + mocked
   Supabase client, hydrates realistic rows, renders all views, then asserts
   the review-gate and email-code behaviors.
   Run: node tests/smoke.js   (exit 0 = all green) */
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
    review_status: "approved",
  }, {
    id: "r_2", test_id: "t_demo0001", session_fp: "fp2", choice: "v_b",
    reason: "Feels more human and warm.", followup: "",
    confidence: "somewhat", order_shown: ["v_b", "v_a"], duration_ms: 45000, created_at: iso(now - 432e5),
    respondent_name: "", respondent_email: "", want_more_feedback: false,
    flags: [], moderation: { status: "valid", creatorMark: null },
    review_status: "pending",
  }],
  credit_ledger: [{ id: "cr_1", user_id: "u_admin", delta: 1, reason: "Thoughtful feedback", created_at: iso(now - 864e5) }],
  profiles: [
    { id: "u_admin", email: "admin@taste.network", name: "Admin", role: "creator", is_admin: true, created_at: iso(now - 30 * 864e5) },
    { id: "u_2", email: "taster@example.com", name: "Tess", role: "taster", is_admin: false, created_at: iso(now - 864e5) },
  ],
};
const capturedUpdates = [];
const otpCalls = [];
let capturedSubmit = null;
function q(table, rows) {
  const chain = {
    select() { return chain; }, order() { return chain; }, limit() { return chain; },
    eq() { return chain; },
    maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
    upsert() { return Promise.resolve({ error: null }); },
    insert() { return Promise.resolve({ error: null }); },
    update(payload) {
      capturedUpdates.push({ table, payload });
      return { eq: () => Promise.resolve({ error: null }) };
    },
    then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
  };
  return chain;
}
TN.sb.configured = () => true;
TN.sb.client = () => ({
  from: (t) => q(t, mockRows[t] || []),
  rpc: (name) => {
    if (name === "pending_review_counts")
      return Promise.resolve({ data: [{ test_id: "t_demo0001", n: 1 }], error: null });
    if (name === "live_response_counts")
      return Promise.resolve({ data: [{ test_id: "t_demo0001", n: 1 }], error: null });
    return Promise.resolve({ data: [], error: null });
  },
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => {},
    signInWithOtp: async (args) => { otpCalls.push({ kind: "send", args }); return { error: null }; },
    verifyOtp: async (args) => {
      otpCalls.push({ kind: "verify", args });
      return { data: { user: { id: "u_new", email: args.email, user_metadata: {} } }, error: null };
    },
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "http://x/y.jpg" } }) }) },
});
// stub server endpoint for addResponse
global.fetch = async (url, opts) => {
  if (String(url).includes("/api/submit-response")) {
    capturedSubmit = JSON.parse(opts.body);
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ ok: true, id: "r_new" }) };
  }
  throw new Error("unexpected fetch " + url);
};
// signed-in admin user
TN.auth.currentUser = () => ({ id: "u_admin", email: "admin@taste.network", name: "Admin", role: "creator", is_admin: true });

/* ---------- assertions ---------- */
let passed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log("  ok  " + label); }
  else { console.log("  FAIL " + label); process.exitCode = 1; }
}

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
    try { await fn(); console.log("  ok  render " + name); passed++; }
    catch (e) { failures.push(name + ": " + (e && e.stack || e)); console.log("  FAIL render " + name); }
  }

  // review gate: pending response is hidden from public/creator views
  const forTest = TN.store.responsesFor("t_demo0001");
  assert(forTest.length === 1 && forTest[0].id === "r_1", "responsesFor hides pending");
  assert(TN.store.visibleResponsesFor("t_demo0001").length === 1, "visibleResponsesFor hides pending");
  assert(TN.store.responseCount("t_demo0001") === 1, "responseCount uses server count (approved only)");
  assert(TN.store.pendingCount("t_demo0001") === 1, "pendingCount from pending_review_counts RPC");

  // review_status mapping on load
  const r2 = TN.store.getResponses().find(x => x.id === "r_2");
  assert(r2 && r2.reviewStatus === "pending", "review_status mapped to reviewStatus");

  // addResponse goes to /api/submit-response with captcha token, stored as pending
  const newR = {
    id: "r_new", testId: "t_demo0001", sessionFp: "fpX", choice: "v_a",
    reason: "A clear and specific reason.", followup: "", confidence: "very",
    durationMs: 5000, orderShown: ["v_a", "v_b"], flags: [],
    moderation: { status: "valid", creatorMark: null },
    respondentName: "T", respondentEmail: "",
  };
  await TN.store.addResponse(newR, "captcha-token-123");
  assert(capturedSubmit && capturedSubmit.captchaToken === "captcha-token-123", "addResponse sends captcha token to server");
  assert(capturedSubmit && capturedSubmit.testId === "t_demo0001", "addResponse sends testId");
  assert(capturedSubmit && capturedSubmit.reason === "A clear and specific reason.", "addResponse sends clamped fields");
  const cached = TN.store.getResponses().find(x => x.id === "r_new");
  assert(!cached, "new pending submission stays out of the local cache (invisible until approved)");
  assert(TN.store.hasResponded("t_demo0001"), "addResponse marks test as responded");
  assert(TN.store.responsesFor("t_demo0001").length === 1, "new pending response hidden from counts");

  // updateResponse persists review_status (admin approve)
  capturedUpdates.length = 0;
  r2.reviewStatus = "approved";
  await TN.store.updateResponse(r2);
  assert(capturedUpdates.some(u => u.table === "responses" && u.payload.review_status === "approved"),
    "updateResponse writes review_status");

  // email code sign-in
  await TN.auth.requestEmailCode("New@Example.com");
  const sendCall = otpCalls.find(c => c.kind === "send");
  assert(sendCall && sendCall.args.email === "new@example.com", "requestEmailCode normalizes email + calls signInWithOtp");
  let badCode = null;
  try { await TN.auth.verifyEmailCode("new@example.com", "12"); } catch (e) { badCode = e; }
  assert(badCode && /6-digit/.test(badCode.message), "verifyEmailCode rejects malformed code");
  const res = await TN.auth.verifyEmailCode("new@example.com", "123456");
  const verifyCall = otpCalls.find(c => c.kind === "verify");
  assert(verifyCall && verifyCall.args.token === "123456" && verifyCall.args.type === "email",
    "verifyEmailCode calls verifyOtp with type email");
  assert(res && res.user && res.user.id === "u_new", "verifyEmailCode returns signed-in user");

  console.log("\n" + passed + " passed" + (failures.length ? ", " + failures.length + " render failures" : ""));
  if (failures.length) { console.log(failures.join("\n\n")); process.exit(1); }
  if (process.exitCode) process.exit(1);
})();
