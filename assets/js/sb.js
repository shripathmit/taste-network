/* Taste Network — Supabase client bootstrap.
   The anon key is public by design (it ships in client apps); it is NOT in
   git. server.js injects window.TN_ENV {url, key} from environment variables.
   When unconfigured (e.g. local file preview), the app renders with empty
   data and write attempts fail with a clear error. */
window.TN = window.TN || {};
TN.sb = (function(){
  let client = null;

  function init(){
    const env = window.TN_ENV || {};
    if (!env.url || !env.key || !window.supabase){
      console.warn("Taste Network: Supabase not configured (missing TN_ENV or CDN). Running with empty data.");
      return false;
    }
    client = window.supabase.createClient(env.url, env.key);
    return true;
  }

  function get(){
    if (!client) throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.");
    return client;
  }

  return { init, client: get, configured: ()=> !!client };
})();
