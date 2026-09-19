/* Taste Network — misc views: give, how, profile, credits, legal, 404 */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store, auth = TN.auth;

  TN.views.give = function(){
    const tests = S.liveLinkTests();
    const app = document.getElementById("app");
    const arts = ["assets/img/band-abstract.jpg","assets/img/hero-abstract.jpg","assets/img/orb-abstract.jpg"];
    app.innerHTML = '<div class="wrap"><h2>Give feedback</h2>'+
      '<p class="lede">Pick a test, compare the options, say what resonates — and why.</p>'+
      (tests.length ? '<div class="card-grid mt">'+tests.map((t,i)=>{
        const n = S.responseCount(t.id);
        const goal = (TN_CONFIG.goals.find(g=>g.id===t.goal)||{}).label;
        return '<div class="card give-card"><div class="give-art" style="background-image:url('+arts[i%arts.length]+')"></div>'+
          '<div class="give-body"><p class="eyebrow">'+ui.esc(goal||"")+'</p>'+
          '<h3>'+ui.esc(t.title)+'</h3>'+
          '<p class="small">'+t.variations.length+' options · '+n+' response'+(n===1?"":"s")+' so far</p>'+
          '<a class="btn btn-primary btn-sm" href="#/t/'+t.publicId+'">Weigh in</a></div></div>';
      }).join("")+'</div>'
      : '<div class="empty-state"><div class="empty-art" style="background-image:url(assets/img/orb-abstract.jpg)"></div><h3>Nothing open right now</h3><p>When creators share open tests, they’ll appear here.</p></div>')+
      '</div>';
  };

  TN.views.how = function(){
    document.getElementById("app").innerHTML =
    '<div class="wrap"><p class="eyebrow">How it works</p><h2>Human judgment, structured well</h2>'+
    '<div class="how-grid">'+
    '<div class="step-card"><div class="step-num">1</div><h3>Add variations</h3><p>Two to five versions — plus the question you want answered and the lens to judge it through.</p></div>'+
    '<div class="step-card"><div class="step-num">2</div><h3>People compare</h3><p>Options appear in random order. Each person picks one and writes <em>why</em>. No account needed.</p></div>'+
    '<div class="step-card"><div class="step-num">3</div><h3>You decide</h3><p>See what resonated and why, with disagreement kept visible. The final call is always yours.</p></div>'+
    '</div>'+
    '<h3>AI’s role here</h3>'+
    '<div class="two-col"><div class="panel"><h4>AI may</h4><ul class="small">'+
    '<li>Help phrase a clearer feedback question</li>'+
    '<li>Flag spam or duplicate responses</li>'+
    '<li>Group comments by theme — always labeled as such</li></ul></div>'+
    '<div class="panel"><h4>AI never</h4><ul class="small">'+
    '<li>Votes, picks a winner, or claims an option is better</li>'+
    '<li>Invents or imitates human feedback</li></ul></div></div>'+
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
      '<p class="small">Thoughtful feedback earns credits. For now they’re a thank-you — they don’t unlock or block anything.</p>'+
      (flag
        ? '<div class="demo-banner">Credit requirements are ON (admin flag). Publishing a test costs 1 credit per 5 responses requested.</div>'
        : "")+
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
