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

  /* Passwordless code flow: email in, 6-digit code in, done.
     One flow for signup and login — new accounts are created on the spot. */
  function codeFlow(mountId, ctaLabel){
    function step1(){
      document.getElementById(mountId).innerHTML =
        '<form id="cf-email-form">'+
        '<div class="field"><label for="cf-email">Email</label>'+
        '<input id="cf-email" type="email" autocomplete="email" required placeholder="you@example.com"></div>'+
        '<button class="btn btn-primary btn-block" type="submit">'+ctaLabel+'</button>'+
        '<p class="small center mt">We’ll email you a 6-digit code. No password to remember.</p></form>';
      document.getElementById("cf-email-form").onsubmit = async e=>{
        e.preventDefault();
        const btn = e.target.querySelector("button");
        btn.disabled = true;
        try {
          const { email } = await auth.requestEmailCode(document.getElementById("cf-email").value);
          step2(email);
        } catch(ex){ err(ex.message); btn.disabled = false; }
      };
      const inp = document.getElementById("cf-email");
      if (inp) inp.focus();
    }
    function step2(email){
      let resendIn = 60;
      document.getElementById(mountId).innerHTML =
        '<p class="small">We sent a 6-digit code to <strong>'+ui.esc(email)+'</strong>. It expires in 15 minutes.</p>'+
        '<form id="cf-code-form">'+
        '<div class="field"><label for="cf-code">Code</label>'+
        '<input id="cf-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" style="font-size:1.5rem;letter-spacing:.4em;text-align:center"></div>'+
        '<button class="btn btn-primary btn-block" type="submit">Sign in</button></form>'+
        '<p class="small center mt"><button class="btn btn-ghost btn-sm" id="cf-resend" disabled>Resend code in <span id="cf-timer">60</span>s</button><br>'+
        '<button class="btn btn-ghost btn-sm" id="cf-change">Use a different email</button></p>';
      const timer = setInterval(()=>{
        resendIn--;
        const t = document.getElementById("cf-timer");
        const rb = document.getElementById("cf-resend");
        if (!t || !rb){ clearInterval(timer); return; }
        if (resendIn <= 0){ clearInterval(timer); rb.disabled = false; rb.textContent = "Resend code"; }
        else t.textContent = resendIn;
      }, 1000);
      document.getElementById("cf-code-form").onsubmit = async e=>{
        e.preventDefault();
        const btn = e.target.querySelector("button");
        btn.disabled = true;
        try {
          const { claimed } = await auth.verifyEmailCode(email, document.getElementById("cf-code").value);
          clearInterval(timer);
          if (claimed > 0) ui.toast("Welcome! "+claimed+" feedback credit"+(claimed>1?"s":"")+" added from your earlier responses.");
          afterAuth();
        } catch(ex){ err(ex.message); btn.disabled = false; }
      };
      document.getElementById("cf-resend").onclick = async e=>{
        e.target.disabled = true;
        try { await auth.requestEmailCode(email); ui.toast("New code sent."); }
        catch(ex){ err(ex.message); }
        clearInterval(timer);
        step2(email);
      };
      document.getElementById("cf-change").onclick = ()=>{ clearInterval(timer); step1(); };
      const inp = document.getElementById("cf-code");
      if (inp) inp.focus();
    }
    step1();
  }

  TN.views.login = function(){
    shell("Welcome back",
      '<div id="code-flow"></div>'+
      '<div class="divider"></div>'+
      '<details><summary class="small">Prefer a password or magic link?</summary><div style="margin-top:1rem">'+
      '<form id="f-login">'+
        '<div class="field"><label for="li-email">Email</label>'+
        '<input id="li-email" type="email" autocomplete="email" required></div>'+
        '<div class="field"><label for="li-pass">Password</label>'+
        '<input id="li-pass" type="password" autocomplete="current-password" required></div>'+
        '<button class="btn btn-secondary btn-block" type="submit">Log in with password</button>'+
      '</form>'+
      '<div class="divider"></div>'+
      '<form id="f-magic">'+
        '<p class="small" style="margin-bottom:.6rem"><strong>Magic link</strong> — we’ll email you a sign-in link instead.</p>'+
        '<div class="field"><label for="ml-email">Email</label>'+
        '<input id="ml-email" type="email" autocomplete="email" required></div>'+
        '<button class="btn btn-secondary btn-block" type="submit">Email me a sign-in link</button>'+
      '</form>'+
      '</div></details>'+
      '<p class="small center mt">No account yet? <a href="#/signup">Create one</a></p>',
      "The fastest way in: we email you a 6-digit code.");
    codeFlow("code-flow", "Email me a code →");
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
      '<div id="code-flow"></div>'+
      '<p class="small center mt">Have an account? <a href="#/login">Log in</a></p>',
      "No password needed — we email you a 6-digit code and your account is created on the spot.");
    codeFlow("code-flow", "Create my account →");
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
