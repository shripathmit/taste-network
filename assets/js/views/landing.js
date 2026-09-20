/* Taste Network — landing page */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui;

  TN.views.landing = function(){
    const app = document.getElementById("app");
    const user = TN.auth.currentUser();
    const cta = user ? "#/tests/new" : "#/signup";
    app.innerHTML =
    '<section class="hero"><div class="wrap hero-grid">'+
      '<div>'+
        '<p class="eyebrow">Real human feedback</p>'+
        '<h1>Decide what to ship, with people — not guesses.</h1>'+
        '<p class="lede">Compare versions. Real people pick what resonates and tell you why.</p>'+
        '<div class="hero-ctas">'+
          '<a class="btn btn-primary" href="'+cta+'">Create a test</a>'+
          '<a class="btn btn-secondary" href="#/demo-results">See an example</a>'+
        '</div>'+
        '<div class="trust-line" role="note"><span class="dot" aria-hidden="true"></span>'+
        '<p><strong>No AI judges your work.</strong> You always make the final call.</p></div>'+
      '</div>'+
      '<div class="hero-art"><img src="assets/img/hero-abstract.jpg" alt="" aria-hidden="true"></div>'+
    '</div></section>'+

    '<section class="section" style="padding-top:0"><div class="wrap center" style="max-width:36em">'+
      '<p class="eyebrow">Try it live</p>'+
      '<h2>Feel it in 60 seconds.</h2>'+
      '<p class="lede" style="margin:0 auto 1.5rem">Three headlines, one pick, tell us why — the exact flow your respondents get. No account, nothing saved.</p>'+
      '<a class="btn btn-primary" href="#/t/demo-headline">Take the demo test</a>'+
      '<p class="small" style="margin-top:1rem">Then run one on your own headline.</p>'+
    '</div></section>'+

    '<section class="section"><div class="wrap">'+
      '<p class="eyebrow">How it works</p>'+
      '<h2>Three steps to a confident call</h2>'+
      '<div class="steps">'+
        '<div class="step-card"><div class="step-num">1</div><h3>Add variations</h3><p>Two to five versions of the name, headline, design, or pitch — plus your question.</p></div>'+
        '<div class="step-card"><div class="step-num">2</div><h3>Share a private link</h3><p>People compare, pick one, and write why. No account needed to respond.</p></div>'+
        '<div class="step-card"><div class="step-num">3</div><h3>Read, then decide</h3><p>Preferences with reasoning, disagreements kept visible. Then you choose.</p></div>'+
      '</div>'+
    '</div></section>'+

    '<section class="band"><img class="band-art" src="assets/img/band-abstract.jpg" alt="" aria-hidden="true">'+
      '<div class="wrap band-inner">'+
        '<h2>Ship what resonates.</h2>'+
        '<p class="lede" style="margin-bottom:1.5rem">Your first test takes under five minutes.</p>'+
        '<a class="btn btn-primary" href="'+cta+'">Create a test</a>'+
      '</div>'+
    '</section>';
  };
})();

