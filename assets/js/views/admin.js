/* Taste Network — admin view (allowlisted emails only) */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store;

  function row(cells){ return "<tr>"+cells.map(c=>"<td>"+c+"</td>").join("")+"</tr>"; }

  TN.views.admin = function(){
    const me = TN.auth.currentUser();
    if (!TN.auth.isAdmin(me)){ location.hash = "#/dashboard"; return; }
    const app = document.getElementById("app");
    const users = S.getUsers(), tests = S.getTests(), responses = S.getResponses();

    const now = Date.now(), day = 86400000;
    const newUsers = users.filter(u=>u.createdAt>now-7*day).length;
    const published = tests.filter(t=>t.status!=="draft").length;
    const avgMs = responses.length ? Math.round(responses.reduce((s,r)=>s+r.durationMs,0)/responses.length/1000) : 0;
    const creators = new Set(tests.filter(t=>t.status!=="draft").map(t=>t.ownerId));
    const repeat = [...creators].filter(id=>tests.filter(t=>t.ownerId===id&&t.status!=="draft").length>1).length;
    const targetSum = tests.filter(t=>t.status!=="draft").reduce((s,t)=>s+(Number(t.config.targetResponses)||0),0);
    const completion = targetSum
      ? Math.round(responses.length / targetSum * 100) : 0;

    const flagged = responses.filter(r=>r.moderation.status==="flagged"||r.moderation.creatorMark==="flagged");
    const pending = responses.filter(r=>r.reviewStatus==="pending").sort((a,b)=>b.createdAt-a.createdAt);

    app.innerHTML = '<div class="wrap"><h2>Admin</h2>'+
      '<p class="small">Internal view. Visible to admin accounts only.</p>'+

      '<div class="stat-row">'+
      '<div class="stat"><div class="n">'+users.length+'</div><div class="l">users ('+newUsers+' new / 7d)</div></div>'+
      '<div class="stat"><div class="n">'+tests.length+'</div><div class="l">tests ('+published+' published)</div></div>'+
      '<div class="stat"><div class="n">'+responses.length+'</div><div class="l">responses submitted</div></div>'+
      '<div class="stat"><div class="n">'+Math.min(completion,999)+'%</div><div class="l">target completion</div></div>'+
      '<div class="stat"><div class="n">'+avgMs+'s</div><div class="l">avg. response time</div></div>'+
      '<div class="stat"><div class="n">'+repeat+'</div><div class="l">repeat creators</div></div>'+
      '</div>'+

      '<div class="tabs" role="tablist">'+
      '<button class="tab on" data-tab="review" role="tab">Review queue ('+pending.length+')</button>'+
      '<button class="tab" data-tab="flagged" role="tab">Flagged ('+flagged.length+')</button>'+
      '<button class="tab" data-tab="users" role="tab">Users</button>'+
      '<button class="tab" data-tab="tests" role="tab">Tests</button>'+
      '<button class="tab" data-tab="responses" role="tab">Responses</button>'+
      '</div><div id="admin-body"></div></div>';

    function decideReview(id, status){
      const all = S.getResponses();
      const r = all.find(x=>x.id===id);
      if (!r || r.reviewStatus!=="pending") return;
      const prev = r.reviewStatus;
      r.reviewStatus = status;
      S.updateResponse(r).then(()=>{
        ui.toast(status==="approved"
          ? "Response approved — it’s now visible to the creator."
          : "Response rejected — it stays hidden everywhere.");
        TN.router.render();
      }).catch(ex=>{
        r.reviewStatus = prev;
        ui.toast("Couldn’t save: "+(ex.message||"unknown error"));
        TN.router.render();
      });
    }

    function show(tab){
      const body = document.getElementById("admin-body");
      if (tab==="review"){
        // The pre-publish gate: every new response lands here first.
        // Approving publishes it to the creator's results; rejecting hides it everywhere.
        body.innerHTML = pending.length
          ? (pending.length>1?'<p style="margin-bottom:.75rem"><button class="btn btn-primary btn-sm" id="ra-all">Approve all '+pending.length+'</button></p>':"")+
            '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Test</th><th>Choice</th><th>Reason</th><th>Submitted</th><th>Action</th></tr></thead><tbody>'+
            pending.map(r=>{
              const t = S.getTest(r.testId);
              return row([
                ui.esc(t?t.title:"—"),
                ui.esc(r.choice),
                "“"+ui.esc(r.reason.slice(0,140))+"…”",
                ui.fmtDate(r.createdAt),
                '<button class="btn btn-secondary btn-sm" data-ra="approved" data-r="'+r.id+'">Approve</button> '+
                '<button class="btn btn-danger-ghost btn-sm" data-ra="rejected" data-r="'+r.id+'">Reject</button>'
              ]);
            }).join("")+'</tbody></table></div>'
          : '<div class="empty-state"><h3>Queue’s clear</h3><p>No responses awaiting review. New submissions land here first.</p></div>';
        body.querySelectorAll("[data-ra]").forEach(b=>{
          b.onclick = ()=>{
            b.disabled = true;
            decideReview(b.dataset.r, b.dataset.ra);
          };
        });
        const allBtn = document.getElementById("ra-all");
        if (allBtn) allBtn.onclick = async ()=>{
          allBtn.disabled = true;
          const all = S.getResponses();
          let ok = 0, fail = 0;
          for (const r of all.filter(x=>x.reviewStatus==="pending")){
            r.reviewStatus = "approved";
            try { await S.updateResponse(r); ok++; }
            catch(e){ r.reviewStatus = "pending"; fail++; }
          }
          ui.toast(ok+" approved"+(fail?"; "+fail+" couldn’t be saved":"")+".");
          TN.router.render();
        };
      } else if (tab==="flagged"){
        body.innerHTML = flagged.length
          ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Test</th><th>Reason</th><th>Flags</th><th>Action</th></tr></thead><tbody>'+
            flagged.map(r=>{
              const t = S.getTest(r.testId);
              return row([
                ui.esc(t?t.title:"—"),
                "“"+ui.esc(r.reason.slice(0,120))+"…”",
                r.flags.join(", ")||"creator-flagged",
                '<button class="btn btn-secondary btn-sm" data-ar="valid" data-r="'+r.id+'">Valid</button> '+
                '<button class="btn btn-secondary btn-sm" data-ar="hidden" data-r="'+r.id+'">Hidden</button> '+
                '<button class="btn btn-danger-ghost btn-sm" data-ar="removed" data-r="'+r.id+'">Remove</button>'
              ]);
            }).join("")+'</tbody></table></div>'
          : '<div class="empty-state"><h3>Nothing flagged</h3><p>No flagged responses right now.</p></div>';
        body.querySelectorAll("[data-ar]").forEach(b=>{
          b.onclick = async ()=>{
            const all = S.getResponses();
            const r = all.find(x=>x.id===b.dataset.r);
            if (!r) return;
            b.disabled = true;
            const prev = r.moderation.status;
            r.moderation.status = b.dataset.ar;
            try {
              await S.updateResponse(r);
              ui.toast("Response marked "+b.dataset.ar+".");
              TN.router.render();
            } catch(ex){
              r.moderation.status = prev;
              b.disabled = false;
              ui.toast("Couldn’t save: "+(ex.message||"unknown error"));
            }
          };
        });
      } else if (tab==="users"){
        body.innerHTML = '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Credits</th></tr></thead><tbody>'+
          users.map(u=>row([ui.esc(u.name),ui.esc(u.email),ui.esc(u.role||"—"),ui.fmtDate(u.createdAt),S.creditBalance(u.id)])).join("")+'</tbody></table></div>';
      } else if (tab==="tests"){
        body.innerHTML = '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Title</th><th>Owner</th><th>Status</th><th>Responses</th><th>Created</th></tr></thead><tbody>'+
          tests.map(t=>{ const o=S.findUserById(t.ownerId);
            return row([ui.esc(t.title),ui.esc(o?o.email:"—"),t.status,S.responsesFor(t.id).length,ui.fmtDate(t.createdAt)]); }).join("")+'</tbody></table></div>';
      } else {
        body.innerHTML = '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Test</th><th>Choice</th><th>Reason</th><th>Confidence</th><th>Status</th></tr></thead><tbody>'+
          responses.slice(0,100).map(r=>{ const t=S.getTest(r.testId);
            return row([ui.esc(t?t.title:"—"),ui.esc(r.choice),"“"+ui.esc(r.reason.slice(0,100))+"…”",ui.esc(r.confidence),
              r.moderation.status+(r.reviewStatus!=="approved"?" · "+r.reviewStatus:"")]); }).join("")+'</tbody></table></div>'+
          (responses.length>100?'<p class="small">Showing 100 of '+responses.length+'.</p>':"");
      }
    }
    show("review");
    app.querySelectorAll(".tab").forEach(b=>{
      b.onclick = ()=>{ app.querySelectorAll(".tab").forEach(x=>x.classList.remove("on")); b.classList.add("on"); show(b.dataset.tab); };
    });
  };
})();
