/* Taste Network — hash router + site chrome */
window.TN = window.TN || {};
(function(){
  const ui = TN.ui;

  function headerHTML(user){
    const admin = TN.auth.isAdmin(user);
    const nav = [
      ["#/dashboard","My tests"],
      ["#/give","Give feedback"],
      ["#/how","How it works"]
    ];
    let links = nav.map(([h,l])=>'<a href="'+h+'" data-nav="'+h+'">'+l+'</a>').join("");
    let right;
    if (user){
      const bal = TN.store.creditBalance(user.id);
      right =
        '<span class="credit-pill" title="Feedback credits">'+bal+' credit'+(bal===1?"":"s")+'</span>'+
        '<a class="avatar" href="#/profile" title="'+ui.esc(user.name)+'">'+ui.initials(user.name)+'</a>'+
        (admin?'<a href="#/admin" data-nav="#/admin">Admin</a>':"")+
        '<button class="btn btn-ghost btn-sm" id="nav-signout">Sign out</button>';
    } else {
      right = '<a class="btn btn-ghost btn-sm" href="#/login">Log in</a>'+
              '<a class="btn btn-primary btn-sm" href="#/signup">Create a test</a>';
    }
    return '<div class="wrap header-inner">'+
      '<a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span>Taste Network</a>'+
      '<nav class="main-nav" aria-label="Primary">'+links+'</nav>'+
      '<div class="header-spacer"></div>'+
      '<div class="header-user">'+right+'</div></div>';
  }

  function footerHTML(){
    return '<div class="wrap footer-grid">'+
      '<div><a class="brand" href="#/" style="font-size:1.05rem"><span class="brand-mark" aria-hidden="true"></span>Taste Network</a>'+
      '<p class="footer-note">A human taste network for choosing what to ship. No AI judges your work — real people make the call.</p></div>'+
      '<div class="footer-links">'+
      '<a href="#/how">How it works</a><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a>'+
      '<a href="mailto:'+TN_CONFIG.supportEmail+'">Contact</a></div></div>';
  }

  function renderChrome(user, path){
    document.getElementById("site-header").innerHTML = headerHTML(user);
    document.getElementById("site-footer").innerHTML = footerHTML();
    const so = document.getElementById("nav-signout");
    if (so) so.onclick = ()=> TN.auth.logout();
    // hide chrome on the respondent flow for a calm, distraction-free page
    const bare = path.startsWith("/t/");
    document.getElementById("site-header").style.display = bare ? "none" : "";
    document.getElementById("site-footer").style.display = bare ? "none" : "";
    document.querySelectorAll("[data-nav]").forEach(a=>{
      if (path === a.getAttribute("data-nav").slice(1)) a.classList.add("active");
    });
  }

  const routes = [
    [/^\/$/,                    ()=>TN.views.landing()],
    [/^\/login$/,               ()=>TN.views.login()],
    [/^\/signup$/,              ()=>TN.views.signup()],
    [/^\/magic$/,               ()=>TN.views.magicSent()],
    [/^\/onboarding$/,          ()=>TN.views.onboarding()],
    [/^\/dashboard$/,           ()=>TN.views.dashboard()],
    [/^\/tests\/new$/,          ()=>TN.views.wizard()],
    [/^\/tests\/([A-Za-z0-9_]+)\/edit$/, m=>TN.views.wizard(m[1])],
    [/^\/tests\/([A-Za-z0-9_]+)\/results$/, m=>TN.views.results(m[1])],
    [/^\/tests\/([A-Za-z0-9_]+)\/published$/, m=>TN.views.published(m[1])],
    [/^\/t\/([A-Za-z0-9_-]+)$/, m=>TN.views.respond(m[1])],
    [/^\/give$/,                ()=>TN.views.give()],
    [/^\/how$/,                 ()=>TN.views.how()],
    [/^\/profile$/,             ()=>TN.views.profile()],
    [/^\/credits$/,             ()=>TN.views.credits()],
    [/^\/admin$/,               ()=>TN.views.admin()],
    [/^\/privacy$/,             ()=>TN.views.privacy()],
    [/^\/terms$/,               ()=>TN.views.terms()],
    [/^\/demo-results$/,        ()=>TN.views.demoResults()]
  ];

  // routes that need a signed-in user
  const authed = new Set(["/dashboard","/tests/new","/onboarding","/profile","/credits","/admin"]);

  function currentPath(){
    return (location.hash || "#/").slice(1).split("?")[0] || "/";
  }

  async function render(){
    const path = currentPath();
    // fresh data on every navigation (reads stay synchronous from the cache)
    try { await TN.store.refresh(); } catch(e){}
    const user = TN.auth.currentUser();
    renderChrome(user, path);

    const needsAuth = [...authed].some(p => path === p || path.startsWith(p+"/")) || path.startsWith("/tests/");
    if (needsAuth && !user){
      location.hash = "#/login?next="+encodeURIComponent(location.hash.slice(1));
      return;
    }
    if (path === "/admin" && !TN.auth.isAdmin(user)){
      TN.views.notFound("Admin access is restricted to the allowlist.");
      window.scrollTo(0,0);
      return;
    }

    let matched = false;
    for (const [re, fn] of routes){
      const m = path.match(re);
      if (m){ matched = true; fn(m); break; }
    }
    if (!matched) TN.views.notFound();
    const app = document.getElementById("app");
    window.scrollTo(0,0);
    app.focus({preventScroll:true});
  }

  async function start(){
    document.getElementById("app").innerHTML =
      '<div class="wrap-narrow center" style="padding:4rem 0"><p class="small">Loading Taste Network…</p></div>';
    TN.sb.init();
    TN.seed.run();
    try {
      await TN.auth.init();
      await TN.store.refresh();
    } catch(e){
      console.warn("boot:", e.message);
    }
    try { await TN.store.ready; } catch(e){}
    window.addEventListener("hashchange", ()=>{ render(); });
    render();
  }

  TN.router = { start, render, currentPath };
})();
