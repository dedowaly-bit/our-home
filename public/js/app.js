window.App = (function () {
  const S = window.Store, UI = window.UI, I = window.I18N;
  const t = (k) => I.t(k);
  const h = UI.h;
  const app = document.getElementById("app");

  const NAV = [
    { key: "dashboard", href: "#/dashboard", icon: "home", label: "nav.home" },
    { key: "transactions", href: "#/transactions", icon: "list", label: "nav.transactions" },
    { key: "goals", href: "#/goals", icon: "target", label: "nav.goals" },
    { key: "analytics", href: "#/analytics", icon: "chart", label: "nav.analytics" },
    { key: "profile", href: "#/profile", icon: "user", label: "nav.profile" },
  ];
  const ROUTES = {
    "#/dashboard": { fn: "dashboard", title: "app.name", nav: "dashboard" },
    "#/transactions": { fn: "transactions", title: "nav.transactions", nav: "transactions" },
    "#/budgets": { fn: "budgets", title: "bud.title", nav: "transactions" },
    "#/bills": { fn: "bills", title: "bills.title", nav: "transactions" },
    "#/debts": { fn: "debts", title: "debts.title", nav: "transactions" },
    "#/goals": { fn: "goals", title: "goals.title", nav: "goals" },
    "#/analytics": { fn: "analytics", title: "analytics.title", nav: "analytics" },
    "#/activity": { fn: "activity", title: "activity.title", nav: "analytics" },
    "#/notifications": { fn: "notifications", title: "notif.title", nav: null },
    "#/profile": { fn: "profile", title: "profile.title", nav: "profile" },
    "#/settings": { fn: "settings", title: "settings.title", nav: "profile" },
  };

  let unread = 0;

  function navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  async function refresh() { await S.refreshFamily().catch(() => {}); route(); }

  function applyTheme(theme) {
    const dark = theme === "dark" || (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", !!dark);
  }
  function toggleTheme() {
    const cur = localStorage.getItem("oh_theme") || "system";
    const next = cur === "dark" ? "light" : "dark";
    localStorage.setItem("oh_theme", next); applyTheme(next); UI.toast(next === "dark" ? "🌙" : "☀️");
  }
  function toggleLang() {
    const next = I.getLocale() === "ar" ? "en" : "ar";
    I.setLocale(next); route();
  }

  function themeBtn() { return h("button", { class: "icon-btn", title: t("theme.dark"), onclick: toggleTheme, html: UI.icon(document.documentElement.classList.contains("dark") ? "sun" : "moon", 20) }); }
  function langBtn() { return h("button", { class: "icon-btn", title: t("lang.label"), onclick: toggleLang, html: UI.icon("globe", 20) }); }
  function exportBtn() {
    return h("button", { class: "icon-btn", title: t("export.csv"), onclick: () => {
      const m = UI.modal({
        title: "Export",
        body: h("div", { class: "flex", style: { flexDirection: "column", gap: "10px" } },
          h("button", { class: "btn block", onclick: async () => { try { const data = await S.exportCsv(); download("our-home-transactions.csv", data, "text/csv"); m.close(); UI.toast("✓","ok"); } catch(e){ UI.toast(e.message,"err"); } } }, "📄 CSV"),
          h("button", { class: "btn block", onclick: () => { window.print(); m.close(); } }, "🖨️ PDF (Print)")
        ),
      });
    }}, UI.icon("download", 20));
  }
  function bellBtn() {
    const b = h("button", { class: "icon-btn", title: t("notif.title"), onclick: () => navigate("#/notifications") }, UI.icon("bell", 20));
    if (unread > 0) b.appendChild(h("span", { class: "notif-dot" }));
    return b;
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openQuickAdd(type) {
    if (type === "income" || type === "expense") { if (window._openTx) window._openTx(type); }
  }

  function fabSheet() {
    const sheet = h("div", { class: "fab-sheet", onclick: (e) => { if (e.target === sheet) document.body.removeChild(sheet); } },
      h("div", { class: "panel" },
        h("h3", { style: { marginTop: "0" } }, "➕ " + t("common.add")),
        h("div", { class: "grid cols-2", style: { gap: "12px", marginTop: "8px" } },
          h("button", { class: "card", style: { padding: "22px", textAlign: "center", borderColor: "var(--danger)" }, onclick: () => { document.body.removeChild(sheet); openTransaction("expense"); } },
            h("div", { style: { fontSize: "30px" } }, "💸"), h("div", { style: { fontWeight: "800", marginTop: "6px" } }, t("dash.addExpense"))),
          h("button", { class: "card", style: { padding: "22px", textAlign: "center", borderColor: "var(--success)" }, onclick: () => { document.body.removeChild(sheet); openTransaction("income"); } },
            h("div", { style: { fontSize: "30px" } }, "💰"), h("div", { style: { fontWeight: "800", marginTop: "6px" } }, t("dash.addIncome")))
        ),
        h("button", { class: "btn ghost block", style: { marginTop: "12px" }, onclick: () => document.body.removeChild(sheet) }, t("common.close"))
      )
    );
    document.body.appendChild(sheet);
  }
  // expose transaction modal via Pages (defined below)
  let openTransaction = (type) => { if (window._openTx) window._openTx(type); };

  function bottomNav(activeKey) {
    const nav = h("nav", { class: "bottom-nav" });
    NAV.forEach((n) => {
      const a = h("a", { href: n.href, class: (activeKey === n.key ? "active" : "") },
        h("span", { class: "nav-ic", html: UI.icon(n.icon, 22) }),
        h("span", {}, t(n.label))
      );
      nav.appendChild(a);
    });
    nav.appendChild(h("button", { class: "fab", title: t("common.add"), onclick: fabSheet }, "+"));
    return nav;
  }

  function shell(contentNode, routeInfo) {
    UI.clear(app);
    const header = h("header", { class: "app-header" },
      h("div", { class: "brand-mark", style: { fontSize: "15px" } }, h("span", { class: "brand-dot" }, "🏠"), t(routeInfo.title === "app.name" ? "app.name" : "app.name")),
      h("div", { class: "spacer" }),
      langBtn(), themeBtn(), exportBtn(), bellBtn()
    );
    const main = h("main", { class: "app-main" }, contentNode);
    const nav = bottomNav(routeInfo.nav);
    app.appendChild(h("div", { class: "app-shell" }, header, main, nav));
  }

  async function render() {
    const hash = location.hash || "#/dashboard";
    UI.clear(app);
    app.appendChild(UI.spinner());
    try {
      if (["#/login", "#/register", "#/forgot"].includes(hash)) {
        if (S.state.user) { location.hash = S.state.family ? "#/dashboard" : "#/onboarding"; return; }
        const node = await window.Pages[hash.slice(2)]();
        UI.clear(app); app.appendChild(node); return;
      }
      if (!S.state.user) { location.hash = "#/login"; return; }
      if (hash === "#/onboarding") {
        if (S.state.family) { location.hash = "#/dashboard"; return; }
        const node = await window.Pages.onboarding(); UI.clear(app); app.appendChild(node); return;
      }
      if (!S.state.family) { location.hash = "#/onboarding"; return; }
      const info = ROUTES[hash] || ROUTES["#/dashboard"];
      const content = await window.Pages[info.fn]();
      shell(content, info);
      updateUnread();
    } catch (e) {
      console.error(e);
      UI.clear(app); app.appendChild(UI.emptyState("⚠️", "Error", e.message, h("button", { class: "btn", onclick: () => route() }, t("common.back"))));
    }
  }
  function route() { render(); }

  async function updateUnread() {
    try { const r = await S.listNotifications(); unread = r.notifications.filter((n) => !n.read).length; } catch (e) { unread = 0; }
  }

  async function boot() {
    applyTheme(localStorage.getItem("oh_theme") || "system");
    try { await S.me(); } catch (e) { S.state.user = null; }
    window.addEventListener("hashchange", route);
    render();
    // expose quick add
    window._openTx = (type) => { if (window.Pages && window.Pages._txModal) window.Pages._txModal(type); };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  return { navigate, refresh, route, openQuickAdd };
})();
