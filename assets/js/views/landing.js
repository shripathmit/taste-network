/* Taste Network — landing page */
window.TN = window.TN || {};
TN.views = TN.views || {};
(function(){
  const ui = TN.ui;

  TN.views.landing = function(){
    const app = document.getElementById("app");
    const user = TN.auth.currentUser();
    app.innerHTML =
    '<section class="hero"><div class="wrap hero-grid">'+
      '<div>'+
        '<p class="eyebrow">Human feedback, before you ship</p>'+
        '<h1>Choose what to ship, with real human feedback.</h1>'+
        '<p class="lede">Compare ideas, copy, designs, and pitches with real people. Every response includes a choice and a reason.</p>'+
        '<div class="hero-ctas">'+
          '<a class="btn btn-primary" href="'+(user?"#/tests/new":"#/signup")+'">Create a test</a>'+
          '<a class="btn btn-secondary" href="#/give">Give feedback</a>'+
        '</div>'+
        '<div class="trust-line" role="note"><span class="dot" aria-hidden="true"></span>'+
        '<p><strong>No AI judges your work.</strong> Real people compare your options, pick what resonates, and tell you why. You make the final call.</p></div>'+
      '</div>'+
      '<div>'+
        '<div class="demo-card" aria-label="Example result">'+
          '<p class="demo-tag">Example result · mock data</p>'+
          '<h3 style="font-size:1.3rem;margin-bottom:.25rem">Which landing-page headline is clearest?</h3>'+
          '<p class="small">Among the people who responded, <strong>Option A</strong> was chosen most often.</p>'+
          '<div class="result-bar-row"><span>Option A</span>'+ui.bar(64)+'<span><strong>9</strong> · 64%</span></div>'+
          '<div class="result-bar-row"><span>Option B</span>'+ui.bar(21,true)+'<span><strong>3</strong> · 21%</span></div>'+
          '<div class="result-bar-row"><span>Option C</span>'+ui.bar(15,true)+'<span><strong>2</strong> · 15%</span></div>'+
          '<div class="quote" style="margin-top:1.2rem">“Says what it is and who it’s for. No guessing.”<div class="q-meta">— chose Option A</div></div>'+
          '<a class="btn btn-secondary btn-sm" href="#/demo-results">See a full example result</a>'+
        '</div>'+
      '</div>'+
    '</div></section>'+

    '<section class="section"><div class="wrap">'+
      '<p class="eyebrow">How it works</p>'+
      '<h2>Three steps to a decision you can trust</h2>'+
      '<div class="steps">'+
        '<div class="step-card"><div class="step-num">1</div><h3>Add your variations</h3><p>Upload two to five versions of the name, headline, design, or pitch you’re deciding between. Add the question you want answered.</p></div>'+
        '<div class="step-card"><div class="step-num">2</div><h3>Invite people or share a private link</h3><p>Send a private link or invite specific email addresses. No account needed for respondents. Every response includes a choice and a written reason.</p></div>'+
        '<div class="step-card"><div class="step-num">3</div><h3>See what resonates, and why</h3><p>Read real preferences with real reasoning — organized by option, with disagreements kept visible. Then you decide what ships.</p></div>'+
      '</div>'+
    '</div></section>'+

    '<section class="section" style="background:var(--bg-soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">'+
      '<div class="wrap"><p class="eyebrow">Our principle</p>'+
      '<h2>In a world of unlimited AI variations,<br>human judgment still matters.</h2>'+
      '<div class="principles">'+
        '<div class="principle"><h3>People decide, not models</h3><p>AI never casts a vote, never declares a winner, and never invents feedback. It may only help organize what real people said — and it says so, plainly.</p></div>'+
        '<div class="principle"><h3>A choice and a reason</h3><p>Every response pairs a pick with written reasoning. You don’t get a score; you get to understand <em>why</em> something resonated.</p></div>'+
        '<div class="principle"><h3>Disagreement stays visible</h3><p>Minority opinions aren’t averaged away. “None of these” and “I need more context” are first-class answers.</p></div>'+
      '</div></div>'+
    '</section>'+

    '<section class="section"><div class="wrap center" style="max-width:36em;margin:0 auto">'+
      '<h2>Ship with confidence in the human kind.</h2>'+
      '<p class="lede" style="margin:0 auto 1.5rem">Start your first test in under five minutes. Share a private link, get thoughtful answers, and decide.</p>'+
      '<a class="btn btn-primary" href="'+(user?"#/tests/new":"#/signup")+'">Create a test</a>'+
    '</div></section>';
  };
})();
