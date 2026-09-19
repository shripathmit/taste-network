/* Taste Network — auth views: login, signup, magic link, onboarding */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui, auth = TN.auth;

  function shell(title, inner, sub){
    document.getElementById("app").innerHTML =
      '<div class="wrap-narrow"><div class="auth-shell">'+
      '<div class="auth-art" style="background-image:url(assets/img/orb-abstract.jpg)" aria-hidden="true"></div>'+
      '<div class="auth-body">'+
      '<h2 style="margin-bottom:.25rem">'+ui.esc(title)+'</h2>'+
      (sub?'<p class="small">'+sub+'</p>':"")+
      '<div id="form-err"></div>'+inner+'</div></div></div>';
  }
  function err(msg){
    document.getElementById("form-err").innerHTML = '<div class="form-error" role="alert">'+ui.esc(msg)+'</div>';
  }
  function nextUrl(){
    const m = (location.hash.match(/next=([^&]+)/)||[])[1];
    return m ? decodeURIComponent(m) : "#/dashboard";
  }
  function afterAuth(){
    const u = auth.currentUser();
    if (u && !u.role) location.hash = "#/onboarding";
    else location.hash = nextUrl();
  }

  TN.views.login = function(){
    shell("Welcome back", `
      <form id="f-login">
        <div class="field"><label for="li-email">Email</label>
          <input id="li-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="li-pass">Password</label>
          <input id="li-pass" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary btn-block" type="submit">Log in</button>
      </form>
      <div class="divider"></div>
      <form id="f-magic">
        <p class="small" style="margin-bottom:.6rem"><strong>Prefer no password?</strong> We’ll email you a sign-in link.</p>
        <div class="field"><label for="ml-email">Email</label>
          <input id="ml-email" type="email" autocomplete="email" required></div>
        <button class="btn btn-secondary btn-block" type="submit">Email me a sign-in link</button>
      </form>
      <p class="small center mt">No account yet? <a href="#/signup">Create one</a></p>`);
    document.getElementById("f-login").onsubmit = async e => {
      e.preventDefault();
      try {
        await auth.login(document.getElementById("li-email").value, document.getElementById("li-pass").value);
        afterAuth();
      } catch(ex){ err(ex.message); }
    };
    document.getElementById("f-magic").onsubmit = async e => {
      e.preventDefault();
      try {
        const { email } = await auth.requestMagicLink(document.getElementById("ml-email").value);
        location.hash = "#/magic?e="+encodeURIComponent(email);
      } catch(ex){ err(ex.message); }
    };
  };

  TN.views.signup = function(){
    shell("Create your account",
      `<form id="f-signup">
        <div class="field"><label for="su-name">Your name</label>
          <input id="su-name" type="text" autocomplete="name" required></div>
        <div class="field"><label for="su-email">Email</label>
          <input id="su-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="su-pass">Password</label>
          <input id="su-pass" type="password" autocomplete="new-password" required minlength="8">
          <p class="hint">At least 8 characters.</p></div>
        <button class="btn btn-primary btn-block" type="submit">Create account</button>
      </form>
      <p class="small center mt">Have an account? <a href="#/login">Log in</a></p>`,
      "Real human feedback in minutes.");
    document.getElementById("f-signup").onsubmit = async e => {
      e.preventDefault();
      try {
        const { claimed, needsConfirmation, email } = await auth.signup({
          name: document.getElementById("su-name").value,
          email: document.getElementById("su-email").value,
          password: document.getElementById("su-pass").value
        });
        if (needsConfirmation){
          document.getElementById("app").innerHTML =
            '<div class="wrap-narrow"><div class="auth-shell">'+
            '<div class="auth-art" style="background-image:url(assets/img/hero-abstract.jpg)" aria-hidden="true"></div>'+
            '<div class="auth-body">'+
            '<h2>Check your email</h2>'+
            '<p>We sent a confirmation link to <strong>'+ui.esc(email)+'</strong>. Click it, then log in.</p>'+
            '<p class="small"><a href="#/login">Back to log in</a></p></div></div></div>';
          return;
        }
        if (claimed > 0) ui.toast("Welcome! "+claimed+" feedback credit"+(claimed>1?"s":"")+" added from your earlier responses.");
        afterAuth();
      } catch(ex){ err(ex.message); }
    };
  };

  // "sent" screen — Supabase emails a real sign-in link that returns here
  TN.views.magicSent = function(){
    const q = new URLSearchParams((location.hash.split("?")[1]||""));
    const email = q.get("e");
    document.getElementById("app").innerHTML =
      '<div class="wrap-narrow"><div class="auth-shell">'+
      '<div class="auth-art" style="background-image:url(assets/img/band-abstract.jpg)" aria-hidden="true"></div>'+
      '<div class="auth-body">'+
      '<h2>Check your email</h2>'+
      '<p>We sent a sign-in link to <strong>'+ui.esc(email||"your inbox")+'</strong>. It expires in 15 minutes.</p>'+
      '<p class="small">Click the link and you’ll be signed in automatically.</p>'+
      '</div></div></div>';
  };

  TN.views.onboarding = function(){
    const user = auth.currentUser();
    if (!user){ location.hash = "#/login"; return; }
    document.getElementById("app").innerHTML =
      '<div class="wrap-narrow"><div class="card" style="max-width:620px;margin:1rem auto">'+
      '<p class="eyebrow">Welcome, '+ui.esc(user.name.split(" ")[0])+'</p>'+
      '<h2>What brings you to Taste Network?</h2>'+
      '<p class="small">Pick the one that fits best — you can do both things either way.</p>'+
      '<div class="role-cards" role="radiogroup" aria-label="Your role">'+
        '<button class="radio-card" data-role="creator"><div class="t">I want feedback</div><div class="d">I’m deciding between versions of something and want real human takes.</div></button>'+
        '<button class="radio-card" data-role="taster"><div class="t">I like giving feedback</div><div class="d">I enjoy reacting to early ideas and explaining what resonates.</div></button>'+
        '<button class="radio-card" data-role="both"><div class="t">Both</div><div class="d">I want feedback on my work and I like weighing in on others’.</div></button>'+
      '</div>'+
      '<p class="small" id="ob-hint" style="min-height:1.4em"></p>'+
      '</div></div>';
    document.querySelectorAll(".role-cards .radio-card").forEach(btn=>{
      btn.onclick = ()=>{
        auth.setRole(user.id, btn.dataset.role);
        ui.toast("You’re all set — welcome to Taste Network.");
        location.hash = "#/dashboard";
      };
      btn.onmouseenter = ()=> btn.classList.add("selected");
      btn.onmouseleave = ()=> btn.classList.remove("selected");
    });
  };
})();
