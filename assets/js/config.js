/* Taste Network — central configuration.
   Swap values here to change product behavior without touching views. */
window.TN_CONFIG = {
  appName: "Taste Network",
  tagline: "A human taste network that helps you choose what to ship.",

  // Emails that may open /admin. Edit to your team's addresses.
  adminEmails: ["admin@taste.network"],

  // Feature flags. creditsRequired is intentionally OFF for the MVP:
  // credits are displayed but never block test creation.
  flags: {
    creditsRequired: false,
    themeOrganizer: true
  },

  // Credit economics (non-monetary ledger for the MVP)
  credits: {
    perThoughtfulResponse: 1,
    perPublishedTest: 0
  },

  goals: [
    { id: "clarity",      label: "Clarity",           followup: "What do you think this product, message, or idea is about?" },
    { id: "trust",        label: "Trust",             followup: "What made this feel more or less trustworthy?" },
    { id: "curiosity",    label: "Curiosity",         followup: "What would make you want to learn more?" },
    { id: "memorability", label: "Memorability",      followup: "What do you think you would remember tomorrow?" },
    { id: "premium",      label: "Premium feel",      followup: "What made this feel more or less premium?" },
    { id: "click",        label: "Would you click?",  followup: "What would make you click, or not click?" },
    { id: "overall",      label: "Overall preference",followup: "What made this the stronger option?" }
  ],

  testTypes: [
    { id: "name",        title: "Compare a name",              desc: "Brand, product, or project names — which one sticks?" },
    { id: "headline",    title: "Compare a headline",        desc: "Headlines, taglines, or positioning statements." },
    { id: "visual",      title: "Compare a visual",          desc: "Logo directions, mockups, or design explorations." },
    { id: "pitch",       title: "Compare a pitch",           desc: "Founder pitches, intros, or short messages." },
    { id: "anything",    title: "Compare anything",          desc: "Two to five versions of anything you're deciding on." }
  ],

  responseTargets: [5, 10, 15, 20],

  // Anti-spam / quality thresholds
  quality: {
    minReasonLength: 20,
    minFollowupLength: 10,
    fastResponseMs: 15000,      // below this → flagged "implausibly fast", kept for review
    maxImageBytes: 900000       // compressed data-URL budget per image
  },

  supportEmail: "hello@taste.network"
};
