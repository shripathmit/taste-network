/* Taste Network — data layer (Supabase/Postgres).
   Same API the views already use. Reads are synchronous from an in-memory
   cache hydrated at boot and refreshed on every route render; writes go to
   Supabase first, then update the cache. Write functions return promises —
   callers that need the result (e.g. response submit) await them, the rest
   treat them as fire-and-forget.
   Row mapping: Postgres uses snake_case, the app uses camelCase. */
window.TN = window.TN || {};
(function(){
  const ui = TN.ui;
  const R = (key)=> TN.sb.configured() ? TN.sb.client().from(key) : null;

  const cache = { tests: [], responses: [], credits: [], counts: {} };
  let readyResolve = null;
  const ready = new Promise(res => { readyResolve = res; });
  let refreshed = false;

  /* ---------- row mapping ---------- */
  const ms = iso => iso ? new Date(iso).getTime() : 0;
  const iso = t => t ? new Date(t).toISOString() : null;

  function testFromRow(r){
    return {
      id: r.id, publicId: r.public_id, ownerId: r.owner_id,
      title: r.title, type: r.type, context: r.context, question: r.question, goal: r.goal,
      variations: r.variations || [],
      config: r.config || {},
      status: r.status, createdAt: ms(r.created_at),
      publishedAt: ms(r.published_at), closedAt: ms(r.closed_at),
      decision: r.decision || null, isDemo: !!r.is_demo
    };
  }
  function testToRow(t, ownerId){
    return {
      id: t.id, public_id: t.publicId, owner_id: t.ownerId || ownerId || null,
      title: t.title, type: t.type, context: t.context, question: t.question, goal: t.goal,
      variations: t.variations || [], config: t.config || {}, status: t.status || "draft",
      created_at: iso(t.createdAt) || new Date().toISOString(),
      published_at: iso(t.publishedAt), closed_at: iso(t.closedAt),
      decision: t.decision || null
    };
  }
  function respFromRow(r){
    return {
      id: r.id, testId: r.test_id, sessionFp: r.session_fp,
      choice: r.choice, reason: r.reason, followup: r.followup, confidence: r.confidence,
      orderShown: r.order_shown || [], durationMs: r.duration_ms || 0,
      createdAt: ms(r.created_at),
      respondentName: r.respondent_name || "", respondentEmail: r.respondent_email || "",
      respondentId: r.respondent_id,
      wantMoreFeedback: !!r.want_more_feedback,
      flags: r.flags || [], moderation: r.moderation || { status: "valid", creatorMark: null },
      demo: !!r.demo
    };
  }
  function respToRow(r, respondentId){
    return {
      id: r.id, test_id: r.testId, session_fp: r.sessionFp,
      choice: r.choice, reason: r.reason, followup: r.followup, confidence: r.confidence,
      order_shown: r.orderShown || [], duration_ms: r.durationMs || 0,
      created_at: iso(r.createdAt) || new Date().toISOString(),
      respondent_name: r.respondentName || "", respondent_email: r.respondentEmail || "",
      respondent_id: respondentId || null,
      want_more_feedback: !!r.wantMoreFeedback,
      flags: r.flags || [], moderation: r.moderation || { status: "valid", creatorMark: null },
      demo: !!r.demo
    };
  }

  /* ---------- hydration ---------- */
  async function refresh(){
    if (!TN.sb.configured()){ if (!refreshed){ refreshed = true; readyResolve(); } return; }
    try {
      const [tRes, rRes, cRes] = await Promise.all([
        R("tests").select("*").order("created_at", { ascending: false }).limit(500),
        R("responses").select("*").order("created_at", { ascending: false }).limit(2000),
        R("credit_ledger").select("*").order("created_at", { ascending: false }).limit(500)
      ]);
      if (tRes.error) throw tRes.error;
      if (rRes.error) throw rRes.error;
      cache.tests = (tRes.data || []).map(testFromRow);
      cache.responses = (rRes.data || []).map(respFromRow);
      cache.credits = (cRes.data || []).map(c => ({
        id: c.id, userId: c.user_id, delta: c.delta, reason: c.reason, createdAt: ms(c.created_at)
      }));
      // public counts for live tests (content stays private under RLS)
      try {
        const { data, error } = await TN.sb.client().rpc("live_response_counts");
        if (!error && data) cache.counts = Object.fromEntries(data.map(r => [r.test_id, Number(r.n)]));
      } catch(e){ /* non-fatal */ }
    } catch(e){
      console.warn("Taste Network: refresh failed:", e.message);
    }
    if (!refreshed){ refreshed = true; readyResolve(); }
  }

  /* ---------- tests ---------- */
  function getTests(){ return cache.tests.slice(); }
  function saveTests(tests){
    // compat: replace cache and persist each (owner-scoped by RLS)
    tests.forEach(t => upsertTest(t).catch(e => console.warn("saveTests:", e.message)));
  }
  function getTest(id){ return cache.tests.find(t => t.id === id); }
  function getTestByPublicId(pid){ return cache.tests.find(t => t.publicId === pid); }
  async function upsertTest(test){
    const me = TN.auth && TN.auth.currentUser();
    const { error } = await R("tests").upsert(testToRow(test, me && me.id), { onConflict: "id" });
    if (error) throw new Error("Couldn’t save the test: " + error.message);
    const i = cache.tests.findIndex(t => t.id === test.id);
    if (i >= 0) cache.tests[i] = test; else cache.tests.unshift(test);
    return test;
  }
  function myTests(userId){
    return cache.tests.filter(t => t.ownerId === userId).sort((a,b)=>b.createdAt-a.createdAt);
  }
  function liveLinkTests(){
    const now = Date.now();
    return cache.tests.filter(t =>
      t.status === "live" && t.config.access === "link" &&
      (!t.config.deadline || t.config.deadline > now)
    ).sort((a,b)=>b.createdAt-a.createdAt);
  }

  /* ---------- responses ---------- */
  function getResponses(){ return cache.responses.slice(); }
  function saveResponses(rs){
    rs.forEach(r => updateResponse(r).catch(e => console.warn("saveResponses:", e.message)));
  }
  function responsesFor(testId){
    return cache.responses
      .filter(r => r.testId === testId && r.moderation.status !== "removed")
      .sort((a,b)=>b.createdAt-a.createdAt);
  }
  function visibleResponsesFor(testId){
    return responsesFor(testId).filter(r => r.moderation.status !== "hidden");
  }
  // Honest public count: server-side count for live tests, cache otherwise.
  function responseCount(testId){
    if (cache.counts && cache.counts[testId] != null) return cache.counts[testId];
    return responsesFor(testId).length;
  }
  async function addResponse(r){
    const me = TN.auth && TN.auth.currentUser();
    const { error } = await R("responses").insert(respToRow(r, me && me.id));
    if (error){
      if (error.code === "23505" || /duplicate/i.test(error.message))
        throw Object.assign(new Error("duplicate"), { tnDuplicate: true });
      throw new Error("Couldn’t save your response: " + error.message);
    }
    cache.responses.unshift(r);
    markResponded(r.testId);
    return r;
  }
  async function updateResponse(r){
    const { error } = await R("responses").update({ moderation: r.moderation, flags: r.flags })
      .eq("id", r.id);
    if (error) throw new Error("Couldn’t update the response: " + error.message);
    const i = cache.responses.findIndex(x => x.id === r.id);
    if (i >= 0) cache.responses[i] = r;
    return r;
  }
  // Post-submit "keep me in the loop" toggle. Respondents can't UPDATE rows
  // under RLS, so this goes through a narrow function that flips one flag.
  async function setWantMoreFeedback(responseId, value){
    if (!responseId || !TN.sb.configured()) return;
    const { error } = await TN.sb.client()
      .rpc("set_want_more_feedback", { p_response_id: responseId, p_value: !!value });
    if (error) console.warn("wantMore:", error.message);
    const r = cache.responses.find(x => x.id === responseId);
    if (r) r.wantMoreFeedback = !!value;
  }
  const RESP_KEY = "tn_responded_v1";  function respondedSet(){
    try { return new Set(JSON.parse(localStorage.getItem(RESP_KEY) || "[]")); }
    catch(e){ return new Set(); }
  }
  function markResponded(testId){
    const s = respondedSet(); s.add(testId);
    try { localStorage.setItem(RESP_KEY, JSON.stringify([...s])); } catch(e){}
  }
  function hasResponded(testId, fp){
    if (respondedSet().has(testId)) return true;
    return cache.responses.some(r => r.testId === testId && r.sessionFp === fp);
  }
  function duplicateReason(testId, reason){
    const norm = String(reason).trim().toLowerCase();
    return cache.responses.some(r => r.testId === testId && String(r.reason).trim().toLowerCase() === norm);
  }

  /* ---------- credits ---------- */
  function getCredits(){ return cache.credits.slice(); }
  async function addCredit(userId, delta, reason){
    const row = { id: ui.uid("cr_"), user_id: userId, delta, reason,
                  created_at: new Date().toISOString() };
    const { error } = await R("credit_ledger").insert(row);
    if (error) throw new Error("Couldn’t add credit: " + error.message);
    cache.credits.unshift({ id: row.id, userId, delta, reason, createdAt: Date.now() });
  }
  function creditBalance(userId){
    return cache.credits.filter(c => c.userId === userId).reduce((s,c)=>s+c.delta, 0);
  }
  function creditHistory(userId){
    return cache.credits.filter(c => c.userId === userId).sort((a,b)=>b.createdAt-a.createdAt);
  }
  // anonymous taster credits, claimable on signup (matched by email or device)
  function getPendingCredits(){ return []; }
  async function addPendingCredit(match, delta, reason){
    if (!TN.sb.configured()) return;
    const { error } = await R("pending_credits").insert({
      id: ui.uid("pc_"),
      match_email: String((match && match.email) || "").toLowerCase(),
      match_device: (match && match.device) || "",
      delta, reason
    });
    if (error) console.warn("pending credit:", error.message);
  }
  async function claimPendingCredits(/* user */){
    if (!TN.sb.configured()) return 0;
    const { data, error } = await TN.sb.client().rpc("claim_pending_credits", { p_device_id: deviceId() });
    if (error){ console.warn("claim:", error.message); return 0; }
    await refresh();
    return data || 0;
  }

  /* ---------- device ---------- */
  const DEV_KEY = "tn_device_v1";
  function deviceId(){
    let d = null;
    try { d = localStorage.getItem(DEV_KEY); } catch(e){}
    if (!d){ d = ui.uid("dev_"); try { localStorage.setItem(DEV_KEY, d); } catch(e){} }
    return d;
  }
  function fingerprint(){
    const parts = [
      navigator.userAgent || "",
      (screen.width||"")+"x"+(screen.height||""),
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      navigator.language || "",
      deviceId()
    ];
    let h = 5381;
    const s = parts.join("|");
    for (let i=0;i<s.length;i++){ h = ((h<<5)+h+s.charCodeAt(i))|0; }
    return "fp_"+(h>>>0).toString(36);
  }

  TN.store = {
    ready,
    refresh,
    getTests, saveTests, getTest, getTestByPublicId, upsertTest, myTests, liveLinkTests,
    getResponses, saveResponses, responsesFor, visibleResponsesFor, responseCount,
    addResponse, updateResponse, setWantMoreFeedback, hasResponded, duplicateReason,
    getCredits, addCredit, creditBalance, creditHistory,
    getPendingCredits, addPendingCredit, claimPendingCredits,
    deviceId, fingerprint
  };
})();
