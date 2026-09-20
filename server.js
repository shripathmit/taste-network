// Taste Network — static file server + response submission API (Railway / any Node host).
//
// Response inserts used to go straight from the browser to Supabase. They now
// go through POST /api/submit-response, which:
//   1. verifies a Cloudflare Turnstile CAPTCHA token server-side (optional —
//      skipped when TURNSTILE_SECRET_KEY isn't set; throttling still applies),
//   2. re-enforces the throttle bounds (10 responses / 10 min per browser
//      fingerprint, 60 / 5 min per test — the migration-003 RPC),
//   3. inserts the response as review_status='pending' with the service-role
//      key, so it stays invisible until an admin approves it.
//
// Env vars (Railway -> Variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY   (existing; anon key is public by design)
//   SUPABASE_SERVICE_KEY              (new; server-side only, never shipped)
//   TURNSTILE_SITE_KEY                (optional; public, injected into the page)
//   TURNSTILE_SECRET_KEY              (optional; server-side only)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const SB_URL = process.env.SUPABASE_URL || '';
const SB_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || '';
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
// CAPTCHA is optional: without a secret key the endpoint still works,
// protected only by the throttle bounds + the admin review gate.
const CAPTCHA_ON = !!TURNSTILE_SECRET_KEY;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

/* ---------- helpers ---------- */

function json(res, code, obj){
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJson(req){
  return new Promise((resolve, reject)=>{
    let size = 0; const chunks = [];
    req.on('data', c=>{ size += c.length; chunks.push(c);
      if (size > 256*1024){ reject(new Error('too large')); req.destroy(); } });
    req.on('end', ()=>{ try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch(e){ reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

function clientIp(req){
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

// Supabase REST with the service-role key (bypasses RLS; server only).
// NOTE: headers merge explicitly — a caller's {headers} must ADD to the
// auth headers, never replace them (shallow Object.assign would drop apikey).
async function sbFetch(pathname, opts){
  const o = opts || {};
  const res = await fetch(SB_URL + '/rest/v1/' + pathname, Object.assign({
    method: 'GET',
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: 'Bearer ' + SB_SERVICE_KEY,
      'Content-Type': 'application/json'
    }
  }, o, {
    headers: Object.assign({
      apikey: SB_SERVICE_KEY,
      Authorization: 'Bearer ' + SB_SERVICE_KEY,
      'Content-Type': 'application/json'
    }, o.headers || {})
  }));
  return res;
}

async function verifyTurnstile(token, ip){
  if (!TURNSTILE_SECRET_KEY || !token) return false;
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body
    });
    const data = await res.json();
    return !!data.success;
  } catch(e){ return false; }
}

const str = (v, max)=> String(v == null ? '' : v).slice(0, max);

/* ---------- POST /api/submit-response ---------- */

async function handleSubmitResponse(req, res){
  if (!SB_URL || !SB_SERVICE_KEY){
    return json(res, 503, { error: 'not_configured' });
  }
  let b;
  try { b = await readJson(req); }
  catch(e){ return json(res, 400, { error: 'bad_request' }); }

  // Validate + clamp every field (defense in depth; the client validates too).
  const id = str(b.id, 64);
  const testId = str(b.testId, 64);
  const sessionFp = str(b.sessionFp, 64);
  const choice = str(b.choice, 64);
  const reason = str(b.reason, 2000);
  const followup = str(b.followup, 2000);
  const confidence = str(b.confidence, 16);
  const respondentName = str(b.respondentName, 60);
  const respondentEmail = str(b.respondentEmail, 254);
  const flags = Array.isArray(b.flags) ? b.flags.map(f=>str(f,32)).slice(0,8) : [];
  const orderShown = Array.isArray(b.orderShown) ? b.orderShown.map(v=>str(v,32)).slice(0,10) : [];
  const durationMs = Math.max(0, Math.min(3600000, parseInt(b.durationMs, 10) || 0));
  const moderation = (b.moderation && typeof b.moderation === 'object')
    ? { status: str(b.moderation.status, 16) || 'valid', creatorMark: null }
    : { status: 'valid', creatorMark: null };

  if (!/^r_[A-Za-z0-9_-]+$/.test(id) || !testId || !/^fp_[a-z0-9]+$/.test(sessionFp) ||
      !choice || !reason.trim() || (CAPTCHA_ON && !b.captchaToken)){
    return json(res, 400, { error: 'bad_request' });
  }

  // 1. CAPTCHA first — no point touching the DB for bots.
  //    Skipped entirely when Turnstile isn't configured.
  if (CAPTCHA_ON){
    const human = await verifyTurnstile(String(b.captchaToken || ''), clientIp(req));
    if (!human) return json(res, 400, { error: 'captcha' });
  }

  try {
    // 2. The test must be live and not the demo seed.
    const tRes = await sbFetch('tests?id=eq.' + encodeURIComponent(testId) + '&select=id,status,is_demo');
    if (!tRes.ok) throw new Error('test lookup failed');
    const tests = await tRes.json();
    const t = tests && tests[0];
    if (!t || t.status !== 'live' || t.is_demo){
      return json(res, 400, { error: 'closed' });
    }

    // 3. Server-side throttle (same bounds as migration 003).
    const thRes = await sbFetch('rpc/response_throttle_ok', {
      method: 'POST',
      body: JSON.stringify({ p_test_id: testId, p_fp: sessionFp })
    });
    if (!thRes.ok) throw new Error('throttle check failed');
    if (!(await thRes.json())){
      return json(res, 429, { error: 'throttled' });
    }

    // 4. Insert as pending — invisible until an admin approves it.
    const row = {
      id, test_id: testId, session_fp: sessionFp,
      choice, reason: reason.trim(), followup: followup.trim(),
      confidence: confidence || null,
      order_shown: orderShown, duration_ms: durationMs,
      created_at: new Date().toISOString(),
      respondent_name: respondentName, respondent_email: respondentEmail,
      respondent_id: null,
      want_more_feedback: !!b.wantMoreFeedback,
      flags, moderation, demo: false,
      review_status: 'pending'
    };
    const iRes = await sbFetch('responses', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });
    if (iRes.status === 409){
      return json(res, 400, { error: 'duplicate' });
    }
    if (!iRes.ok) throw new Error('insert failed: ' + iRes.status);
    return json(res, 200, { ok: true, id });
  } catch(e){
    console.error('submit-response:', e.message);
    return json(res, 500, { error: 'server_error' });
  }
}

/* ---------- static file serving ---------- */

function serveStatic(req, res){
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    let body = data;
    // Inject public config into the page from environment variables.
    // The anon key and Turnstile site key are public by design; they stay
    // out of git and are supplied via Railway env vars.
    if (file.endsWith('index.html')) {
      const env = {
        url: SB_URL,
        key: SB_ANON_KEY,
        turnstileSiteKey: TURNSTILE_SITE_KEY
      };
      body = Buffer.from(data.toString().replace(
        '<!--TN_ENV-->',
        '<script>window.TN_ENV=' + JSON.stringify(env) + '</script>'
      ));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  });
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && urlPath === '/api/submit-response'){
    handleSubmitResponse(req, res).catch(e=>{
      console.error('submit-response fatal:', e.message);
      json(res, 500, { error: 'server_error' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD'){
    res.writeHead(405); res.end('method not allowed'); return;
  }
  serveStatic(req, res);
}).listen(PORT, () => console.log('Taste Network listening on :' + PORT +
  ' | captcha ' + (CAPTCHA_ON ? 'on' : 'off (throttle + review gate only)')));
