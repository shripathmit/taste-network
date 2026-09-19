/* Taste Network — UI helpers */
window.TN = window.TN || {};
(function(){
  const escMap = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
  function esc(s){
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, c => escMap[c]);
  }
  function uid(prefix){
    return (prefix||"") + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  }
  function publicId(){
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i=0;i<8;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }
  function timeAgo(ts){
    const s = Math.floor((Date.now()-ts)/1000);
    if (s < 60) return "just now";
    const m = Math.floor(s/60); if (m < 60) return m+"m ago";
    const h = Math.floor(m/60); if (h < 24) return h+"h ago";
    const d = Math.floor(h/24); if (d < 30) return d+"d ago";
    return new Date(ts).toLocaleDateString();
  }
  function fmtDate(ts){
    return new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  }
  function toast(msg){
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; setTimeout(()=>el.remove(),350); }, 2600);
  }
  function modal(html){
    const root = document.getElementById("modal-root");
    root.innerHTML = '<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">'+html+'</div></div>';
    const back = root.firstElementChild;
    back.addEventListener("click", e => { if (e.target === back) closeModal(); });
    const f = back.querySelector("input,textarea,select,button");
    if (f) f.focus();
  }
  function closeModal(){ document.getElementById("modal-root").innerHTML = ""; }
  function confirmDialog({title, body, confirmLabel, danger}){
    return new Promise(resolve => {
      modal(
        '<h3>'+esc(title)+'</h3><p class="small">'+body+'</p>'+
        '<div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:1.5rem">'+
        '<button class="btn btn-secondary btn-sm" data-x="cancel">Cancel</button>'+
        '<button class="btn btn-sm '+(danger?'btn-danger-ghost':'btn-primary')+'" data-x="ok">'+esc(confirmLabel||"Confirm")+'</button></div>'
      );
      const back = document.querySelector("#modal-root .modal-back");
      back.querySelector('[data-x="cancel"]').onclick = ()=>{ closeModal(); resolve(false); };
      back.querySelector('[data-x="ok"]').onclick = ()=>{ closeModal(); resolve(true); };
    });
  }
  function copyLink(text, label){
    const done = ()=> toast(label || "Link copied to clipboard");
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(()=>fallback());
    } else fallback();
    function fallback(){
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch(e){ toast("Copy this link manually"); }
      ta.remove();
    }
  }
  function initials(name){
    const n = (name||"?").trim().split(/\s+/);
    return (n[0][0] + (n[1] ? n[1][0] : "")).toUpperCase();
  }
  function bar(pct, dim){
    return '<div class="result-bar-track" role="img" aria-label="'+Math.round(pct)+'%"><div class="result-bar-fill'+(dim?' dim':'')+'" style="width:'+Math.max(pct,2)+'%"></div></div>';
  }
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

  TN.ui = { esc, uid, publicId, timeAgo, fmtDate, toast, modal, closeModal, confirmDialog, copyLink, initials, bar, debounce };
})();
