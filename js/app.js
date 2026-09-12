// ===== stopmenu · басқару панелі =====

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const T = {
  kz: {
    title: "Стоп-лист",
    loginTitle: "Кіру",
    loginLead: "Сайтыңыздың мәзірін басқару үшін логин мен құпиясөзді енгізіңіз.",
    email: "Email",
    password: "Құпиясөз",
    signIn: "Кіру",
    signingIn: "Кіруде…",
    signOut: "Шығу",
    badLogin: "Email немесе құпиясөз қате.",
    netErr: "Байланыс жоқ. Интернетті тексеріп, қайталаңыз.",
    noConfig: "Панель әлі қосылмаған: Supabase баптауы жоқ.",
    noSites: "Сізге әзірге сайт тіркелмеген. Әзірлеушіге хабарласыңыз.",
    lead: "Тағам бітсе — қосқышты өшіріңіз, ол сайтта «Уақытша жоқ» болып тұрады. Қайта пайда болса — қайта қосыңыз.",
    search: "Тағамды іздеу",
    inStock: "Бар",
    stopped: "Стопта",
    stoppedCount: "Стопта",
    resetAll: "Барлығын қайта қосу",
    resetAsk: "Барлық тағамды қайта қосамыз ба?",
    saved: "Сақталды",
    saveErr: "Сақталмады. Интернетті тексеріңіз.",
    menuErr: "Мәзір жүктелмеді. Бетті жаңартыңыз.",
    loading: "Жүктелуде…",
    nothing: "Ештеңе табылмады",
    openSite: "Сайтты ашу"
  },
  ru: {
    title: "Стоп-лист",
    loginTitle: "Вход",
    loginLead: "Введите логин и пароль, чтобы управлять меню своего сайта.",
    email: "Email",
    password: "Пароль",
    signIn: "Войти",
    signingIn: "Входим…",
    signOut: "Выйти",
    badLogin: "Неверный email или пароль.",
    netErr: "Нет связи. Проверьте интернет и повторите.",
    noConfig: "Панель ещё не подключена: нет настроек Supabase.",
    noSites: "К вам пока не привязан сайт. Напишите разработчику.",
    lead: "Блюдо закончилось — выключите переключатель, на сайте оно станет «Временно нет». Появилось — включите обратно.",
    search: "Поиск блюда",
    inStock: "Есть",
    stopped: "Стоп",
    stoppedCount: "В стопе",
    resetAll: "Включить всё",
    resetAsk: "Вернуть все блюда в продажу?",
    saved: "Сохранено",
    saveErr: "Не сохранилось. Проверьте интернет.",
    menuErr: "Меню не загрузилось. Обновите страницу.",
    loading: "Загрузка…",
    nothing: "Ничего не найдено",
    openSite: "Открыть сайт"
  }
};

let LANG = (() => {
  try { return localStorage.getItem("stopmenu_lang") === "ru" ? "ru" : "kz"; } catch (e) { return "kz"; }
})();
const t = (k) => T[LANG][k] || k;
const tr = (o) => (o && (o[LANG] || o.kz)) || "";

const state = { sites: [], site: null, menu: null, cats: null, stopped: new Set(), query: "", busy: new Set() };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const price = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
const globalOf = (name) => { try { return new Function("try{return " + name + "}catch(e){return null}")(); } catch (e) { return null; } };

function toast(text, kind) {
  const el = $("#toast");
  el.textContent = text;
  el.className = "toast is-on toast--" + (kind || "ok");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "toast"; }, 3500);
}

// Клиенттің сайтындағы data.js файлын жүктеп, MENU мен CATEGORIES-ті аламыз
function loadMenu(menuUrl) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = menuUrl + (menuUrl.includes("?") ? "&" : "?") + "v=" + Date.now();
    s.onload = () => {
      const menu = globalOf("MENU");
      const cats = globalOf("CATEGORIES");
      if (!Array.isArray(menu)) return reject(new Error("menu not found"));
      resolve({ menu, cats: Array.isArray(cats) ? cats : null });
    };
    s.onerror = () => reject(new Error("menu load failed"));
    document.head.appendChild(s);
  });
}

// ---------- Кіру беті ----------
function showLogin(error) {
  $("#app").innerHTML = `
    <div class="center">
      <form class="card login" id="login-form" novalidate>
        <div class="brand"><span class="brand__dot"></span>stopmenu</div>
        <h1 class="login__title">${t("loginTitle")}</h1>
        <p class="muted">${t("loginLead")}</p>
        <label class="field">
          <span class="field__label">${t("email")}</span>
          <input class="input" type="email" name="email" autocomplete="username" inputmode="email" required>
        </label>
        <label class="field">
          <span class="field__label">${t("password")}</span>
          <input class="input" type="password" name="password" autocomplete="current-password" required>
        </label>
        ${error ? `<p class="error">${esc(error)}</p>` : ""}
        <button class="btn btn--primary btn--block" type="submit">${t("signIn")}</button>
      </form>
    </div>`;

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-form button");
    const email = e.target.elements.email.value.trim();
    const password = e.target.elements.password.value;
    btn.disabled = true;
    btn.textContent = t("signingIn");
    try {
      await API.signIn(email, password);
      start();
    } catch (err) {
      console.error(err);
      showLogin(err.status === 400 || err.status === 401 ? t("badLogin") : t("netErr"));
    }
  });
}

// ---------- Тізім ----------
function itemRows(items) {
  return items.map((item) => {
    const stopped = state.stopped.has(String(item.id));
    const busy = state.busy.has(String(item.id));
    const p = item.price != null ? item.price : (item.variants && item.variants[0] ? item.variants[0].price : null);
    const base = (state.site.site_url || "").replace(/\/$/, "");
    const img = item.img && base
      ? `<img src="${esc(base)}/img/menu/${esc(item.img)}-s.webp" alt="" loading="lazy">`
      : "";
    return `<label class="row${stopped ? " row--stopped" : ""}">
      <span class="row__img">${img}</span>
      <span class="row__text">
        <span class="row__name">${esc(tr(item.name))}</span>
        ${p != null ? `<span class="row__price">${price(p)}</span>` : ""}
      </span>
      <span class="row__state">${stopped ? t("stopped") : t("inStock")}</span>
      <input class="switch" type="checkbox" data-id="${esc(item.id)}" ${stopped ? "" : "checked"} ${busy ? "disabled" : ""} aria-label="${esc(tr(item.name))}">
    </label>`;
  }).join("");
}

function renderList() {
  const q = state.query.trim().toLowerCase();
  const match = (item) => !q || tr(item.name).toLowerCase().includes(q);
  const cats = state.cats || [{ id: null }];
  let html = "";
  cats.forEach((c) => {
    const items = state.menu.filter((m) => (c.id ? m.cat === c.id : true)).filter(match);
    if (!items.length) return;
    html += `<section class="group">
      ${c.id ? `<h2 class="group__title">${esc(tr(c))}</h2>` : ""}
      <div class="rows">${itemRows(items)}</div>
    </section>`;
  });
  $("#list").innerHTML = html || `<p class="muted">${t("nothing")}</p>`;
  paintCount();
}

function paintCount() {
  $("#stopped-count").textContent = `${t("stoppedCount")}: ${state.stopped.size}`;
  $("#reset-all").hidden = state.stopped.size === 0;
}

// Тек бір жолды жаңартамыз: басу кезінде тізімді қайта сызсақ, қосқыш екі рет ауысып кетеді
function paintRow(id) {
  const input = $(`.switch[data-id="${window.CSS && CSS.escape ? CSS.escape(id) : id}"]`);
  if (!input) return;
  const stopped = state.stopped.has(id);
  const row = input.closest(".row");
  input.checked = !stopped;
  input.disabled = state.busy.has(id);
  row.classList.toggle("row--stopped", stopped);
  const st = row.querySelector(".row__state");
  if (st) st.textContent = stopped ? t("stopped") : t("inStock");
  paintCount();
}

// ---------- Панель ----------
function renderPanel() {
  const site = state.site;
  const base = (site.site_url || "").trim();
  $("#app").innerHTML = `
    <header class="top">
      <div class="wrap">
        <div class="top__row">
          <div>
            <div class="brand"><span class="brand__dot"></span>stopmenu</div>
            <h1 class="top__name">${esc(site.name)}</h1>
          </div>
          <div class="top__tools">
            <div class="lang">
              <button class="lang__btn" data-lang="kz" aria-pressed="${LANG === "kz"}">KZ</button>
              <button class="lang__btn" data-lang="ru" aria-pressed="${LANG === "ru"}">RU</button>
            </div>
            <button class="btn btn--ghost" id="signout">${t("signOut")}</button>
          </div>
        </div>
        ${state.sites.length > 1 ? `<select class="input top__select" id="site-select">
          ${state.sites.map((s) => `<option value="${esc(s.slug)}" ${s.slug === site.slug ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
        </select>` : ""}
        <p class="top__lead">${t("lead")}</p>
        <div class="top__bar">
          <input class="input search" id="search" type="search" placeholder="${t("search")}" value="${esc(state.query)}">
          <span class="chip" id="stopped-count"></span>
          <button class="btn btn--ghost" id="reset-all" hidden>${t("resetAll")}</button>
          ${base ? `<a class="btn btn--ghost" href="${esc(base)}" target="_blank" rel="noopener">${t("openSite")}</a>` : ""}
        </div>
      </div>
    </header>
    <main class="wrap list" id="list"></main>`;

  renderList();
  $("#signout").addEventListener("click", () => { API.signOut(); showLogin(); });
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });
  $$(".lang__btn").forEach((b) => b.addEventListener("click", () => {
    LANG = b.dataset.lang;
    try { localStorage.setItem("stopmenu_lang", LANG); } catch (e) {}
    renderPanel();
  }));
  const select = $("#site-select");
  if (select) select.addEventListener("change", (e) => {
    try { localStorage.setItem("stopmenu_site", e.target.value); } catch (err) {}
    location.reload();
  });
  $("#reset-all").addEventListener("click", resetAll);
  $("#list").addEventListener("change", onToggle);
}

// ---------- Стоп қою / алу ----------
async function onToggle(e) {
  const input = e.target.closest(".switch");
  if (!input) return;
  const id = String(input.dataset.id);
  const stop = !input.checked;              // қосқыш өшірулі = стопта
  state.busy.add(id);
  if (stop) state.stopped.add(id); else state.stopped.delete(id);
  paintRow(id);
  try {
    if (stop) await API.stop(state.site.slug, id);
    else await API.unstop(state.site.slug, id);
    toast(t("saved"));
  } catch (err) {
    console.error(err);
    if (stop) state.stopped.delete(id); else state.stopped.add(id);
    toast(t("saveErr"), "err");
  } finally {
    state.busy.delete(id);
    paintRow(id);
  }
}

async function resetAll() {
  if (!state.stopped.size || !confirm(t("resetAsk"))) return;
  const ids = [...state.stopped];
  state.stopped.clear();
  renderList();
  try {
    for (const id of ids) await API.unstop(state.site.slug, id);
    toast(t("saved"));
  } catch (err) {
    console.error(err);
    ids.forEach((id) => state.stopped.add(id));
    renderList();
    toast(t("saveErr"), "err");
  }
}

function message(text, withSignOut) {
  $("#app").innerHTML = `<div class="center"><div class="card">
    <div class="brand"><span class="brand__dot"></span>stopmenu</div>
    <p class="muted">${esc(text)}</p>
    ${withSignOut ? `<button class="btn btn--ghost btn--block" id="out">${t("signOut")}</button>` : ""}
  </div></div>`;
  const out = $("#out");
  if (out) out.addEventListener("click", () => { API.signOut(); showLogin(); });
}

// ---------- Бастау ----------
async function start() {
  if (!API.configured()) return message(t("noConfig"));
  if (!API.user()) return showLogin();
  $("#app").innerHTML = `<div class="center"><p class="muted">${t("loading")}</p></div>`;
  try {
    state.sites = (await API.sites()) || [];
  } catch (err) {
    console.error(err);
    if (err.status === 401) { API.signOut(); return showLogin(); }
    return message(t("netErr"), true);
  }
  if (!state.sites.length) return message(t("noSites"), true);

  let saved = null;
  try { saved = localStorage.getItem("stopmenu_site"); } catch (e) {}
  state.site = state.sites.find((s) => s.slug === saved) || state.sites[0];

  try {
    const rows = await API.stopList(state.site.slug);
    state.stopped = new Set((rows || []).map((r) => String(r.item_id)));
    const loaded = await loadMenu(state.site.menu_url);
    state.menu = loaded.menu;
    state.cats = loaded.cats;
  } catch (err) {
    console.error(err);
    return message(t("menuErr"), true);
  }
  renderPanel();
}

document.addEventListener("DOMContentLoaded", start);
