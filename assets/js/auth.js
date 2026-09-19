/* Taste Network — authentication via Supabase Auth.
   Email/password + real magic-link emails (Supabase sends them). Session is
   managed by supabase-js; currentUser() stays synchronous by caching the
   profile, refreshed at boot and on auth state changes.
   The rest of the app only calls: currentUser, signup, login, logout,
   requestMagicLink, isAdmin, setRole, updateProfile, validEmail. */
window.TN = window.TN || {};
(function(){
  const ui = TN.ui;
  let cachedUser = null;

  function validEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e||"").trim()); }
  function redirectTo(){ return location.origin + location.pathname; }

  async function ensureProfile(authUser, fallbackName){
    const sb = TN.sb.client();
    const { data } = await sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
    if (data) return profileOf(authUser, data);
    const name = fallbackName
      || (authUser.user_metadata && authUser.user_metadata.name)
      || String(authUser.email || "").split("@")[0];
    const row = { id: authUser.id, email: String(authUser.email || "").toLowerCase(),
                  name: String(name || "").trim(), role: null };
    const { error } = await sb.from("profiles").insert(row);
    if (error) console.warn("profile insert:", error.message);
    return profileOf(authUser, row);
  }

  function profileOf(authUser, row){
    return {
      id: authUser.id,
      email: String(authUser.email || "").toLowerCase(),
      name: row.name || String(authUser.email || "").split("@")[0],
      role: row.role || null,
      is_admin: !!row.is_admin,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  async function setCached(authUser, fallbackName){
    cachedUser = authUser ? await ensureProfile(authUser, fallbackName) : null;
  }

  async function init(){
    if (!TN.sb.configured()) return;
    const sb = TN.sb.client();
    const { data: { session } } = await sb.auth.getSession();
    await setCached(session && session.user);
    if (session && session.user) {
      // fresh sign-in (e.g. magic-link redirect): collect pending credits
      try { await TN.store.claimPendingCredits(); } catch(e){}
    }
    sb.auth.onAuthStateChange(async (event, sess) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED"){
        await setCached(sess && sess.user);
      } else if (event === "SIGNED_OUT"){
        cachedUser = null;
      }
    });
  }

  async function signup({name, email, password}){
    email = String(email||"").trim().toLowerCase();
    name = String(name||"").trim();
    if (!validEmail(email)) throw new Error("Please enter a valid email address.");
    if (!name) throw new Error("Please tell us your name.");
    if (!password || password.length < 8) throw new Error("Password needs at least 8 characters.");
    const sb = TN.sb.client();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: redirectTo() }
    });
    if (error){
      if (/already registered|already exists/i.test(error.message))
        throw new Error("An account with this email already exists. Try logging in.");
      throw new Error(error.message);
    }
    if (!data.session){
      // email confirmation is on: user must click the link first
      return { user: null, claimed: 0, needsConfirmation: true, email };
    }
    await setCached(data.user, name);
    const claimed = await TN.store.claimPendingCredits().catch(()=>0);
    return { user: cachedUser, claimed };
  }

  async function login(email, password){
    email = String(email||"").trim().toLowerCase();
    const sb = TN.sb.client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(
      /invalid login credentials/i.test(error.message)
        ? "Incorrect email or password. Try again or use a magic link."
        : /email not confirmed/i.test(error.message)
          ? "Please confirm your email first — check your inbox for the link."
          : error.message);
    await setCached(data.user);
    const claimed = await TN.store.claimPendingCredits().catch(()=>0);
    if (claimed > 0) ui.toast("Welcome back! "+claimed+" feedback credit"+(claimed>1?"s":"")+" added from your earlier responses.");
    return cachedUser;
  }

  async function logout(){
    if (TN.sb.configured()){ try { await TN.sb.client().auth.signOut(); } catch(e){} }
    cachedUser = null;
    location.hash = "#/";
  }

  // Real magic link: Supabase emails it. The link returns to this app, where
  // supabase-js picks up the session automatically on page load.
  async function requestMagicLink(email){
    email = String(email||"").trim().toLowerCase();
    if (!validEmail(email)) throw new Error("Please enter a valid email address.");
    const { error } = await TN.sb.client().auth.signInWithOtp({
      email, options: { emailRedirectTo: redirectTo() }
    });
    if (error) throw new Error(error.message);
    return { email };
  }

  function currentUser(){ return cachedUser; }

  function isAdmin(user){
    if (!user) return false;
    if (user.is_admin) return true;
    return (TN_CONFIG.adminEmails||[]).map(e=>e.toLowerCase()).includes(String(user.email||"").toLowerCase());
  }

  async function setRole(userId, role){
    if (!TN.sb.configured()) return;
    await TN.sb.client().from("profiles").update({ role }).eq("id", userId);
    if (cachedUser && cachedUser.id === userId) cachedUser.role = role;
  }

  async function updateProfile(userId, {name, role}){
    if (!TN.sb.configured()) return cachedUser;
    const patch = {};
    if (name) patch.name = String(name).trim();
    if (role) patch.role = role;
    // optimistic: the view re-renders immediately after calling us
    if (cachedUser && cachedUser.id === userId) Object.assign(cachedUser, patch);
    const { error } = await TN.sb.client().from("profiles").update(patch).eq("id", userId);
    if (error) console.warn("updateProfile:", error.message);
    return cachedUser;
  }

  TN.auth = { init, signup, login, logout, currentUser, requestMagicLink,
              isAdmin, setRole, updateProfile, validEmail };
})();
