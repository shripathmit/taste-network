/* Taste Network — respondent experience (/t/[public-id]) */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store;

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  TN.views.respond = function(publicId){
    const t = S.getTestByPublicId(publicId);
    const app = document.getElementById("app");
    const params = new URLSearchParams((location.hash.split("?")[1]||""));
    const preview = params.get("preview")==="1";

    if (!t){ TN.views.notFound("This test link doesn’t look right."); return; }
    const closed = t.status!=="live" || (t.config.deadline && t.config.deadline < Date.now());
    if (closed && !preview){
      app.innerHTML = '<div class="wrap-narrow"><div class="card center" style="max-width:480px;margin:3rem auto">'+
        '<h2>This test is closed</h2><p class="small">Thanks for your interest — the creator is no longer collecting responses.</p>'+
        homeLink+'</div></div>';
      return;
    }

    const state = {
      step: 0, name:"", inviteEmail:"",
      order: shuffle(t.variations.map(v=>v.id)),
      reviewIdx: 0, choice: null, reason:"", followup:"",
      confidence: null, startedAt: Date.now(), wantMore: false
    };

    const goal = TN_CONFIG.goals.find(g=>g.id===t.goal) || TN_CONFIG.goals[0];

    function progress(){
      const total = 6;
      return '<div class="respond-progress" aria-hidden="true">'+
        Array.from({length:total},(_,i)=>'<span class="'+(i<state.step?"on":"")+'"></span>').join("")+'</div>';
    }
    function wrap(inner){
      app.innerHTML = '<div class="wrap-narrow respond-shell">'+
        (preview?'<div class="preview-banner"><strong>Preview mode.</strong> This is what respondents see — nothing you submit here will be saved.</div>':"")+
        progress()+inner+'</div>';
      window.scrollTo(0,0);
    }
    const homeLink = '<p class="small center" style="margin-top:1.75rem"><a href="#/">&#8592; Back to home</a></p>';

    function navBtns(nextLabel, canNext){
      return '<div style="display:flex;justify-content:space-between;gap:1rem;margin-top:1.75rem">'+
        '<button class="btn btn-ghost" id="r-back">← Back</button>'+
        '<button class="btn btn-primary" id="r-next" '+(canNext?"":"disabled")+'>'+ui.esc(nextLabel||"Continue →")+'</button></div>';
    }

    /* ---- step 0: intro ---- */
    function sIntro(){
      const invited = t.config.access==="invited";
      wrap(
        '<p class="eyebrow">You’re invited to weigh in</p>'+
        '<h2>'+ui.esc(t.title)+'</h2>'+
        '<p class="lede">Your feedback helps someone decide what to ship.</p>'+
        (t.context?'<div class="form-note">'+ui.esc(t.context)+'</div>':"")+
        '<div class="field"><label for="r-name">Your name <span class="hint">— optional'+(t.config.anonymous==="hidden"?"; hidden from the creator":"")+'</span></label>'+
        '<input id="r-name" type="text" autocomplete="name" maxlength="60" placeholder="How should we credit your take?"></div>'+
        (invited?'<div class="field"><label for="r-invite">Your email <span class="hint">— this test is invite-only</span></label>'+
        '<input id="r-invite" type="email" autocomplete="email" placeholder="you@example.com"></div>':"")+
        '<input class="hp-field" type="text" id="r-hp" tabindex="-1" autocomplete="off" aria-hidden="true">'+
        '<button class="btn btn-primary btn-block" id="r-start">Start — it takes about 2 minutes</button>'+
        '<p class="small center mt">No account needed. One response per person.</p>');
      document.getElementById("r-start").onclick = ()=>{
        state.name = document.getElementById("r-name").value.trim().slice(0,60);
        if (document.getElementById("r-hp").value){ // honeypot tripped
          state.bot = true;
        }
        if (invited){
          const em = document.getElementById("r-invite").value.trim().toLowerCase();
          if (!t.config.invitedEmails.includes(em)){ ui.toast("This email isn’t on the invite list for this test."); return; }
          state.inviteEmail = em;
        }
        state.startedAt = Date.now();
        state.step = 1; sReview();
      };
    }

    /* ---- step 1: review, one at a time ---- */
    function varById(id){ return t.variations.find(v=>v.id===id); }
    function sReview(){
      const v = varById(state.order[state.reviewIdx]);
      const n = state.order.length;
      wrap(
        '<p class="eyebrow">Step 1 of 5 · Review the options</p>'+
        '<h3 style="margin-bottom:1rem">'+ui.esc(t.question)+'</h3>'+
        '<div class="option-card">'+
          '<div class="opt-tag">'+ui.esc(v.label||("Option "+(state.reviewIdx+1)))+' · '+(state.reviewIdx+1)+' of '+n+'</div>'+
          (v.imageUrl?'<img src="'+v.imageUrl+'" alt="">':"")+
          (v.text?'<div class="opt-text">'+ui.esc(v.text)+'</div>':"")+
          (v.externalUrl?'<p><a href="'+ui.esc(v.externalUrl)+'" target="_blank" rel="noopener">Open linked material ↗</a></p>':"")+
        '</div>'+
        '<div class="pager-dots" role="tablist" aria-label="Options">'+
          state.order.map((_,i)=>'<button data-i="'+i+'" class="'+(i===state.reviewIdx?"on":"")+'" aria-label="Option '+(i+1)+'"></button>').join("")+
        '</div>'+
        '<div style="display:flex;justify-content:space-between;gap:1rem;margin-top:1rem">'+
          '<button class="btn btn-ghost" id="r-back">← Back</button>'+
          '<div style="display:flex;gap:.6rem">'+
          (state.reviewIdx>0?'<button class="btn btn-secondary" id="r-prev">Previous</button>':"")+
          (state.reviewIdx<n-1
            ? '<button class="btn btn-primary" id="r-nextopt">Next option →</button>'
            : '<button class="btn btn-primary" id="r-choose">I’ve seen them all →</button>')+
          '</div></div>');
      document.getElementById("r-back").onclick = ()=>{ state.step=0; sIntro(); };
      document.querySelectorAll(".pager-dots button").forEach(b=>{ b.onclick=()=>{ state.reviewIdx=+b.dataset.i; sReview(); }; });
      const prev = document.getElementById("r-prev");
      if (prev) prev.onclick = ()=>{ state.reviewIdx--; sReview(); };
      const no = document.getElementById("r-nextopt");
      if (no) no.onclick = ()=>{ state.reviewIdx++; sReview(); };
      const ch = document.getElementById("r-choose");
      if (ch) ch.onclick = ()=>{ state.step=2; sChoose(); };
    }

    /* ---- step 2: choose ---- */
    function sChoose(){
      const cards = state.order.map(id=>{
        const v = varById(id);
        return '<button class="choice'+(state.choice===id?" selected":"")+'" data-c="'+id+'">'+
          '<div class="c-text">'+ui.esc(v.label||"Option")+'</div>'+
          '<div class="c-sub">'+ui.esc((v.text||"").slice(0,90))+(v.text&&v.text.length>90?"…":"")+(v.imageUrl?" · has image":"")+'</div></button>';
      }).join("");
      wrap(
        '<p class="eyebrow">Step 2 of 5 · Choose</p>'+
        '<h3>'+ui.esc(t.question)+'</h3>'+
        '<div class="choice-list" role="radiogroup" aria-label="Your choice">'+cards+
        '<button class="choice'+(state.choice==="none"?" selected":"")+'" data-c="none"><div class="c-text">None of these</div><div class="c-sub">None of the options work for me</div></button>'+
        '<button class="choice'+(state.choice==="context"?" selected":"")+'" data-c="context"><div class="c-text">I need more context</div><div class="c-sub">I can’t judge fairly with what I’ve seen</div></button>'+
        '</div>'+navBtns("Continue →", !!state.choice));
      document.querySelectorAll("[data-c]").forEach(b=>{
        b.onclick = ()=>{ state.choice = b.dataset.c;
          document.querySelectorAll("[data-c]").forEach(x=>x.classList.remove("selected"));
          b.classList.add("selected");
          document.getElementById("r-next").disabled = false; };
      });
      document.getElementById("r-back").onclick = ()=>{ state.step=1; sReview(); };
      document.getElementById("r-next").onclick = ()=>{ if(state.choice){ state.step=3; sReason(); } };
    }

    /* ---- step 3: reason (required) ---- */
    function sReason(){
      wrap(
        '<p class="eyebrow">Step 3 of 5 · Explain</p>'+
        '<h3>What specifically made you choose that option?</h3>'+
        '<p class="small">A sentence or two is perfect. Be specific — vague praise doesn’t help anyone decide.</p>'+
        '<div class="field"><label for="r-reason" class="small">Your reason <span class="hint">(required)</span></label>'+
        '<textarea id="r-reason" rows="4" maxlength="2000" placeholder="e.g. The second one told me what the product does in five seconds — the others made me guess.">'+ui.esc(state.reason)+'</textarea>'+
        '<div class="char-count"><span id="r-count">'+state.reason.length+'</span> characters · minimum '+TN_CONFIG.quality.minReasonLength+'</div></div>'+
        navBtns("Continue →", state.reason.trim().length>=TN_CONFIG.quality.minReasonLength));
      const ta = document.getElementById("r-reason");
      ta.oninput = ()=>{
        state.reason = ta.value;
        document.getElementById("r-count").textContent = ta.value.length;
        document.getElementById("r-next").disabled = ta.value.trim().length < TN_CONFIG.quality.minReasonLength;
      };
      document.getElementById("r-back").onclick = ()=>{ state.step=2; sChoose(); };
      document.getElementById("r-next").onclick = ()=>{ if(state.reason.trim().length>=TN_CONFIG.quality.minReasonLength){ state.step=4; sFollowup(); } };
    }

    /* ---- step 4: dynamic follow-up ---- */
    function sFollowup(){
      wrap(
        '<p class="eyebrow">Step 4 of 5 · One more thing</p>'+
        '<h3>'+ui.esc(goal.followup)+'</h3>'+
        '<div class="field"><textarea id="r-follow" rows="3" maxlength="2000" placeholder="Your honest take…">'+ui.esc(state.followup)+'</textarea>'+
        '<div class="char-count"><span id="f-count">'+state.followup.length+'</span> characters</div></div>'+
        navBtns("Continue →", state.followup.trim().length>=TN_CONFIG.quality.minFollowupLength));
      const ta = document.getElementById("r-follow");
      ta.oninput = ()=>{
        state.followup = ta.value;
        document.getElementById("f-count").textContent = ta.value.length;
        document.getElementById("r-next").disabled = ta.value.trim().length < TN_CONFIG.quality.minFollowupLength;
      };
      document.getElementById("r-back").onclick = ()=>{ state.step=3; sReason(); };
      document.getElementById("r-next").onclick = ()=>{ if(state.followup.trim().length>=TN_CONFIG.quality.minFollowupLength){ state.step=5; sConfidence(); } };
    }

    /* ---- step 5: confidence ---- */
    function sConfidence(){
      const opts = [["not","Not sure"],["somewhat","Somewhat sure"],["very","Very sure"]];
      wrap(
        '<p class="eyebrow">Step 5 of 5 · Confidence</p>'+
        '<h3>How sure are you about your pick?</h3>'+
        '<div class="confidence-row" role="radiogroup" aria-label="Confidence">'+
        opts.map(([v,l])=>'<button class="choice'+(state.confidence===v?" selected":"")+'" data-conf="'+v+'" role="radio"><div class="c-text" style="font-size:1rem">'+l+'</div></button>').join("")+
        '</div>'+
        '<div id="r-captcha" style="margin-top:1.25rem"></div>'+
        '<p class="small" id="r-captcha-err" style="color:var(--danger,#b3261e);min-height:1.2em;margin:.25rem 0 0"></p>'+
        navBtns("Submit feedback", !!state.confidence));
      document.querySelectorAll("[data-conf]").forEach(b=>{
        b.onclick = ()=>{ state.confidence=b.dataset.conf;
          document.querySelectorAll("[data-conf]").forEach(x=>x.classList.remove("selected"));
          b.classList.add("selected");
          document.getElementById("r-next").disabled=false; };
      });
      document.getElementById("r-back").onclick = ()=>{ state.step=4; sFollowup(); };
      document.getElementById("r-next").onclick = ()=>{ if(state.confidence) submit(); };
      renderTurnstile();
    }

    /* ---- Cloudflare Turnstile CAPTCHA ----
       The widget proves humanness in the browser; the token is verified
       server-side (/api/submit-response) before anything is saved. */
    const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    let turnstileWidgetId = null;
    function turnstileSiteKey(){
      try { return (window.TN_ENV && window.TN_ENV.turnstileSiteKey) || ""; } catch(e){ return ""; }
    }
    function ensureTurnstileScript(){
      return new Promise((resolve)=>{
        if (window.turnstile){ resolve(true); return; }
        const done = (ok)=>resolve(ok);
        if (document.querySelector("script[data-turnstile]")){
          const iv = setInterval(()=>{ if (window.turnstile){ clearInterval(iv); done(true); } }, 200);
          setTimeout(()=>{ clearInterval(iv); done(!!window.turnstile); }, 8000);
          return;
        }
        const s = document.createElement("script");
        s.src = TURNSTILE_SRC; s.async = true; s.defer = true;
        s.setAttribute("data-turnstile", "1");
        s.onload = ()=>done(true); s.onerror = ()=>done(false);
        document.body.appendChild(s);
        setTimeout(()=>done(!!window.turnstile), 8000);
      });
    }
    async function renderTurnstile(){
      const host = document.getElementById("r-captcha");
      if (!host) return;
      const key = turnstileSiteKey();
      if (!key){
        host.innerHTML = '<p class="small">Submissions are temporarily unavailable — verification isn’t configured yet.</p>';
        return;
      }
      const ok = await ensureTurnstileScript();
      const hostNow = document.getElementById("r-captcha");
      if (!hostNow) return; // user navigated away while loading
      if (!ok || !window.turnstile){
        hostNow.innerHTML = '<p class="small">Couldn’t load the verification check. Please reload and try again.</p>';
        return;
      }
      try { turnstileWidgetId = window.turnstile.render(hostNow, { sitekey: key, theme: "light" }); }
      catch(e){ hostNow.innerHTML = '<p class="small">Couldn’t load the verification check. Please reload and try again.</p>'; }
    }
    function captchaToken(){
      try {
        if (window.turnstile && turnstileWidgetId !== null)
          return window.turnstile.getResponse(turnstileWidgetId) || "";
      } catch(e){}
      return "";
    }
    function resetCaptcha(){
      try { if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId); } catch(e){}
    }

    /* ---- submit ---- */
    const LAST_SUBMIT_KEY = "tn_last_submit_v1";
    const SUBMIT_THROTTLE_MS = 20000; // min gap between responses from this device
    async function submit(){
      if (preview){
        wrap('<div class="thanks"><div class="big">👀</div><h2>Preview complete</h2>'+
          '<p class="small">In the real flow this is where the thank-you screen appears. Nothing was saved.</p>'+
          '<a class="btn btn-secondary" href="#/dashboard">Back to dashboard</a>'+homeLink+'</div>');
        return;
      }
      if (state.submitting) return; // double-submit lock
      state.submitting = true;
      const fp = S.fingerprint();
      if (!t.isDemo){
        let lastSubmit = 0;
        try { lastSubmit = parseInt(localStorage.getItem(LAST_SUBMIT_KEY) || "0", 10); } catch(e){}
        if (Date.now() - lastSubmit < SUBMIT_THROTTLE_MS){
          state.submitting = false;
          wrap('<div class="thanks"><h2>Slow down a touch</h2>'+
            '<p class="small">You just sent a response. Wait a few seconds before sending another.</p>'+
            '<p class="small"><a href="javascript:history.back()">Go back</a></p>'+homeLink+'</div>');
          return;
        }
      }
      if (state.bot || S.hasResponded(t.id, fp)){
        wrap('<div class="thanks"><h2>Thanks — we’ve got your take</h2>'+
          '<p class="small">It looks like a response was already submitted from this browser for this test.</p>'+homeLink+'</div>');
        return;
      }
      const durationMs = Date.now()-state.startedAt;
      const flags = [];
      if (durationMs < TN_CONFIG.quality.fastResponseMs) flags.push("fast");
      if (S.duplicateReason(t.id, state.reason)) flags.push("duplicate-text");
      const r = {
        id: ui.uid("r_"), testId: t.id, sessionFp: fp,
        choice: state.choice, reason: state.reason.trim(), followup: state.followup.trim(),
        confidence: state.confidence, orderShown: state.order,
        durationMs, createdAt: Date.now(),
        respondentName: state.name || (state.inviteEmail ? state.inviteEmail.split("@")[0] : ""),
        respondentEmail: state.inviteEmail || "",
        wantMoreFeedback: state.wantMore,
        flags, moderation: { status: flags.length?"flagged":"valid", creatorMark: null }
      };
      if (!t.isDemo){
        const token = captchaToken();
        if (!token){
          state.submitting = false;
          const ce = document.getElementById("r-captcha-err");
          if (ce) ce.textContent = "Please complete the verification check to submit.";
          resetCaptcha();
          return;
        }
        try {
          await S.addResponse(r, token);
          state.lastResponseId = r.id;
          try { localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now())); } catch(e){}
        } catch(ex){
          state.submitting = false;
          if (ex.tnDuplicate){
            wrap('<div class="thanks"><h2>Thanks — we’ve got your take</h2>'+
              '<p class="small">It looks like a response was already submitted from this browser for this test.</p>'+homeLink+'</div>');
            return;
          }
          if (ex.tnThrottled){
            wrap('<div class="thanks"><h2>Slow down a touch</h2>'+
              '<p class="small">Too many responses in a short time. Please wait a few minutes and try again.</p>'+homeLink+'</div>');
            return;
          }
          if (ex.tnClosed){
            wrap('<div class="thanks"><h2>This test is closed</h2>'+
              '<p class="small">Thanks for your interest — the creator is no longer collecting responses.</p>'+homeLink+'</div>');
            return;
          }
          if (ex.tnCaptcha){
            // back to the confidence step with a fresh widget
            state.step = 5; turnstileWidgetId = null; sConfidence();
            const ce = document.getElementById("r-captcha-err");
            if (ce) ce.textContent = "The verification check didn’t pass — please try it again.";
            return;
          }
          wrap('<div class="thanks"><h2>Something went wrong</h2>'+
            '<p class="small">'+ui.esc(ex.message)+'</p>'+
            '<p class="small"><a href="javascript:history.back()">Go back and try again</a></p>'+homeLink+'</div>');
          return;
        }
      }
      // credit: thoughtful = met minimums, not a bot, not duplicate
      const thoughtful = !state.bot && !flags.includes("duplicate-text") &&
        r.reason.length >= TN_CONFIG.quality.minReasonLength;
      const me = TN.auth.currentUser();
      if (thoughtful && !t.isDemo){
        try {
          if (me) await S.addCredit(me.id, TN_CONFIG.credits.perThoughtfulResponse, "Thoughtful feedback on “"+t.title+"”");
          else await S.addPendingCredit({ email: state.inviteEmail||"", device: S.deviceId() }, TN_CONFIG.credits.perThoughtfulResponse, "Thoughtful feedback on “"+t.title+"”");
        } catch(ex){ console.warn("credit:", ex.message); }
      }
      sThanks();
    }

    function sThanks(){
      const me = TN.auth.currentUser();
      wrap('<div class="thanks"><img class="thanks-art" src="assets/img/orb-abstract.jpg" alt="" aria-hidden="true">'+
        '<h2>Thank you.</h2><p class="small" style="max-width:26em;margin:0 auto 1.5rem">Your perspective matters.</p>'+
        (!t.isDemo?'<p class="small" style="max-width:26em;margin:0 auto 1.5rem">Your response is awaiting a quick review — the creator will see it once it’s approved.</p>':"")+
        '<label class="check-row" style="max-width:26em;margin:0 auto 1.5rem;text-align:left"><input type="checkbox" id="r-wantmore">'+
        '<span><span class="t">Keep me in the loop</span><br><span class="d">I’m open to giving feedback on future tests.</span></span></label>'+
        (me
          ? '<p class="small">+'+TN_CONFIG.credits.perThoughtfulResponse+' feedback credit added. <a href="#/credits">View credits</a></p>'
          : '<div class="card" style="max-width:26em;margin:0 auto"><p class="small"><strong>Want credit for your taste?</strong> Create a free account to collect feedback credits and run your own tests.</p><a class="btn btn-primary btn-sm" href="#/signup">Create a free account</a></div>')+
        homeLink+'</div>');
      document.getElementById("r-wantmore").onchange = e=>{
        S.setWantMoreFeedback(state.lastResponseId, e.target.checked);
        if (e.target.checked) ui.toast("Noted — thanks for sticking around.");
      };
    }

    sIntro();
  };
})();
