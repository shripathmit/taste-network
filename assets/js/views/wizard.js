/* Taste Network — 5-step test creation wizard */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store, auth = TN.auth;
  const STEPS = ["Type","Context","Variations","Feedback","Publish"];

  let draft = null;   // working test object
  let step = 1;

  function newDraft(ownerId){
    return {
      id: ui.uid("t_"), publicId: ui.publicId(), ownerId,
      title:"", type:"", context:"", question:"", goal:"clarity",
      variations:[ blankVar("A"), blankVar("B") ],
      config:{ targetResponses:10, access:"link", invitedEmails:[], anonymous:"visible", deadline:0, requireReason:true },
      status:"draft", createdAt:Date.now(), publishedAt:0, closedAt:0, decision:null
    };
  }
  function blankVar(letter){
    return { id: ui.uid("v_"), label:"Option "+letter, text:"", imageUrl:"", externalUrl:"" };
  }
  function letters(i){ return "ABCDE"[i]; }

  function persist(){ if (draft.title || draft.type) S.upsertTest(draft); }

  function stepBar(){
    return '<div class="wizard-steps" role="list" aria-label="Creation steps">'+
      STEPS.map((s,i)=>{
        const n=i+1, cls = n===step?"current":(n<step?"done":"");
        return '<span class="wstep '+cls+'" role="listitem" aria-current="'+(n===step?'step':'false')+'">'+n+'. '+s+'</span>';
      }).join("")+'</div>';
  }
  function shell(inner){
    document.getElementById("app").innerHTML =
      '<div class="wrap-narrow"><h2 style="margin-bottom:1rem">'+(draft.id && S.getTest(draft.id) ? "Edit test" : "Create a test")+'</h2>'+
      stepBar()+inner+'<div class="wizard-nav">'+
      (step>1?'<button class="btn btn-ghost" id="w-back">← Back</button>':"<span></span>")+
      (step<5?'<button class="btn btn-primary" id="w-next">Continue →</button>':"")+
      '</div></div>';
    const back = document.getElementById("w-back");
    if (back) back.onclick = ()=>{ if (collect()){ step--; render(); } };
    const next = document.getElementById("w-next");
    if (next) next.onclick = ()=>{ if (collect()){ step++; render(); } };
  }

  /* ---------- step 1: type ---------- */
  function step1(){
    shell(
      '<h3>What are you comparing?</h3><p class="small">Pick the closest fit — it just shapes the questions respondents get.</p>'+
      '<div class="type-cards" role="radiogroup" aria-label="Test type">'+
      TN_CONFIG.testTypes.map(t=>
        '<button type="button" class="radio-card'+(draft.type===t.id?" selected":"")+'" data-type="'+t.id+'" role="radio" aria-checked="'+(draft.type===t.id)+'">'+
        '<div class="t">'+ui.esc(t.title)+'</div><div class="d">'+ui.esc(t.desc)+'</div></button>'
      ).join("")+'</div>');
    document.querySelectorAll("[data-type]").forEach(b=>{
      b.onclick = ()=>{ draft.type = b.dataset.type; persist(); render(); };
    });
  }
  function collect1(){
    if (!draft.type){ ui.toast("Choose a test type to continue."); return false; }
    persist(); return true;
  }

  /* ---------- step 2: context ---------- */
  function step2(){
    const goals = TN_CONFIG.goals;
    shell(
      '<h3>Add context</h3><p class="small">Help respondents understand what they’re looking at. Keep it honest and brief.</p>'+
      '<div class="field"><label for="w-title">Test title</label>'+
      '<input id="w-title" type="text" maxlength="120" value="'+ui.esc(draft.title)+'" placeholder="e.g. Which landing-page headline is clearest?"></div>'+
      '<div class="field"><label for="w-context">Private context for respondents <span class="hint">— optional</span></label>'+
      '<textarea id="w-context" placeholder="Who is this for? Where will it appear? Anything they should know before judging.">'+ui.esc(draft.context)+'</textarea></div>'+
      '<div class="field"><label for="w-question">The main question</label>'+
      '<input id="w-question" type="text" maxlength="160" value="'+ui.esc(draft.question)+'" placeholder="e.g. Which headline makes this product clearest?"></div>'+
      '<div class="field"><label>Goal — the lens you want feedback through</label>'+
      '<div class="radio-cards" role="radiogroup" aria-label="Goal">'+
      goals.map(g=>'<button type="button" class="radio-card'+(draft.goal===g.id?" selected":"")+'" data-goal="'+g.id+'" role="radio" aria-checked="'+(draft.goal===g.id)+'"><div class="t">'+ui.esc(g.label)+'</div></button>').join("")+
      '</div><p class="hint">This sets the follow-up question every respondent answers.</p></div>');
    document.querySelectorAll("[data-goal]").forEach(b=>{
      b.onclick = ()=>{ draft.goal=b.dataset.goal; render(); };
    });
  }
  function collect2(){
    const title = document.getElementById("w-title").value.trim();
    const question = document.getElementById("w-question").value.trim();
    if (!title){ ui.toast("Give your test a title."); return false; }
    if (!question){ ui.toast("Write the main question respondents will answer."); return false; }
    draft.title = title;
    draft.context = document.getElementById("w-context").value.trim();
    draft.question = question;
    persist(); return true;
  }

  /* ---------- step 3: variations ---------- */
  function varCard(v, i){
    return '<div class="variation" data-var="'+v.id+'">'+
      '<div class="variation-head"><span class="vlabel">'+ui.esc(v.label||("Option "+letters(i)))+'</span>'+
      '<div class="variation-tools">'+
        '<button class="icon-btn" data-vact="up" aria-label="Move up" title="Move up">↑</button>'+
        '<button class="icon-btn" data-vact="down" aria-label="Move down" title="Move down">↓</button>'+
        '<button class="icon-btn" data-vact="del" aria-label="Delete variation" title="Delete">×</button>'+
      '</div></div>'+
      '<div class="field"><label>Label <span class="hint">— optional, e.g. “Option A”</span></label>'+
      '<input type="text" data-f="label" maxlength="40" value="'+ui.esc(v.label)+'" placeholder="Option '+letters(i)+'"></div>'+
      '<div class="field"><label>Text content</label>'+
      '<textarea data-f="text" rows="3" placeholder="The headline, name, pitch, or message text…">'+ui.esc(v.text)+'</textarea></div>'+
      '<div class="field"><label>Image <span class="hint">— optional</span></label>'+
      '<input type="file" data-f="img" accept="image/*">'+
      (v.imageUrl?'<img class="preview" src="'+v.imageUrl+'" alt="Variation preview">':"")+'</div>'+
      '<div class="field"><label>External URL <span class="hint">— optional, e.g. a prototype link</span></label>'+
      '<input type="url" data-f="url" value="'+ui.esc(v.externalUrl)+'" placeholder="https://…"></div>'+
      '<p class="hint">Audio/video variations aren’t supported in this version — text and image only for now.</p>'+
    '</div>';
  }
  function step3(){
    shell(
      '<h3>Add your variations</h3><p class="small">Two to five versions. Respondents see them in random order.</p>'+
      '<div id="vars">'+draft.variations.map(varCard).join("")+'</div>'+
      (draft.variations.length<5?'<button class="btn btn-secondary btn-sm" id="v-add">+ Add variation</button>':""));
    bindVars();
  }
  function bindVars(){
    document.getElementById("vars").querySelectorAll(".variation").forEach(card=>{
      const v = draft.variations.find(x=>x.id===card.dataset.var);
      card.querySelector('[data-f="label"]').oninput = e=>{ v.label=e.target.value; card.querySelector(".vlabel").textContent = e.target.value || "Option"; persist(); };
      card.querySelector('[data-f="text"]').oninput = e=>{ v.text=e.target.value; persist(); };
      card.querySelector('[data-f="url"]').oninput = e=>{ v.externalUrl=e.target.value.trim(); persist(); };
      const file = card.querySelector('[data-f="img"]');
      file.onchange = ()=>{ handleImage(file.files[0], v, card); };
      card.querySelectorAll("[data-vact]").forEach(b=>{
        b.onclick = ()=>{
          const i = draft.variations.indexOf(v), act = b.dataset.vact;
          if (act==="del"){
            if (draft.variations.length<=2){ ui.toast("You need at least two variations."); return; }
            draft.variations.splice(i,1);
          } else if (act==="up" && i>0){
            draft.variations.splice(i-1,0,draft.variations.splice(i,1)[0]);
          } else if (act==="down" && i<draft.variations.length-1){
            draft.variations.splice(i+1,0,draft.variations.splice(i,1)[0]);
          }
          persist(); render();
        };
      });
    });
    const add = document.getElementById("v-add");
    if (add) add.onclick = ()=>{
      draft.variations.push(blankVar(letters(draft.variations.length)));
      persist(); render();
    };
  }
  function handleImage(file, v, card){
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async ()=>{
      const max = 1200;
      const scale = Math.min(1, max/Math.max(img.width,img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      // Upload to Supabase Storage when configured; otherwise fall back to a
      // compressed data URL (local preview mode).
      const blob = await new Promise(res => c.toBlob(res, "image/jpeg", .82));
      if (TN.sb.configured() && blob){
        try {
          const sb = TN.sb.client();
          const path = "tests/" + draft.id + "/" + ui.uid("") + ".jpg";
          const { error } = await sb.storage.from("test-images").upload(path, blob, { contentType: "image/jpeg" });
          if (error) throw error;
          const { data } = sb.storage.from("test-images").getPublicUrl(path);
          v.imageUrl = data.publicUrl;
          ui.toast("Image uploaded.");
        } catch(ex){
          console.warn("upload:", ex.message);
          ui.toast("Upload failed — using a local preview instead.");
          v.imageUrl = c.toDataURL("image/jpeg", .6);
        }
      } else {
        let data = c.toDataURL("image/jpeg", .82);
        if (data.length > TN_CONFIG.quality.maxImageBytes) data = c.toDataURL("image/jpeg", .6);
        v.imageUrl = data;
        ui.toast("Image added.");
      }
      persist(); render();
    };
    img.onerror = ()=>{ ui.toast("Couldn’t read that image."); URL.revokeObjectURL(url); };
    img.src = url;
  }
  function collect3(){
    const complete = draft.variations.filter(v=>v.text.trim()||v.imageUrl);
    if (complete.length<2){ ui.toast("Add at least two complete variations (text or image)."); return false; }
    draft.variations = complete;
    persist(); return true;
  }

  /* ---------- step 4: configure ---------- */
  function step4(){
    const c = draft.config;
    const deadlineVal = c.deadline ? new Date(c.deadline).toISOString().slice(0,16) : "";
    shell(
      '<h3>Configure feedback</h3>'+
      '<div class="field"><label>How many responses are you hoping for?</label>'+
      '<div class="radio-cards" role="radiogroup" aria-label="Response target">'+
      TN_CONFIG.responseTargets.map(n=>'<button type="button" class="radio-card'+(c.targetResponses===n?" selected":"")+'" data-target="'+n+'" role="radio"><div class="t">'+n+'</div></button>').join("")+
      '<button type="button" class="radio-card'+(!TN_CONFIG.responseTargets.includes(c.targetResponses)?" selected":"")+'" data-target="custom" role="radio"><div class="t">Custom</div><div class="d"><input type="number" id="w-custom-target" min="1" max="500" value="'+(!TN_CONFIG.responseTargets.includes(c.targetResponses)?c.targetResponses:25)+'" style="width:90px" aria-label="Custom target"></div></button>'+
      '</div></div>'+
      '<div class="field"><label>Who can respond?</label>'+
      '<label class="check-row"><input type="radio" name="access" value="link"'+(c.access==="link"?" checked":"")+'>'+
      '<span><span class="t">Anyone with the private link</span><br><span class="d">Simplest. Share it wherever you like.</span></span></label>'+
      '<label class="check-row"><input type="radio" name="access" value="invited"'+(c.access==="invited"?" checked":"")+'>'+
      '<span><span class="t">Invited email addresses only</span><br><span class="d">Respondents enter an email that must match your list.</span></span></label></div>'+
      '<div class="field" id="w-invite-wrap" style="'+(c.access==="invited"?"":"display:none")+'"><label for="w-emails">Invited emails <span class="hint">— one per line</span></label>'+
      '<textarea id="w-emails" rows="3" placeholder="maya@example.com\ntom@example.com">'+ui.esc(c.invitedEmails.join("\n"))+'</textarea></div>'+
      '<div class="field"><label>Respondent names</label>'+
      '<label class="check-row"><input type="radio" name="anon" value="visible"'+(c.anonymous==="visible"?" checked":"")+'>'+
      '<span><span class="t">Visible to me</span><br><span class="d">You’ll see the name each respondent optionally provides.</span></span></label>'+
      '<label class="check-row"><input type="radio" name="anon" value="hidden"'+(c.anonymous==="hidden"?" checked":"")+'>'+
      '<span><span class="t">Hidden from me</span><br><span class="d">Names are stored for admin review but never shown to you.</span></span></label></div>'+
      '<div class="field"><label for="w-deadline">Deadline <span class="hint">— optional</span></label>'+
      '<input id="w-deadline" type="datetime-local" value="'+deadlineVal+'"></div>'+
      '<div class="field"><label class="check-row" style="cursor:default"><input type="checkbox" checked disabled>'+
      '<span><span class="t">Require written reasoning</span><br><span class="d">Always on — every response includes a choice and a written reason.</span></span></label></div>'+
      '<div class="form-note"><strong>Every response includes a choice and a written reason.</strong><br>Taste Network does not use AI to judge your options.</div>');
    document.querySelectorAll("[data-target]").forEach(b=>{
      b.onclick = e=>{
        if (b.dataset.target==="custom"){
          const n = parseInt(document.getElementById("w-custom-target").value,10);
          if (n>0) draft.config.targetResponses = Math.min(n,500);
        } else draft.config.targetResponses = parseInt(b.dataset.target,10);
        render();
      };
    });
    document.querySelectorAll('input[name="access"]').forEach(r=>{
      r.onchange = ()=>{ draft.config.access = document.querySelector('input[name="access"]:checked').value;
        document.getElementById("w-invite-wrap").style.display = draft.config.access==="invited"?"":"none"; };
    });
    document.querySelectorAll('input[name="anon"]').forEach(r=>{
      r.onchange = ()=>{ draft.config.anonymous = document.querySelector('input[name="anon"]:checked').value; };
    });
    // custom target input: don't let clicks bubble to the card (which re-renders)
    const customInput = document.getElementById("w-custom-target");
    if (customInput){
      customInput.onclick = e=>e.stopPropagation();
      customInput.onchange = ()=>{
        const n = parseInt(customInput.value,10);
        if (n>0){ draft.config.targetResponses = Math.min(n,500); persist(); render(); }
      };
    }
  }
  function collect4(){
    draft.config.access = document.querySelector('input[name="access"]:checked').value;
    draft.config.anonymous = document.querySelector('input[name="anon"]:checked').value;
    if (draft.config.access==="invited"){
      const emails = document.getElementById("w-emails").value.split("\n").map(s=>s.trim().toLowerCase()).filter(Boolean);
      const bad = emails.filter(e=>!TN.auth.validEmail(e));
      if (!emails.length){ ui.toast("Add at least one invited email, or switch to link access."); return false; }
      if (bad.length){ ui.toast("These don’t look like emails: "+bad.slice(0,3).join(", ")); return false; }
      draft.config.invitedEmails = [...new Set(emails)];
    } else draft.config.invitedEmails = [];
    const dl = document.getElementById("w-deadline").value;
    draft.config.deadline = dl ? new Date(dl).getTime() : 0;
    persist(); return true;
  }

  /* ---------- step 5: review & publish ---------- */
  function step5(){
    const goal = (TN_CONFIG.goals.find(g=>g.id===draft.goal)||{}).label;
    shell(
      '<h3>Review and publish</h3><p class="small">Your test is <strong>private by default</strong> — only people with your link (or on your invite list) can respond.</p>'+
      '<dl>'+
      '<div class="review-row"><dt>Title</dt><dd>'+ui.esc(draft.title)+'</dd></div>'+
      '<div class="review-row"><dt>Type</dt><dd>'+ui.esc((TN_CONFIG.testTypes.find(t=>t.id===draft.type)||{}).title||"")+'</dd></div>'+
      '<div class="review-row"><dt>Question</dt><dd>'+ui.esc(draft.question)+'</dd></div>'+
      '<div class="review-row"><dt>Goal</dt><dd>'+ui.esc(goal)+'</dd></div>'+
      '<div class="review-row"><dt>Variations</dt><dd>'+draft.variations.length+' ('+draft.variations.map(v=>ui.esc(v.label||"Option")).join(", ")+')</dd></div>'+
      '<div class="review-row"><dt>Response target</dt><dd>'+draft.config.targetResponses+'</dd></div>'+
      '<div class="review-row"><dt>Access</dt><dd>'+(draft.config.access==="link"?"Anyone with the private link":"Invited emails only ("+draft.config.invitedEmails.length+")")+'</dd></div>'+
      '<div class="review-row"><dt>Names</dt><dd>'+(draft.config.anonymous==="visible"?"Visible to you":"Hidden from you")+'</dd></div>'+
      (draft.config.deadline?'<div class="review-row"><dt>Deadline</dt><dd>'+ui.fmtDate(draft.config.deadline)+'</dd></div>':"")+
      '</dl>'+
      '<div class="form-note"><strong>Choice + reason, every time.</strong><br>No AI judges your options.</div>'+
      '<button class="btn btn-primary btn-block" id="w-publish">Publish test</button>'+
      '<p class="small center mt">You can close the test any time from your dashboard.</p>');
    document.getElementById("w-publish").onclick = async (e)=>{
      const btn = e.target.closest("button") || document.getElementById("w-publish");
      btn.disabled = true;
      draft.status = "live";
      draft.publishedAt = Date.now();
      try {
        await S.upsertTest(draft);
      } catch(ex){
        draft.status = "draft";
        btn.disabled = false;
        ui.toast("Couldn't publish: " + ex.message);
        return;
      }
      ui.toast("Your test is live.");
      location.hash = "#/tests/"+draft.id+"/published";
    };
  }

  const collectors = {1:collect1,2:collect2,3:collect3,4:collect4,5:()=>true};
  function collect(){ return collectors[step](); }
  function render(){
    ({1:step1,2:step2,3:step3,4:step4,5:step5})[step]();
  }

  TN.views.wizard = function(testId){
    const user = auth.currentUser();
    if (testId){
      const t = S.getTest(testId);
      if (!t || t.ownerId!==user.id){ TN.views.notFound("Test not found."); return; }
      if (t.status!=="draft"){ location.hash = "#/tests/"+t.id+"/results"; return; }
      draft = t; step = 1;
    } else {
      draft = newDraft(user.id); step = 1;
    }
    render();
  };

  /* ---------- published screen ---------- */
  TN.views.published = function(testId){
    const user = auth.currentUser();
    const t = S.getTest(testId);
    if (!t || t.ownerId!==user.id){ TN.views.notFound("Test not found."); return; }
    const shareUrl = location.origin + location.pathname + "#/t/" + t.publicId;
    const subject = encodeURIComponent("Your take? "+t.title);
    const body = encodeURIComponent("Hi — I’m deciding between a few versions of something and I’d value your honest take. It takes about 2 minutes; every response includes a choice and a written reason.\n\n"+shareUrl+"\n\nThank you!");
    document.getElementById("app").innerHTML =
      '<div class="wrap-narrow"><div class="card" style="max-width:620px;margin:1rem auto">'+
      '<p class="eyebrow">Published</p><h2>Your test is live</h2>'+
      '<p class="small">“'+ui.esc(t.title)+'” is private by default — only people with this link can respond.</p>'+
      '<div class="share-box mb"><code>'+ui.esc(shareUrl)+'</code>'+
      '<button class="btn btn-primary btn-sm" id="p-copy">Copy link</button></div>'+
      '<div style="display:grid;gap:.6rem">'+
      '<a class="btn btn-secondary" href="mailto:?subject='+subject+'&body='+body+'">Invite by email</a>'+
      '<a class="btn btn-secondary" href="#/t/'+t.publicId+'?preview=1">Preview participant view</a>'+
      '<a class="btn btn-primary" href="#/tests/'+t.id+'/results">Go to results</a>'+
      '</div></div></div>';
    document.getElementById("p-copy").onclick = ()=> ui.copyLink(shareUrl, "Share link copied");
  };
})();
