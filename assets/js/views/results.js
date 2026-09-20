/* Taste Network — results dashboard */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store, auth = TN.auth;

  function nameFor(t, r){
    if (t.config.anonymous === "hidden") return "Anonymous";
    return r.respondentName ? ui.esc(r.respondentName) : "Anonymous";
  }
  function quoteCard(t, r, extra){
    return '<div class="quote'+(extra?" accent":"")+'">“'+ui.esc(r.reason)+'”'+
      (r.followup?'<div style="margin-top:.35rem;color:var(--ink-soft)">'+ui.esc(r.followup)+'</div>':"")+
      '<div class="q-meta">'+nameFor(t,r)+' · '+confidenceLabel(r.confidence)+
      (r.flags.length?' · <span class="flag-chip">'+r.flags.join(", ")+'</span>':"")+
      (r.moderation.creatorMark?' · marked '+r.moderation.creatorMark:'')+'</div>'+
      (extra||"")+'</div>';
  }
  function confidenceLabel(c){ return {not:"Not sure",somewhat:"Somewhat sure",very:"Very sure"}[c]||c; }

  function modControls(r){
    return '<div style="margin-top:.3rem;display:flex;gap:.4rem;flex-wrap:wrap">'+
      '<button class="btn btn-ghost btn-sm" data-mod="useful" data-r="'+r.id+'">Useful</button>'+
      '<button class="btn btn-ghost btn-sm" data-mod="not-useful" data-r="'+r.id+'">Not useful</button>'+
      '<button class="btn btn-ghost btn-sm" data-mod="flag" data-r="'+r.id+'">Flag</button>'+
      '<button class="btn btn-ghost btn-sm" data-mod="hide" data-r="'+r.id+'">Hide</button>'+
      (r.moderation.status==="hidden"?'<button class="btn btn-ghost btn-sm" data-mod="unhide" data-r="'+r.id+'">Unhide</button>':"")+
      '</div>';
  }

  function bindMod(testId){
    document.querySelectorAll("[data-mod]").forEach(b=>{
      b.onclick = async ()=>{
        const all = S.getResponses();
        const r = all.find(x=>x.id===b.dataset.r);
        if (!r) return;
        const act = b.dataset.mod;
        if (act==="hide"){
          const ok = await ui.confirmDialog({title:"Hide this response?",
            body:"It will be removed from your results view but kept for admin review. It is not deleted.",
            confirmLabel:"Hide response"});
          if (!ok) return;
          r.moderation.status = "hidden";
        } else if (act==="unhide"){ r.moderation.status = "valid"; }
        else if (act==="flag"){ r.moderation.status = "flagged"; r.moderation.creatorMark = "flagged"; }
        else { r.moderation.creatorMark = act; }
        S.saveResponses(all);
        ui.toast("Response updated.");
        TN.router.render();
      };
    });
  }

  /* Simple, honest theme grouping: shared significant phrases across reasons.
     Mechanical organization only — no judgment, no invented feedback. */
  function organizeThemes(responses){
    const stop = new Set(("a,an,the,and,or,but,if,then,of,to,in,on,for,with,that,this,these,those,it,its,is,are,was,were,be,been,being,i,you,we,they,he,she,my,your,our,their,me,him,her,us,them,so,as,at,by,from,not,no,yes,do,does,did,will,would,could,should,can,just,very,really,more,most,than,too,also,only,like,feel,feels,felt,think,seems,seem,kind,sort,thing,things,one,ones,get,got,makes,made,make,much,many,because,about,into,over,after,before,when,which,who,what,how,all,any,each,other,such,own,same,between,through,during,under,again,once,here,there,when,where,why").split(","));
    const phrases = {}; // phrase -> Set(responseIds)
    responses.forEach(r=>{
      const words = r.reason.toLowerCase().replace(/[^a-z\s]/g," ").split(/\s+/).filter(w=>w.length>3 && !stop.has(w));
      const seen = new Set();
      for (let i=0;i<words.length-1;i++){
        const p = words[i]+" "+words[i+1];
        if (!seen.has(p)){ seen.add(p); (phrases[p]=phrases[p]||new Set()).add(r.id); }
      }
      words.forEach(w=>{ if(!seen.has(w)){ seen.add(w); (phrases[w]=phrases[w]||new Set()).add(r.id); } });
    });
    const themes = Object.entries(phrases)
      .filter(([,ids])=>ids.size>=2)
      .map(([p,ids])=>({phrase:p, ids:[...ids]}))
      .sort((a,b)=> b.ids.length*b.phrase.split(" ").length - a.ids.length*a.phrase.split(" ").length)
      .slice(0,6);
    // drop themes fully contained in a bigger one
    return themes.filter((t,i)=> !themes.some((o,j)=> j!==i && o.ids.length>=t.ids.length && t.ids.every(id=>o.ids.includes(id))));
  }

  TN.views.results = function(testId){
    const user = auth.currentUser();
    const t = S.getTest(testId);
    if (!t || t.ownerId!==user.id){ TN.views.notFound("Test not found."); return; }
    const app = document.getElementById("app");

    const responses = S.visibleResponsesFor(t.id);
    const total = responses.length;
    const goal = (TN_CONFIG.goals.find(g=>g.id===t.goal)||{}).label || t.goal;
    const shareUrl = location.origin + location.pathname + "#/t/" + t.publicId;

    // preference distribution
    const buckets = {};
    t.variations.forEach(v=>{ buckets[v.id] = {label:v.label||"Option", count:0, responses:[]}; });
    buckets.none = {label:"None of these", count:0, responses:[]};
    buckets.context = {label:"Need more context", count:0, responses:[]};
    responses.forEach(r=>{
      const b = buckets[r.choice] || buckets.none;
      b.count++; b.responses.push(r);
    });
    const pct = c => total? Math.round(c/total*100) : 0;
    const sorted = Object.entries(buckets).sort((a,b)=>b[1].count-a[1].count);
    const top = sorted[0];

    // confidence distribution
    const conf = {not:0,somewhat:0,very:0};
    responses.forEach(r=>{ if(conf[r.confidence]!==undefined) conf[r.confidence]++; });

    let html = '<div class="wrap">'+
      '<p><a href="#/dashboard">← My tests</a></p>'+
      '<div class="page-head"><div>'+
      '<h2 style="margin-bottom:.3rem">'+ui.esc(t.title)+'</h2>'+
      '<div class="test-meta"><span class="badge badge-'+t.status+'">'+t.status+'</span>'+
      '<span>'+ui.esc(goal)+'</span><span>Created '+ui.fmtDate(t.createdAt)+'</span>'+
      (t.closedAt?'<span>Closed '+ui.fmtDate(t.closedAt)+'</span>':"")+'</div></div>'+
      '<div class="test-actions">'+
      (t.status==="live"?'<button class="btn btn-secondary btn-sm" id="res-copy">Copy share link</button>'+
        '<a class="btn btn-secondary btn-sm" href="#/t/'+t.publicId+'?preview=1">Preview</a>'+
        '<button class="btn btn-ghost btn-sm" id="res-close">Close test</button>'
        :'<button class="btn btn-secondary btn-sm" id="res-reopen">Reopen test</button>')+
      '</div></div>';

    /* summary stats */
    html += '<div class="stat-row">'+
      '<div class="stat"><div class="n">'+total+'</div><div class="l">'+total+' response'+(total===1?"":"s")+(t.config.targetResponses?' · target '+t.config.targetResponses:"")+'</div></div>'+
      '<div class="stat"><div class="n">'+pct(conf.very+conf.somewhat)+'%</div><div class="l">somewhat or very sure</div></div>'+
      '<div class="stat"><div class="n">'+responses.filter(r=>r.flags.length).length+'</div><div class="l">flagged for review</div></div>'+
      '<div class="stat"><div class="n">'+Math.round(responses.reduce((s,r)=>s+r.durationMs,0)/Math.max(total,1)/1000)+'s</div><div class="l">avg. response time</div></div>'+
    '</div>';

    /* distribution */
    html += '<div class="panel"><h3>What people chose</h3>';
    if (!total){
      html += '<p class="small">No responses yet. Share your private link to start collecting feedback.</p>'+
        '<div class="share-box"><code>'+ui.esc(shareUrl)+'</code><button class="btn btn-primary btn-sm" id="res-copy2">Copy link</button></div>';
    } else {
      html += '<p class="small">Among the people who responded'+(top[1].count? ', <strong>'+ui.esc(top[1].label)+'</strong> was chosen most often':'')+'. These are human preferences, not a verdict — read the reasons before you decide.</p>';
      sorted.forEach(([key,b])=>{
        const p = pct(b.count);
        html += '<div class="result-bar-row" style="grid-template-columns:minmax(9rem,12rem) 1fr auto"><span>'+ui.esc(b.label)+'</span>'+ui.bar(p, key==="none"||key==="context")+'<span><strong>'+b.count+'</strong> · '+p+'%</span></div>';
      });
      html += '<p class="small" style="margin-top:.75rem">Confidence: '+conf.very+' very sure · '+conf.somewhat+' somewhat sure · '+conf.not+' not sure</p>';
    }
    html += '</div>';

    /* per-option detail */
    if (total){
      html += '<h3 class="mt">By option</h3>';
      t.variations.forEach(v=>{
        const b = buckets[v.id];
        const liked = b.responses; // chose it
        const questioned = responses.filter(r=>r.choice!==v.id && r.choice!=="context");
        html += '<div class="option-result">'+
          '<span class="badge badge-draft">'+ui.esc(b.label)+'</span>'+
          (v.imageUrl?'<img src="'+v.imageUrl+'" alt="" style="border-radius:10px;margin:.75rem 0;max-height:220px">':"")+
          (v.text?'<div class="opt-text">'+ui.esc(v.text)+'</div>':"")+
          '<p><strong>'+b.count+'</strong> response'+(b.count===1?"":"s")+' · '+pct(b.count)+'% of total</p>'+
          '<div class="two-col"><div><h4>What people liked</h4>'+
            (liked.length? liked.slice(0,6).map(r=>quoteCard(t,r,modControls(r))).join("") : '<p class="small">No one chose this option yet.</p>')+
          '</div><div><h4>What people questioned</h4>'+
            (questioned.length? questioned.slice(0,6).map(r=>quoteCard(t,r)).join("") : '<p class="small">No concerns raised yet.</p>')+
          '</div></div></div>';
      });

      /* none / context as first-class */
      [["none","None of these","Nobody has to love your options. This is useful signal."],["context","Need more context","These respondents wanted more information before judging."]].forEach(([key,title,sub])=>{
        const b = buckets[key];
        html += '<div class="option-result"><span class="badge badge-draft">'+title+'</span>'+
          '<p><strong>'+b.count+'</strong> response'+(b.count===1?"":"s")+' · '+pct(b.count)+'%</p>'+
          '<p class="small">'+sub+'</p>'+
          (b.responses.length? b.responses.map(r=>quoteCard(t,r,modControls(r))).join("") : '<p class="small">None yet.</p>')+'</div>';
      });

      /* points of disagreement */
      const minority = responses.filter(r=>{
        const share = buckets[r.choice] ? buckets[r.choice].count/total : 0;
        return r.choice==="none" || r.choice==="context" || share < 0.5;
      });
      html += '<div class="panel"><h3>Points of disagreement</h3>'+
        '<p class="small">Minority views are kept visible on purpose — the most useful insight is often the one most people didn’t have.</p>'+
        (minority.length? minority.slice(0,8).map(r=>quoteCard(t,r,modControls(r))).join("") : '<p class="small">No disagreement recorded yet.</p>')+'</div>';

      /* what people thought this was (clarity lens) */
      const clarityAnswers = responses.filter(r=>r.followup);
      if (t.goal==="clarity" && clarityAnswers.length){
        html += '<div class="panel"><h3>What people thought this was</h3>'+
          '<p class="small">Answers to “'+ui.esc((TN_CONFIG.goals.find(g=>g.id==="clarity")||{}).followup)+'”</p>'+
          clarityAnswers.slice(0,10).map(r=>'<div class="quote">“'+ui.esc(r.followup)+'”<div class="q-meta">'+nameFor(t,r)+'</div></div>').join("")+'</div>';
      }

      /* theme organizer */
      if (TN_CONFIG.flags.themeOrganizer){
        html += '<div class="panel"><h3>Feedback themes</h3>'+
          '<p class="small">Mechanical grouping of what people actually wrote — no judgment added, no feedback invented.</p>'+
          '<button class="btn btn-secondary btn-sm" id="res-themes">Organize feedback themes</button>'+
          '<div id="themes-out" class="mt"></div></div>';
      }
    }

    /* decision reflection */
    const d = t.decision || {};
    html += '<div class="panel"><h3>Your decision</h3>'+
      '<p class="small">What next? Only you decide what ships.</p>'+
      '<div class="decision-options" role="radiogroup" aria-label="Decision">'+
      [["ship","Ship this version"],["revise","Revise and retest"],["new","Test a new direction"],["undecided","I’m still deciding"]].map(([v,l])=>
        '<label class="check-row"><input type="radio" name="decision" value="'+v+'"'+(d.choice===v?" checked":"")+'><span class="t">'+l+'</span></label>').join("")+
      '</div><div class="field"><label for="res-note">Decision note <span class="hint">— optional, for your future self</span></label>'+
      '<textarea id="res-note" rows="3" placeholder="What did you take away? What will you change?">'+ui.esc(d.note||"")+'</textarea></div>'+
      '<button class="btn btn-primary btn-sm" id="res-save-decision">Save decision</button></div>';

    html += '</div>';
    app.innerHTML = html;

    /* bindings */
    const copy = ()=> ui.copyLink(shareUrl, "Share link copied");
    ["res-copy","res-copy2"].forEach(id=>{ const el=document.getElementById(id); if(el) el.onclick=copy; });
    const closeBtn = document.getElementById("res-close");
    if (closeBtn) closeBtn.onclick = async ()=>{
      const ok = await ui.confirmDialog({title:"Close this test?",body:"Respondents will no longer be able to submit.",confirmLabel:"Close test",danger:true});
      if (ok){ t.status="closed"; t.closedAt=Date.now(); S.upsertTest(t); ui.toast("Test closed."); TN.router.render(); }
    };
    const reopenBtn = document.getElementById("res-reopen");
    if (reopenBtn) reopenBtn.onclick = ()=>{ t.status="live"; t.closedAt=0; S.upsertTest(t); ui.toast("Test reopened."); TN.router.render(); };

    document.getElementById("res-save-decision").onclick = ()=>{
      const sel = document.querySelector('input[name="decision"]:checked');
      t.decision = { choice: sel?sel.value:null, note: document.getElementById("res-note").value.trim(), savedAt: Date.now() };
      S.upsertTest(t);
      ui.toast("Decision saved.");
    };

    const themeBtn = document.getElementById("res-themes");
    if (themeBtn) themeBtn.onclick = ()=>{
      const themes = organizeThemes(responses);
      const out = document.getElementById("themes-out");
      if (!themes.length){
        out.innerHTML = '<p class="small">Not enough overlapping language to group yet — with more responses, shared phrases will surface here.</p>';
        return;
      }
      const byId = {}; responses.forEach(r=>byId[r.id]=r);
      out.innerHTML =
        '<div class="theme-label"><strong>Organized themes from human feedback.</strong><br>'+
        'This is an organization of participant comments, not an AI judgment or recommendation. Every theme below is built from direct quotes.</div>'+
        themes.map(th=>
          '<div class="theme"><h4>“'+ui.esc(th.phrase)+'” — '+th.ids.length+' response'+(th.ids.length===1?"":"s")+'</h4>'+
          th.ids.slice(0,4).map(id=>{ const r=byId[id]; return '<div class="quote">“'+ui.esc(r.reason)+'”<div class="q-meta">'+nameFor(t,r)+'</div></div>'; }).join("")+
          (th.ids.length>4?'<p class="small">+ '+(th.ids.length-4)+' more</p>':"")+'</div>'
        ).join("");
    };

    bindMod(t.id);
  };

  /* public demo results (read-only, seeded data) */
  TN.views.demoResults = function(){
    const t = S.getTest("t_demo0001");
    if (!t){ TN.views.notFound("Demo not available."); return; }
    // temporarily render as owner
    const user = auth.currentUser();
    const fakeOwner = {_demo:true};
    const real = auth.currentUser;
    document.getElementById("app").innerHTML = '<div class="demo-banner" style="max-width:1120px;margin:0 auto 1rem">Demo data — a realistic example so you can explore the results view before creating a test.</div><div id="demo-host"></div>';
    // reuse the results renderer by swapping the ownership check
    const orig = S.getTest;
    S.getTest = id => id==="t_demo0001" ? Object.assign({}, orig(id), {ownerId:"__demo__"}) : orig(id);
    const cu = auth.currentUser;
    auth.currentUser = ()=> ({id:"__demo__", name:"Demo"});
    try { TN.views.results("t_demo0001"); }
    finally { S.getTest = orig; auth.currentUser = cu; }
    // strip owner-only actions in demo (read-only: no decision, moderation, or test controls)
    document.querySelectorAll("#res-close,#res-copy,#res-copy2,#res-reopen,.test-actions,[data-mod]").forEach(el=>el.remove());
    const demoDecision = document.getElementById("res-save-decision");
    if (demoDecision) demoDecision.closest(".panel").remove();
    document.getElementById("app").insertAdjacentHTML("afterbegin",
      '<div class="wrap"><p class="small"><a href="#/">← Back to home</a></p></div>');
    document.querySelectorAll("[data-mod]").forEach(el=>el.remove());
  };
})();
