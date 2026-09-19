/* Taste Network — first-run seed data.
   The demo test and its synthetic responses now live in Supabase (see
   supabase/migrations/001_initial.sql), so there is nothing to seed in the
   browser. Kept as a no-op for compatibility with the router boot. */
window.TN = window.TN || {};
(function(){
  function seed(){ /* demo content is seeded server-side via SQL */ }
  TN.seed = { run: seed };
})();
