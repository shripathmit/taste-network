/* Taste Network — creator dashboard */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, S = TN.store, auth = TN.auth;

  function statusBadge(s){
    return '<span class="badge badge-'+s+'">'+s+'</span>';
  }

  TN.views.dashboard = function(){
    const user = auth.currentUser();
    const tests = S.myTests(user.id);
    const app = document.getElementById("app");

    let list;
    if (!tests.length){
      list = '<div class="empty-state"><div class="empty-art" style="background-image:url(assets/img/orb-abstract.jpg)"></div><h3>No tests yet</h3>'+
        '<p>Add two to five versions of what you’re deciding on, share a private link, and hear what real people think.</p>'+
        '<a class="btn btn-primary" href="#/tests/new">Create your first test</a></div>';
    } else {
      list = tests.map(t=>{
        const n = S.responsesFor(t.id).length;
        const goal = (TN_CONFIG.goals.find(g=>g.id===t.goal)||{}).label || t.goal;
        const shareUrl = location.origin + location.pathname + "#/t/" + t.publicId;
        // In-app "new responses" signal: count responses newer than the owner's last results view.
        let seen = 0;
        try { seen = parseInt(localStorage.getItem("tn_seen_"+t.id) || "0", 10); } catch(e){}
        const newCount = S.responsesFor(t.id).filter(r=>r.createdAt>seen).length;
        return '<div class="test-row" data-test="'+t.id+'">'+
          '<div class="grow"><h3><a href="#/tests/'+t.id+'/results">'+ui.esc(t.title||"(untitled test)")+'</a></h3>'+
          '<div class="test-meta">'+statusBadge(t.status)+
          (newCount?'<span class="badge badge-live">'+newCount+' new</span>':"")+
          '<span>'+n+' response'+(n===1?"":"s")+'</span>'+
          '<span>'+ui.esc(goal)+'</span>'+
          '<span>Created '+ui.fmtDate(t.createdAt)+'</span></div></div>'+
          '<div class="test-actions">'+
          (t.status==="draft"
            ? '<a class="btn btn-secondary btn-sm" href="#/tests/'+t.id+'/edit">Edit draft</a>'
            : '<a class="btn btn-secondary btn-sm" href="#/tests/'+t.id+'/results">View results</a>')+
          (t.status==="live" ? '<button class="btn btn-secondary btn-sm" data-act="copy" data-url="'+ui.esc(shareUrl)+'">Copy share link</button>' : "")+
          (t.status==="live" ? '<button class="btn btn-ghost btn-sm" data-act="close">Close test</button>' : "")+
          (t.status==="closed" ? '<button class="btn btn-secondary btn-sm" data-act="reopen">Reopen</button>' : "")+
          '</div></div>';
      }).join("");
    }

    app.innerHTML =
      '<div class="wrap"><div class="page-head"><div>'+
      '<h2 style="margin-bottom:.2rem">My tests</h2>'+
      '<p class="small" style="margin:0">Private by default — share a link only with people whose judgment you want.</p>'+
      '</div><a class="btn btn-primary" href="#/tests/new">Create test</a></div>'+
      list+'</div>';

    app.querySelectorAll("[data-act]").forEach(btn=>{
      btn.onclick = async ()=>{
        const row = btn.closest("[data-test]");
        const t = S.getTest(row.dataset.test);
        if (btn.dataset.act === "copy"){
          ui.copyLink(btn.dataset.url, "Share link copied");
        } else if (btn.dataset.act === "close"){
          const ok = await ui.confirmDialog({ title:"Close this test?",
            body:"Respondents will no longer be able to submit. Existing responses stay visible to you.",
            confirmLabel:"Close test", danger:true });
          if (ok){ t.status="closed"; t.closedAt=Date.now(); S.upsertTest(t); ui.toast("Test closed."); TN.router.render(); }
        } else if (btn.dataset.act === "reopen"){
          t.status="live"; t.closedAt=0; S.upsertTest(t); ui.toast("Test reopened."); TN.router.render();
        }
      };
    });
  };
})();
