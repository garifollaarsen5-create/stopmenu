// ===== stopmenu · Supabase Auth + REST (кітапханасыз) =====

const API = (() => {
  const cfg = window.STOPMENU_CONFIG;
  const KEY = "stopmenu_session";
  const base = () => cfg.supabaseUrl.replace(/\/$/, "");
  let session = null;

  try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { session = null; }

  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const user = () => (session && session.user) || null;

  function save(data) {
    session = data && data.access_token
      ? {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
          user: data.user ? { id: data.user.id, email: data.user.email } : (session && session.user) || null,
        }
      : null;
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch (e) {}
    return session;
  }

  async function auth(path, body) {
    const res = await fetch(`${base()}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error_description || data.msg || data.message || `auth ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function signIn(email, password) {
    return save(await auth("token?grant_type=password", { email, password }));
  }

  async function refresh() {
    if (!session || !session.refresh_token) throw new Error("no session");
    return save(await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token }));
  }

  function signOut() {
    const token = session && session.access_token;
    save(null);
    if (token) {
      fetch(`${base()}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  // PostgREST сұрауы; токеннің мерзімі бітсе — бір рет жаңартып, қайталайды
  async function rest(path, options = {}, retry = true) {
    if (session && session.expires_at - 60 < Math.floor(Date.now() / 1000)) {
      try { await refresh(); } catch (e) { signOut(); throw e; }
    }
    const res = await fetch(`${base()}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${(session && session.access_token) || cfg.supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (res.status === 401 && retry && session) {
      try { await refresh(); } catch (e) { signOut(); throw e; }
      return rest(path, options, false);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`rest ${res.status}: ${text}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json().catch(() => null);
  }

  return {
    configured, user, signIn, signOut, rest,
    sites: () => rest("sites?select=slug,name,site_url,menu_url&order=name"),
    stopList: (slug) => rest(`stop_items?select=item_id&site_slug=eq.${encodeURIComponent(slug)}`),
    stop: (slug, itemId) => rest("stop_items", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ site_slug: slug, item_id: itemId, stopped_by: user().id }),
    }),
    unstop: (slug, itemId) => rest(
      `stop_items?site_slug=eq.${encodeURIComponent(slug)}&item_id=eq.${encodeURIComponent(itemId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    ),
  };
})();
