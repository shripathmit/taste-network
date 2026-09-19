/* Taste Network — misc views: give, how, profile, credits, legal, 404 */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store, auth = TN.auth;

  TN.views.give = function(){
    const tests = S.liveLinkTests();
    const app = document.getElementById("app");
    app.innerHTML = '<div class="wrap"><h2>Give feedback</h2>'+
      '<p class="lede">Real people, real judgment. Pick a test, compare the options, and say what resonates — and why.</p>'+
      (tests.length ? '<div class="card-grid mt">'+tests.map(t=>{
        const n = S.responseCount(t.id);
        const goal = (TN_CONFIG.goals.find(g=>g.id===t.goal)||{}).label;
        return '<div class="card"><p class="eyebrow">'+ui.esc(goal||"")+'</p>'+
          '<h3>'+ui.esc(t.title)+'</h3>'+
          '<p class="small">'+t.variations.length+' options · '+n+' response'+(n===1?"":"s")+' so far</p>'+
          '<a class="btn btn-primary btn-sm" href="#/t/'+t.publicId+'">Weigh in</a></div>';
      }).join("")+'</div>'
      : '<div class="empty-state"><h3>Nothing open right now</h3><p>When creators share open tests, they’ll appear here.</p></div>')+
      '</div>';
  };

  TN.views.how = function(){
    document.getElementById("app").innerHTML =
    '<div class="wrap"><p class="eyebrow">How it works</p><h2>Human judgment, structured well</h2>'+
    '<div class="how-grid">'+
    '<div class="step-card"><div class="step-num">1</div><h3>Creators add variations</h3><p>Two to five versions of a name, headline, design, or pitch — plus the question they want answered and the lens (clarity, trust, curiosity…) to judge it through.</p></div>'+
    '<div class="step-card"><div class="step-num">2</div><h3>People compare and explain</h3><p>Respondents see options in random order, pick one (or “none of these”), and write <em>why</em>. Every response includes a choice and a reason — no account needed.</p></div>'+
    '<div class="step-card"><div class="step-num">3</div><h3>Creators read and decide</h3><p>Results show what resonated and why, with disagreement kept visible. The creator makes the final call — always.</p></div>'+
    '</div>'+
    '<h3>What AI does and doesn’t do here</h3>'+
    '<div class="two-col"><div class="panel"><h4>AI may help with</h4><ul class="small">'+
    '<li>Turning a vague draft into a clearer feedback question</li>'+
    '<li>Detecting spam or repeated responses</li>'+
    '<li>Grouping comments by theme — always labeled <em>“Organized themes from human feedback”</em></li>'+
    '<li>Moderating abusive content</li></ul></div>'+
    '<div class="panel"><h4>AI never</h4><ul class="small">'+
    '<li>Casts a vote or picks a winner</li>'+
    '<li>Claims an option is objectively better</li>'+
    '<li>Imitates or invents human feedback</li>'+
    '<li>Presents a summary as its own judgment</li></ul></div></div>'+
    '<div class="center mt"><a class="btn btn-primary" href="#/signup">Create a test</a> <a class="btn btn-secondary" href="#/give">Give feedback</a></div></div>';
  };

  TN.views.profile = function(){
    const user = auth.currentUser();
    const app = document.getElementById("app");
    app.innerHTML = '<div class="wrap-narrow"><div class="card" style="max-width:520px;margin:1rem auto">'+
      '<h2>Profile</h2><div id="form-err"></div>'+
      '<div class="field"><label for="p-name">Name</label><input id="p-name" type="text" value="'+ui.esc(user.name)+'"></div>'+
      '<div class="field"><label>Email</label><input type="email" value="'+ui.esc(user.email)+'" disabled><p class="hint">Email can’t be changed on this MVP.</p></div>'+
      '<div class="field"><label>I’m here to…</label><div class="radio-cards">'+
      [["creator","I want feedback"],["taster","I like giving feedback"],["both","Both"]].map(([v,l])=>
        '<button type="button" class="radio-card'+(user.role===v?" selected":"")+'" data-role="'+v+'"><div class="t">'+l+'</div></button>').join("")+'</div></div>'+
      '<button class="btn btn-primary" id="p-save">Save changes</button>'+
      '<div class="divider"></div>'+
      '<p class="small">Feedback credits: <strong>'+S.creditBalance(user.id)+'</strong> · <a href="#/credits">View ledger</a></p>'+
      (auth.isAdmin(user)?'<p class="small"><a href="#/admin">Open admin view</a></p>':"")+
      '</div></div>';
    let role = user.role;
    app.querySelectorAll("[data-role]").forEach(b=>{ b.onclick=()=>{ role=b.dataset.role;
      app.querySelectorAll("[data-role]").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); }; });
    document.getElementById("p-save").onclick = ()=>{
      const name = document.getElementById("p-name").value.trim();
      if (!name){ document.getElementById("form-err").innerHTML='<div class="form-error">Name can’t be empty.</div>'; return; }
      auth.updateProfile(user.id,{name,role});
      ui.toast("Profile saved."); TN.router.render();
    };
  };

  TN.views.credits = function(){
    const user = auth.currentUser();
    const bal = S.creditBalance(user.id);
    const hist = S.creditHistory(user.id);
    const flag = TN_CONFIG.flags.creditsRequired;
    document.getElementById("app").innerHTML = '<div class="wrap-narrow"><div class="panel" style="max-width:640px;margin:1rem auto">'+
      '<p class="eyebrow">Credits</p><h2>'+bal+' credit'+(bal===1?"":"s")+'</h2>'+
      '<p class="small">Thoughtful feedback earns credits. One day, credits will unlock test creation and paid contributor pools — <strong>for now they’re purely a thank-you and never block anything.</strong></p>'+
      (flag
        ? '<div class="demo-banner">Credit requirements are ON (admin flag). Publishing a test costs 1 credit per 5 responses requested.</div>'
        : '<div class="form-note"><strong>Credits coming soon.</strong> Paid tests and contributor payouts aren’t part of this version. The ledger below is ready for when they are — it’s built to support Stripe payments later.</div>')+
      '<h3>Ledger</h3>'+
      (hist.length? '<table class="admin-table"><thead><tr><th>When</th><th>Change</th><th>Reason</th></tr></thead><tbody>'+
        hist.map(c=>'<tr><td>'+ui.timeAgo(c.createdAt)+'</td><td>'+(c.delta>0?"+":"")+c.delta+'</td><td>'+ui.esc(c.reason)+'</td></tr>').join("")+'</tbody></table>'
        : '<p class="small">No credit activity yet. <a href="#/give">Give feedback</a> on an open test to earn your first credit.</p>')+
      '</div></div>';
  };

  TN.views.privacy = function(){
    document.getElementById("app").innerHTML = '<div class="wrap"><div class="legal"><h2>Privacy</h2>'+
      '<p class="small">Last updated September 2026. This is a concise MVP policy — the short version is: we collect as little as possible.</p>'+
      '<h3>What we collect</h3><p class="small">Your account (name, email), the tests you create, and the responses you submit. For open-link tests we store a lightweight browser fingerprint to enforce one response per person — no tracking pixels, no ad profiles.</p>'+
      '<h3>What we don’t do</h3><p class="small">We don’t sell your data. We don’t show your responses publicly. We don’t use AI to judge your options or to fabricate feedback.</p>'+
      '<h3>Respondent anonymity</h3><p class="small">Creators choose whether respondent names are visible to them. Admins may review flagged responses for safety. You can ask us to delete your data at '+TN_CONFIG.supportEmail+'.</p>'+
      '</div></div>';
  };

  TN.views.terms = function(){
    document.getElementById("app").innerHTML = '<div class="wrap"><div class="legal"><h2>Terms</h2>'+
      '<p class="small">Last updated September 2026.</p>'+
      '<h3>The basics</h3><p class="small">Taste Network helps you collect human feedback on work you’re deciding whether to ship. You own your content; you grant us a license to host it so respondents can see it.</p>'+
      '<h3>Be human</h3><p class="small">No spam, no bots, no abuse. Responses may be flagged and hidden. Creators decide what ships — feedback here is input, not a binding vote.</p>'+
      '<h3>Credits</h3><p class="small">Feedback credits have no cash value in this version and can’t be transferred or redeemed.</p>'+
      '<h3>Contact</h3><p class="small">Questions: '+TN_CONFIG.supportEmail+'</p>'+
      '</div></div>';
  };

  TN.views.notFound = function(msg){
    document.getElementById("app").innerHTML = '<div class="wrap-narrow"><div class="card center" style="max-width:440px;margin:3rem auto">'+
      '<h2>Not found</h2><p class="small">'+ui.esc(msg||"That page doesn’t exist.")+'</p>'+
      '<a class="btn btn-primary" href="#/">Back home</a></div></div>';
  };
})();
