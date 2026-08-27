window.Pages = (function () {
  const S = window.Store, UI = window.UI, I = window.I18N, C = window.UICharts;
  const t = (k) => I.t(k);
  const h = UI.h;
  const cur = () => S.state.currency;

  async function guard(fn) { try { return await fn(); } catch (e) { UI.toast(e.message || "Error", "err"); console.error(e); return UI.emptyState("⚠️", "Something went wrong", e.message); } }

  // ---------- reusable form modal ----------
  function field(key, opts) { return Object.assign({ key }, opts); }
  function openForm(title, fields, onSubmit, submitLabel) {
    const body = h("div");
    const inputs = {};
    fields.forEach((f) => {
      let control;
      if (f.type === "select") {
        control = h("select", { class: "input" }, ...(f.options || []).map((o) => h("option", { value: o.value, selected: o.value === f.value ? "selected" : false }, o.label)));
      } else if (f.type === "textarea") {
        control = h("textarea", { class: "input", placeholder: f.placeholder || "" }, f.value || "");
      } else if (f.type === "segment") {
        const seg = h("div", { class: "seg" });
        let val = f.value || f.options[0].value;
        f.options.forEach((o) => {
          const b = h("button", { type: "button", class: o.value === val ? "active" : "", onclick: () => { val = o.value; seg.querySelectorAll("button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); } }, o.label);
          seg.appendChild(b);
        });
        control = seg;
        inputs[f.key + "__seg"] = () => val;
      } else {
        control = h("input", { class: "input", type: f.type || "text", placeholder: f.placeholder || "", value: f.value || "" });
      }
      inputs[f.key] = control;
      body.appendChild(h("div", { class: "field" }, h("label", {}, f.label + (f.optional ? " (" + t("common.optional") + ")" : "")), control));
    });
    const submit = h("button", { class: "btn primary block" }, submitLabel || t("common.save"));
    const m = UI.modal({
      title,
      body,
      footer: h("div", { class: "flex", style: { gap: "10px" } },
        h("button", { class: "btn ghost", onclick: () => m.close() }, t("common.cancel")),
        submit
      ),
    });
    submit.addEventListener("click", async () => {
      const values = {};
      fields.forEach((f) => {
        if (f.type === "segment") values[f.key] = inputs[f.key + "__seg"]();
        else if (f.type === "select") values[f.key] = inputs[f.key].value;
        else values[f.key] = inputs[f.key].value;
      });
      submit.disabled = true; submit.textContent = t("common.loading");
      try { await onSubmit(values, m); m.close(); }
      catch (e) { UI.toast(e.message || "Error", "err"); submit.disabled = false; submit.textContent = submitLabel || t("common.save"); }
    });
    return m;
  }

  // ---------- transaction form (expense/income) ----------
  function openTransactionModal(prefill) {
    prefill = prefill || {};
    const fam = S.state.family;
    const typeOptions = [{ value: "expense", label: t("filter.expense") }, { value: "income", label: t("filter.income") }];
    const catOptions = (fam ? fam.categories : []).filter((c) => prefill.type ? c.type === prefill.type || c.type === "both" : true)
      .map((c) => ({ value: c.name, label: c.name, color: c.color }));
    const memberOptions = [{ value: "", label: t("common.all") }].concat((fam ? fam.members : []).map((m) => ({ value: m.id, label: m.name })));
    const methodOptions = ["cash", "card", "bank", "wallet", "transfer"].map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }));
    const fields = [
      { key: "type", type: "segment", label: "", options: typeOptions, value: prefill.type || "expense" },
      field("amount", { label: t("exp.amount"), type: "number", value: prefill.amount || "" }),
      field("title", { label: prefill.type === "income" ? t("inc.source") : t("exp.name"), value: prefill.title || "" }),
      { key: "category", type: "select", label: t("exp.category"), options: catOptions, value: prefill.category || (catOptions[0] && catOptions[0].value) },
      field("date", { label: t("exp.date"), type: "date", value: UI.toInputDate(prefill.date || new Date()) }),
      { key: "memberId", type: "select", label: prefill.type === "income" ? t("inc.receivedBy") : t("exp.paidBy"), options: memberOptions, value: prefill.memberId || (fam && fam.members[0] ? fam.members[0].id : "") },
      { key: "paymentMethod", type: "select", label: t("exp.method"), options: methodOptions, value: prefill.paymentMethod || "cash" },
      field("notes", { label: t("exp.notes"), type: "textarea", optional: true, value: prefill.notes || "" }),
    ];
    openForm(prefill.title0 ? t("exp.title") : (prefill.type === "income" ? t("inc.title") : t("exp.title")), fields, async (v) => {
      if (!v.amount || Number(v.amount) <= 0) throw new Error("Enter a valid amount");
      await S.addTransaction({
        type: v.type, amount: Number(v.amount), title: v.title, category: v.category,
        date: v.date, memberId: v.memberId || undefined, paymentMethod: v.paymentMethod, notes: v.notes,
      });
      UI.toast(t("common.add") + " ✓", "ok");
      window.App.refresh();
    }, t("common.add"));
  }

  // ---------- shared pieces ----------
  function statCard(ic, label, value, sub, color) {
    color = color || "var(--brand)";
    const bg = color.indexOf("#") === 0 ? color + "22" : "var(--brand-weak)";
    return h("div", { class: "stat" },
      h("div", { class: "ic", style: { background: bg, color } }, UI.icon(ic, 20)),
      h("div", { class: "label" }, label),
      h("div", { class: "value qty" }, value),
      sub ? h("div", { class: "sub" }, sub) : null
    );
  }
  function txRow(tx) {
    const isInc = tx.type === "income";
    return h("div", { class: "row" },
      h("div", { class: "avatar", html: UI.avatar(tx.memberName || "?", null, "") }),
      h("div", { class: "grow" },
        h("div", { class: "name" }, tx.title),
        h("div", { class: "meta" }, tx.category + " · " + UI.date(tx.date) + (tx.memberName ? " · " + tx.memberName : ""))
      ),
      h("div", { class: "amount " + (isInc ? "income" : "expense") }, (isInc ? "+" : "-") + UI.fmt(tx.amount, cur())),
      h("button", { class: "icon-btn", title: t("common.delete"), onclick: async (e) => {
        e.stopPropagation();
        if (await UI.confirm(t("common.confirm"))) { try { await S.deleteTransaction(tx.id); UI.toast("✓"); window.App.refresh(); } catch (err) { UI.toast(err.message, "err"); } }
      }}, UI.icon("trash", 18))
    );
  }

  // ================= AUTH =================
  function authShell(title, subtitle, formNode, footerNode) {
    return h("div", { class: "page-enter", style: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" } },
      h("div", { style: { width: "100%", maxWidth: "400px" } },
        h("div", { class: "brand-mark", style: { justifyContent: "center", marginBottom: "18px", fontSize: "20px" } },
          h("span", { class: "brand-dot" }, "🏠"), "Our Home"),
        h("div", { class: "card" },
          h("h2", { style: { margin: "0 0 4px", fontSize: "22px" } }, title),
          subtitle ? h("p", { class: "muted small", style: { marginTop: 0 } }, subtitle) : null,
          formNode
        ),
        footerNode || null
      )
    );
  }
  async function login() {
    const email = h("input", { class: "input", type: "email", placeholder: "you@email.com" });
    const pw = h("input", { class: "input", type: "password", placeholder: "••••••" });
    const submit = h("button", { class: "btn primary block", style: { marginTop: "6px" } }, t("auth.login"));
    const form = h("div", { style: { marginTop: "14px" } },
      h("div", { class: "field" }, h("label", {}, t("auth.email")), email),
      h("div", { class: "field" }, h("label", {}, t("auth.password")), pw),
      submit,
      h("div", { class: "center small", style: { marginTop: "12px" } },
        h("a", { href: "#/forgot", style: { color: "var(--brand)" } }, t("auth.forgot")))
    );
    submit.addEventListener("click", async () => {
      submit.disabled = true;
      try { await S.login(email.value.trim(), pw.value); await S.me(); window.App.navigate("#/onboarding"); }
      catch (e) { UI.toast(e.message, "err"); submit.disabled = false; }
    });
    return authShell(t("auth.login"), t("app.tagline"), form,
      h("div", { class: "center small muted", style: { marginTop: "14px" } },
        t("auth.noAccount") + " ", h("a", { href: "#/register", style: { color: "var(--brand)", fontWeight: "700" } }, t("auth.register"))));
  }
  async function register() {
    const name = h("input", { class: "input", type: "text", placeholder: "Jane Doe" });
    const email = h("input", { class: "input", type: "email", placeholder: "you@email.com" });
    const pw = h("input", { class: "input", type: "password", placeholder: "min 4 chars" });
    const submit = h("button", { class: "btn primary block", style: { marginTop: "6px" } }, t("auth.register"));
    const form = h("div", { style: { marginTop: "14px" } },
      h("div", { class: "field" }, h("label", {}, t("auth.name")), name),
      h("div", { class: "field" }, h("label", {}, t("auth.email")), email),
      h("div", { class: "field" }, h("label", {}, t("auth.password")), pw),
      submit
    );
    submit.addEventListener("click", async () => {
      submit.disabled = true;
      try { await S.register(name.value.trim(), email.value.trim(), pw.value); await S.me(); window.App.navigate("#/onboarding"); }
      catch (e) { UI.toast(e.message, "err"); submit.disabled = false; }
    });
    return authShell(t("auth.register"), t("app.tagline"), form,
      h("div", { class: "center small muted", style: { marginTop: "14px" } },
        t("auth.haveAccount") + " ", h("a", { href: "#/login", style: { color: "var(--brand)", fontWeight: "700" } }, t("auth.login"))));
  }
  async function forgot() {
    return authShell(t("auth.forgot"), t("app.tagline"),
      h("div", { style: { marginTop: "14px" } },
        h("p", { class: "muted small" }, "This demo stores accounts locally. Use your password to log in; reset is not needed in demo mode."),
        h("a", { href: "#/login", class: "btn block", style: { marginTop: "10px", display: "block", textAlign: "center" } }, t("common.back"))
      ));
  }

  // ================= ONBOARDING =================
  async function onboarding() {
    const createCard = h("div", { class: "card", style: { cursor: "pointer", textAlign: "center", padding: "22px" } },
      h("div", { style: { fontSize: "34px" } }, "🏠"), h("div", { style: { fontWeight: "800", marginTop: "8px" } }, t("onboard.create")),
      h("div", { class: "small muted", style: { marginTop: "4px" } }, t("auth.createFamily")));
    const joinCard = h("div", { class: "card", style: { cursor: "pointer", textAlign: "center", padding: "22px" } },
      h("div", { style: { fontSize: "34px" } }, "🤝"), h("div", { style: { fontWeight: "800", marginTop: "8px" } }, t("onboard.join")),
      h("div", { class: "small muted", style: { marginTop: "4px" } }, t("auth.joinFamily")));
    createCard.addEventListener("click", () => {
      openForm(t("auth.createFamily"), [
        field("name", { label: t("auth.familyName"), value: "" }),
        { key: "currency", type: "select", label: t("settings.currency"), options: ["EGP","USD","EUR","SAR","AED","GBP"].map((c) => ({ value: c, label: c })), value: "EGP" },
      ], async (v) => { await S.createFamily(v.name, v.currency); await S.refreshFamily(); UI.toast("🎉", "ok"); window.App.navigate("#/dashboard"); }, t("common.add"));
    });
    joinCard.addEventListener("click", () => {
      openForm(t("auth.joinFamily"), [field("code", { label: t("auth.inviteCode"), value: "" })], async (v) => {
        await S.joinFamily(v.code.trim().toUpperCase()); await S.refreshFamily(); UI.toast("🤝", "ok"); window.App.navigate("#/dashboard");
      }, t("auth.joinFamily"));
    });
    return h("div", { class: "page-enter", style: { minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px", maxWidth: "480px", margin: "0 auto" } },
      h("div", { class: "center", style: { marginBottom: "22px" } },
        h("div", { style: { fontSize: "46px" } }, "🏠"),
        h("h1", { style: { margin: "10px 0 4px", fontSize: "26px" } }, t("onboard.welcome")),
        h("p", { class: "muted", style: { margin: 0 } }, t("onboard.subtitle"))
      ),
      h("div", { class: "grid cols-2" }, createCard, joinCard),
      h("div", { class: "card", style: { marginTop: "16px" } },
        h("p", { style: { margin: "0 0 6px", fontWeight: "700" } }, t("onboard.manage")),
        h("p", { class: "muted", style: { margin: 0 } }, t("onboard.track"))
      )
    );
  }

  // ================= DASHBOARD =================
  async function dashboard() {
    const [txRes, budRes, goalsRes, billsRes, insRes] = await Promise.all([
      S.listTransactions({}), S.getBudget(), S.listGoals(), S.listBills(), S.getInsights(),
    ]);
    const txs = txRes.transactions;
    const now = new Date();
    const thisMonth = txs.filter((x) => { const d = new Date(x.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const income = thisMonth.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
    const expense = thisMonth.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
    const allIncome = txs.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
    const allExpense = txs.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
    const balance = allIncome - allExpense;
    const saved = goalsRes.goals.reduce((s, g) => s + g.saved, 0);
    const bud = budRes.budget;
    const upcoming = billsRes.bills.filter((b) => b.status !== "paid").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 3);

    const hour = now.getHours();
    const greet = hour >= 17 ? t("dash.greeting.evening") : t("dash.greeting");

    const cards = h("div", { class: "grid cols-2" },
      statCard("wallet", t("dash.balance"), UI.fmt(balance, cur()), null, "#3478f6"),
      statCard("chart", t("dash.income"), UI.fmt(income, cur()), t("filter.month"), "#22c55e"),
      statCard("tag", t("dash.expense"), UI.fmt(expense, cur()), t("filter.month"), "#ef4444"),
      statCard(bud && bud.overBudget ? "warning" : "target", t("dash.remaining"), UI.fmt((bud && bud.remaining) || 0, cur()), bud && bud.amount ? Math.round(bud.percent) + "% " + t("bud.used") : null, (bud && bud.overBudget) ? "#ef4444" : "#f59e0b")
    );

    // monthly spending chart (last 6 months expenses)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sum = txs.filter((x) => x.type === "expense" && new Date(x.date).getMonth() === d.getMonth() && new Date(x.date).getFullYear() === d.getFullYear()).reduce((s, x) => s + x.amount, 0);
      months.push({ label: d.toLocaleString(I.getLocale() === "ar" ? "ar" : "en", { month: "short" }), value: sum, color: "#3478f6" });
    }

    const recent = txs.slice(0, 6);
    const recentList = recent.length ? h("div", {}, ...recent.map(txRow)) : UI.emptyState("🧾", t("dash.empty"), t("dash.emptyHint"), h("button", { class: "btn primary", style: { marginTop: "12px" }, onclick: () => window.App.openQuickAdd("expense") }, t("dash.addExpense")));

    const insights = insRes.insights.length ? h("div", { class: "grid cols-2" }, ...insRes.insights.map((x) =>
      h("div", { class: "card", style: { padding: "12px" } },
        h("div", { class: "flex", style: { gap: "8px" } }, h("div", { style: { color: x.tone === "bad" ? "var(--danger)" : x.tone === "warn" ? "var(--warning)" : x.tone === "good" ? "var(--success)" : "var(--brand)" } }, UI.icon(x.icon || "info", 18)), h("div", { class: "small", style: { fontWeight: "600" } }, x.text))
      )
    )) : UI.emptyState("💡", t("insights.none"));

    const billsNode = upcoming.length ? h("div", {}, ...upcoming.map((b) =>
      h("div", { class: "row" },
        h("div", { class: "avatar", style: { background: "var(--brand-weak)", color: "var(--brand)" }, html: UI.icon("bolt", 18) }),
        h("div", { class: "grow" }, h("div", { class: "name" }, b.name), h("div", { class: "meta" }, t("bills.due") + " " + UI.date(b.dueDate))),
        h("div", { class: "amount expense" }, UI.fmt(b.amount, cur()))
      )
    )) : h("div", { class: "muted small", style: { padding: "10px" } }, t("dash.billsNone"));

    return h("div", { class: "page-enter" },
      h("div", { style: { marginBottom: "12px" } }, h("div", { class: "small muted" }, greet + ","), h("div", { style: { fontSize: "22px", fontWeight: "800" } }, (S.state.user ? S.state.user.name : "") + " 👋")),
      cards,
      h("div", { class: "card", style: { marginTop: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 10px" } }, UI.icon("chart", 18), " " + t("dash.monthlySpending")),
        C.vBars(months)
      ),
      h("div", { class: "section-title" }, UI.icon("bell", 18), " " + t("dash.bills")), billsNode,
      h("div", { class: "section-title" }, UI.icon("list", 18), " " + t("dash.recent")), h("div", { class: "card pad-0" }, recentList),
      h("div", { class: "section-title" }, UI.icon("sparkles", 18), " " + t("insights.title")), insights
    );
  }

  // ================= TRANSACTIONS =================
  async function transactions() {
    const fam = S.state.family;
    const state = { period: "", type: "", search: "", category: "" };
    const listWrap = h("div", { class: "card pad-0" }, UI.spinner());
    const catChips = h("div", { class: "flex wrap", style: { gap: "6px", marginBottom: "12px" } });
    const cats = ["", ...(fam ? fam.categories.map((c) => c.name) : [])];
    function renderChips() {
      UI.clear(catChips);
      cats.forEach((c) => {
        catChips.appendChild(h("button", { class: "chip" + (state.category === c ? " active" : ""), onclick: () => { state.category = c; renderChips(); load(); } }, c === "" ? t("common.all") : c));
      });
    }
    const periods = [["", t("filter.all")], ["today", t("filter.today")], ["week", t("filter.week")], ["month", t("filter.month")]];
    const periodBar = h("div", { class: "flex wrap", style: { gap: "6px", marginBottom: "12px" } });
    periods.forEach(([v, l]) => periodBar.appendChild(h("button", { class: "chip" + (state.period === v ? " active" : ""), onclick: () => { state.period = v; periodBar.querySelectorAll("button").forEach((x,i)=>x.classList.toggle("active", periods[i][0]===v)); load(); } }, l)));
    const typeBar = h("div", { class: "flex wrap", style: { gap: "6px", marginBottom: "12px" } }, [
      h("button", { class: "chip" + (state.type === "" ? " active" : ""), onclick: () => { state.type = ""; syncType(); load(); } }, t("common.all")),
      h("button", { class: "chip" + (state.type === "income" ? " active" : ""), onclick: () => { state.type = "income"; syncType(); load(); } }, t("filter.income")),
      h("button", { class: "chip" + (state.type === "expense" ? " active" : ""), onclick: () => { state.type = "expense"; syncType(); load(); } }, t("filter.expense")),
    ]);
    function syncType() { const b = typeBar.querySelectorAll("button"); b[0].classList.toggle("active", state.type===""); b[1].classList.toggle("active", state.type==="income"); b[2].classList.toggle("active", state.type==="expense"); }
    const search = h("input", { class: "input", placeholder: t("search.placeholder"), oninput: debounce(() => { state.search = search.value; load(); }, 300) });
    async function load() {
      UI.clear(listWrap); listWrap.appendChild(UI.spinner());
      const res = await S.listTransactions({ period: state.period, type: state.type, category: state.category, search: state.search });
      UI.clear(listWrap);
      if (!res.transactions.length) { listWrap.appendChild(UI.emptyState("🧾", t("dash.empty"), t("dash.emptyHint"), h("button", { class: "btn primary", style: { marginTop: "12px" }, onclick: () => window.App.openQuickAdd("expense") }, t("dash.addExpense")))); return; }
      res.transactions.forEach((tx) => listWrap.appendChild(txRow(tx)));
    }
    renderChips();
    load();
    return h("div", { class: "page-enter" },
      h("div", { class: "field", style: { position: "relative", marginBottom: "10px" } }, h("div", { class: "relative" }, search, h("span", { class: "icon-btn", style: { position: "absolute", [I.getLocale()==="ar"?"left":"right"]:"6px", top: "1px", pointerEvents: "none", color: "var(--text-2)" }, html: UI.icon("search", 18) }))),
      typeBar, periodBar, catChips,
      listWrap
    );
  }

  // ================= BUDGETS =================
  async function budgets() {
    const budRes = await S.getBudget();
    const bud = budRes.budget;
    const fam = S.state.family;
    const incomeEl = h("input", { class: "input", type: "number", value: bud.income || 0 });
    const amountEl = h("input", { class: "input", type: "number", value: bud.amount || 0 });
    const save = h("button", { class: "btn primary block", style: { marginTop: "8px" } }, t("bud.set"));
    save.addEventListener("click", async () => {
      save.disabled = true;
      try { await S.setBudget({ income: Number(incomeEl.value) || 0, amount: Number(amountEl.value) || 0 }); UI.toast("✓", "ok"); window.App.refresh(); }
      catch (e) { UI.toast(e.message, "err"); save.disabled = false; }
    });
    const pct = bud.percent || 0;
    const cls = bud.overBudget ? "bad" : pct >= 80 ? "warn" : "good";
    const prog = h("div", { class: "progress " + cls }, h("span", { style: { width: Math.min(100, pct) + "%" } }));
    return h("div", { class: "page-enter" },
      h("div", { class: "card" },
        h("div", { class: "section-title", style: { margin: "0 0 12px" } }, UI.icon("wallet", 18), " " + t("bud.title")),
        h("div", { class: "grid cols-3", style: { marginBottom: "14px" } },
          statCard("wallet", t("bud.income"), UI.fmt(bud.income || 0, cur())),
          statCard("target", t("bud.budget"), UI.fmt(bud.amount || 0, cur())),
          statCard("tag", t("bud.spent"), UI.fmt(bud.spent || 0, cur()))
        ),
        prog,
        h("div", { class: "flex between", style: { marginTop: "8px" } },
          h("span", { class: "small muted" }, pct + "% " + t("bud.used")),
          h("span", { class: "small " + (bud.overBudget ? "amount expense" : "muted") }, bud.overBudget ? t("bud.over") : t("bud.safe") + " · " + UI.fmt(bud.remaining, cur()))
        ),
        bud.overBudget ? h("div", { class: "badge red", style: { marginTop: "10px" } }, UI.icon("warning", 14) + " " + t("bud.over")) : null
      ),
      S.can("manage_budgets") ? h("div", { class: "card", style: { marginTop: "14px" } },
        h("div", { class: "field" }, h("label", {}, t("bud.income")), incomeEl),
        h("div", { class: "field" }, h("label", {}, t("bud.budget")), amountEl),
        save
      ) : null
    );
  }

  // ================= BILLS =================
  async function bills() {
    const res = await S.listBills();
    const list = h("div", { class: "card pad-0" });
    function render() {
      UI.clear(list);
      if (!res.bills.length) { list.appendChild(UI.emptyState("🧾", t("bills.title"), t("bills.add"), h("button", { class: "btn primary", style: { marginTop: "12px" }, onclick: addBill }, t("bills.add")))); return; }
      res.bills.forEach((b) => {
        const due = new Date(b.dueDate);
        const overdue = b.status !== "paid" && due < new Date();
        const statusBadge = b.status === "paid" ? h("span", { class: "badge green" }, t("bills.paid"))
          : overdue ? h("span", { class: "badge red" }, t("bills.overdue"))
          : h("span", { class: "badge amber" }, t("bills.pending"));
        list.appendChild(h("div", { class: "row" },
          h("div", { class: "avatar", style: { background: "var(--brand-weak)", color: "var(--brand)" }, html: UI.icon("bolt", 18) }),
          h("div", { class: "grow" }, h("div", { class: "name" }, b.name + (b.recurring ? " · 🔁" : "")), h("div", { class: "meta" }, t("bills.due") + " " + UI.date(b.dueDate))),
          statusBadge,
          h("div", { class: "amount expense" }, UI.fmt(b.amount, cur())),
          b.status !== "paid" ? h("button", { class: "btn success sm", onclick: async () => { try { await S.updateBill(b.id, { pay: true }); UI.toast("✓", "ok"); window.App.refresh(); } catch (e) { UI.toast(e.message, "err"); } } }, t("bills.payNow")) : null,
          h("button", { class: "icon-btn", onclick: async () => { if (await UI.confirm(t("common.confirm"))) { try { await S.deleteBill(b.id); UI.toast("✓"); window.App.refresh(); } catch (e) { UI.toast(e.message, "err"); } } }}, UI.icon("trash", 18))
        ));
      });
    }
    function addBill() {
      const fam = S.state.family;
      openForm(t("bills.add"), [
        field("name", { label: t("bills.title") }),
        field("amount", { label: t("exp.amount"), type: "number" }),
        field("dueDate", { label: t("bills.due"), type: "date", value: UI.toInputDate(new Date(Date.now() + 7*864e5)) }),
        { key: "recurring", type: "segment", label: t("bills.recurring"), options: [{value:"0",label:t("common.no")},{value:"1",label:t("common.yes")}], value: "0" },
      ], async (v) => { await S.addBill({ name: v.name, amount: Number(v.amount), dueDate: v.dueDate, recurring: v.recurring === "1" }); UI.toast("✓", "ok"); window.App.refresh(); }, t("common.add"));
    }
    render();
    return h("div", { class: "page-enter" },
      h("div", { class: "flex between", style: { marginBottom: "12px" } }, h("div", {},), S.can("manage_bills") ? h("button", { class: "btn primary", onclick: addBill }, UI.icon("plus", 18) + " " + t("bills.add")) : null),
      list
    );
  }

  // ================= DEBTS =================
  async function debts() {
    const res = await S.listDebts();
    const wrap = h("div", {});
    function addDebt() {
      openForm(t("debts.add"), [
        field("person", { label: t("debts.person") }),
        field("amount", { label: t("debts.amount"), type: "number" }),
        field("reason", { label: t("debts.reason"), type: "textarea", optional: true }),
        field("dueDate", { label: t("debts.due"), type: "date", value: UI.toInputDate(new Date(Date.now()+14*864e5)), optional: true }),
      ], async (v) => { await S.addDebt({ person: v.person, amount: Number(v.amount), reason: v.reason, dueDate: v.dueDate || undefined }); UI.toast("✓","ok"); window.App.refresh(); }, t("common.add"));
    }
    function payDebt(d) {
      openForm(t("debts.addPayment"), [field("amount", { label: t("debts.amount"), type: "number" }), field("note", { label: t("exp.notes"), optional: true })],
        async (v) => { await S.addDebtPayment(d.id, { amount: Number(v.amount), note: v.note }); UI.toast("✓","ok"); window.App.refresh(); }, t("debts.addPayment"));
    }
    function render() {
      UI.clear(wrap);
      if (!res.debts.length) { wrap.appendChild(UI.emptyState("🤝", t("debts.title"), t("debts.add"), S.can("manage_debts") ? h("button", { class: "btn primary", style: { marginTop: "12px" }, onclick: addDebt }, t("debts.add")) : null)); return; }
      res.debts.forEach((d) => {
        const remaining = Math.max(0, d.amount - d.paid);
        const pct = d.amount > 0 ? Math.round((d.paid / d.amount) * 100) : 0;
        wrap.appendChild(h("div", { class: "card", style: { marginBottom: "12px" } },
          h("div", { class: "flex between" },
            h("div", { class: "flex", style: { gap: "10px" } }, h("div", { class: "avatar", style: { background: "rgba(239,68,68,0.14)", color: "var(--danger)" }, html: UI.icon("money", 18) }), h("div", {}, h("div", { class: "name" }, d.person), h("div", { class: "meta" }, d.reason || (d.settled ? t("debts.settled") : "")))),
            h("div", { class: "amount debt" }, UI.fmt(d.amount, cur()))
          ),
          h("div", { class: "progress", style: { marginTop: "10px" } }, h("span", { style: { width: pct + "%", background: "linear-gradient(90deg,#ef4444,#f87171)" } })),
          h("div", { class: "flex between small muted", style: { marginTop: "6px" } }, h("span", t("debts.paid") + ": " + UI.fmt(d.paid, cur())), h("span", t("debts.remaining") + ": " + UI.fmt(remaining, cur()))),
          h("div", { class: "flex", style: { gap: "8px", marginTop: "10px" } },
            S.can("manage_debts") ? h("button", { class: "btn sm", onclick: payDebt }, UI.icon("plus", 16) + " " + t("debts.addPayment")) : null,
            h("button", { class: "btn sm ghost", onclick: async () => { if (await UI.confirm(t("common.confirm"))) { try { await S.deleteDebt(d.id); UI.toast("✓"); window.App.refresh(); } catch (e) { UI.toast(e.message,"err"); } } }}, UI.icon("trash", 16))
          )
        ));
      });
    }
    render();
    return h("div", { class: "page-enter" },
      h("div", { class: "flex between", style: { marginBottom: "12px" } }, S.can("manage_debts") ? h("button", { class: "btn primary", onclick: addDebt }, UI.icon("plus", 18) + " " + t("debts.add")) : null),
      wrap
    );
  }

  // ================= GOALS =================
  async function goals() {
    const res = await S.listGoals();
    const wrap = h("div", {});
    function addGoal() {
      openForm(t("goals.add"), [field("name", { label: t("exp.name") }), field("target", { label: t("goals.target"), type: "number" })],
        async (v) => { await S.addGoal({ name: v.name, target: Number(v.target) }); UI.toast("✓","ok"); window.App.refresh(); }, t("common.add"));
    }
    function deposit(g) {
      openForm(t("goals.addFunds"), [field("amount", { label: t("exp.amount"), type: "number" })],
        async (v) => { await S.depositGoal(g.id, { amount: Number(v.amount) }); UI.toast("✓","ok"); window.App.refresh(); }, t("goals.addFunds"));
    }
    function render() {
      UI.clear(wrap);
      if (!res.goals.length) { wrap.appendChild(UI.emptyState("🎯", t("goals.title"), t("goals.add"), S.can("manage_goals") ? h("button", { class: "btn primary", style: { marginTop: "12px" }, onclick: addGoal }, t("goals.add")) : null)); return; }
      res.goals.forEach((g) => {
        const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
        wrap.appendChild(h("div", { class: "card", style: { marginBottom: "12px" } },
          h("div", { class: "flex between" },
            h("div", { class: "flex", style: { gap: "10px" } }, h("div", { class: "avatar", style: { background: g.color + "22", color: g.color }, html: UI.icon("target", 18) }), h("div", {}, h("div", { class: "name" }, g.name), h("div", { class: "meta" }, UI.fmt(g.saved, cur()) + " / " + UI.fmt(g.target, cur())))),
            g.achieved ? h("span", { class: "badge green" }, t("goals.achieved")) : h("span", { class: "badge blue" }, pct + "%")
          ),
          h("div", { class: "progress good", style: { marginTop: "10px" } }, h("span", { style: { width: Math.min(100, pct) + "%", background: g.color } })),
          h("div", { class: "flex between small muted", style: { marginTop: "6px" } }, h("span", t("goals.remaining") + ": " + UI.fmt(Math.max(0, g.target - g.saved), cur())), h("span", t("goals.progress") + " " + pct + "%")),
          h("div", { class: "flex", style: { gap: "8px", marginTop: "10px" } },
            S.can("manage_goals") ? h("button", { class: "btn sm primary", onclick: deposit }, UI.icon("plus", 16) + " " + t("goals.addFunds")) : null,
            h("button", { class: "btn sm ghost", onclick: async () => { if (await UI.confirm(t("common.confirm"))) { try { await S.deleteGoal(g.id); UI.toast("✓"); window.App.refresh(); } catch (e) { UI.toast(e.message,"err"); } } }}, UI.icon("trash", 16))
          )
        ));
      });
    }
    render();
    return h("div", { class: "page-enter" },
      h("div", { class: "flex between", style: { marginBottom: "12px" } }, S.can("manage_goals") ? h("button", { class: "btn primary", onclick: addGoal }, UI.icon("plus", 18) + " " + t("goals.add")) : null),
      wrap
    );
  }

  // ================= ANALYTICS =================
  async function analytics() {
    const res = await S.listTransactions({});
    const txs = res.transactions;
    const now = new Date();
    const expenses = txs.filter((x) => x.type === "expense");
    // by category
    const byCat = {};
    expenses.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
    const fam = S.state.family;
    const colorOf = (name) => { const c = fam && fam.categories.find((c) => c.name === name); return c ? c.color : "#3478f6"; };
    const catItems = Object.keys(byCat).map((k) => ({ label: k, value: byCat[k], color: colorOf(k) })).sort((a, b) => b.value - a.value);
    const top = catItems[0];
    // by month (last 6)
    const byMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sum = expenses.filter((x) => { const xd = new Date(x.date); return xd.getMonth() === d.getMonth() && xd.getFullYear() === d.getFullYear(); }).reduce((s, x) => s + x.amount, 0);
      byMonth.push({ label: d.toLocaleString(I.getLocale()==="ar"?"ar":"en", { month: "short" }), value: sum, color: "#3478f6" });
    }
    // this vs last month
    const thisSum = byMonth[5].value;
    const lastSum = byMonth[4].value;
    const diffPct = lastSum > 0 ? Math.round(((thisSum - lastSum) / lastSum) * 100) : 0;
    // year totals
    const y = now.getFullYear();
    const yearTx = txs.filter((x) => new Date(x.date).getFullYear() === y);
    const yearIncome = yearTx.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
    const yearExpense = yearTx.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
    const saved = (await S.listGoals()).goals.reduce((s, g) => s + g.saved, 0);
    // top spender
    const byMember = {};
    expenses.forEach((x) => { const n = x.memberName || "?"; byMember[n] = (byMember[n] || 0) + x.amount; });
    const spender = Object.keys(byMember).map((k) => ({ label: k, value: byMember[k] })).sort((a, b) => b.value - a.value)[0];

    return h("div", { class: "page-enter" },
      h("div", { class: "grid cols-2", style: { marginBottom: "14px" } },
        statCard("wallet", t("analytics.yearIncome"), UI.fmt(yearIncome, cur()), t("filter.month"), "#22c55e"),
        statCard("tag", t("analytics.yearExpense"), UI.fmt(yearExpense, cur()), null, "#ef4444"),
        statCard("target", t("analytics.yearSaved"), UI.fmt(saved, cur()), null, "#22c55e"),
        statCard("chart", t("analytics.compare"), (diffPct >= 0 ? "▲ " : "▼ ") + Math.abs(diffPct) + "%", t("filter.month"), diffPct > 0 ? "#ef4444" : "#22c55e")
      ),
      h("div", { class: "card", style: { marginBottom: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 12px" } }, UI.icon("chart", 18), " " + t("analytics.byCategory")),
        catItems.length ? h("div", { class: "flex", style: { gap: "18px", alignItems: "center", flexWrap: "wrap" } }, C.donut(catItems, { center: UI.fmtNum(Math.round(catItems.reduce((s,x)=>s+x.value,0))), sub: cur() }), h("div", { style: { flex: "1", minWidth: "200px" } }, C.hBars(catItems.slice(0, 6)))) : UI.emptyState("📊", t("analytics.none"))
      ),
      h("div", { class: "card", style: { marginBottom: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 12px" } }, UI.icon("calendar", 18), " " + t("analytics.byMonth")),
        catItems.length ? C.vBars(byMonth, { height: 160 }) : UI.emptyState("📊", t("analytics.none"))
      ),
      h("div", { class: "grid cols-2" },
        h("div", { class: "card" }, h("div", { class: "small muted" }, t("analytics.top")), h("div", { style: { fontWeight: "800", fontSize: "18px", marginTop: "4px" } }, top ? top.label + " · " + UI.fmt(top.value, cur()) : "—")),
        h("div", { class: "card" }, h("div", { class: "small muted" }, t("analytics.topSpender")), h("div", { style: { fontWeight: "800", fontSize: "18px", marginTop: "4px" } }, spender ? spender.label + " · " + UI.fmt(spender.value, cur()) : "—"))
      )
    );
  }

  // ================= ACTIVITY =================
  async function activity() {
    const res = await S.listActivity();
    const wrap = h("div", { class: "card pad-0" });
    if (!res.activities.length) { wrap.appendChild(UI.emptyState("📜", t("activity.title"), "")); }
    else {
      res.activities.forEach((a) => {
        wrap.appendChild(h("div", { class: "row" },
          h("div", { class: "avatar", html: UI.avatar(a.userName, null, "") }),
          h("div", { class: "grow" }, h("div", { class: "name" }, a.userName), h("div", { class: "meta" }, a.detail)),
          h("div", { class: "small muted" }, UI.dateTime(a.createdAt))
        ));
      });
    }
    return h("div", { class: "page-enter" }, wrap);
  }

  // ================= NOTIFICATIONS =================
  async function notifications() {
    const res = await S.listNotifications();
    const wrap = h("div", { class: "card pad-0" });
    function render() {
      UI.clear(wrap);
      if (!res.notifications.length) { wrap.appendChild(UI.emptyState("🔔", t("notif.empty"), "")); return; }
      res.notifications.forEach((n) => {
        wrap.appendChild(h("div", { class: "row", style: { background: n.read ? "transparent" : "var(--brand-weak)" } },
          h("div", { class: "avatar", style: { background: "var(--brand-weak)", color: "var(--brand)" }, html: UI.icon(iconFor(n.type), 18) }),
          h("div", { class: "grow" }, h("div", { class: "name" }, n.title), h("div", { class: "meta" }, n.body)),
          h("div", { class: "flex", style: { flexDirection: "column", alignItems: "flex-end", gap: "4px" } },
            h("span", { class: "small muted" }, UI.dateTime(n.createdAt)),
            !n.read ? h("button", { class: "btn sm ghost", onclick: async () => { try { await S.markNotification(n.id); n.read = true; render(); } catch(e){} } }, UI.icon("check", 14)) : null
          )
        ));
      });
    }
    function iconFor(ty) {
      return { bill_due:"bolt", budget_warning:"warning", budget_exceeded:"warning", new_expense:"tag", new_income:"wallet", member_joined:"user", debt_due:"money", goal_achieved:"target", invite:"gift" }[ty] || "bell";
    }
    render();
    return h("div", { class: "page-enter" },
      res.notifications.length ? h("div", { class: "flex between", style: { marginBottom: "10px" } }, h("div", {}), h("button", { class: "btn sm ghost", onclick: async () => { await S.markAll(); window.App.refresh(); } }, t("notif.markAll"))) : null,
      wrap
    );
  }

  // ================= PROFILE =================
  async function profile() {
    const me = S.state.context.member;
    const fam = S.state.family;
    const res = await S.listTransactions({});
    const myTx = res.transactions.filter((x) => x.userId === S.state.user.id);
    const myExp = myTx.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
    const myInc = myTx.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
    const allowance = me.allowance || 0;
    const spent = myTx.filter((x) => x.type === "expense" && x.memberId === me.id).reduce((s, x) => s + x.amount, 0);
    const roleLabel = I.getLocale() === "ar" ? ({owner:"المالك",parent:"والد",member:"عضو",child:"طفل"}[me.role]||me.role) : me.role;
    return h("div", { class: "page-enter" },
      h("div", { class: "card", style: { textAlign: "center" } },
        h("div", { class: "avatar-lg", style: { margin: "0 auto 10px" }, html: UI.avatar(S.state.user.name, S.state.user.image, "") }),
        h("div", { style: { fontWeight: "800", fontSize: "20px" } }, S.state.user.name),
        h("div", { class: "muted small" }, S.state.user.email),
        h("div", { class: "flex", style: { gap: "8px", justifyContent: "center", marginTop: "8px" } }, h("span", { class: "badge blue" }, roleLabel), h("span", { class: "badge gray" }, fam.name))
      ),
      h("div", { class: "grid cols-2", style: { marginTop: "14px" } },
        statCard("wallet", t("profile.allowance"), UI.fmt(allowance, cur())),
        statCard("tag", t("profile.spent"), UI.fmt(spent, cur())),
        statCard("chart", t("profile.myExpense"), UI.fmt(myExp, cur())),
        statCard("target", t("profile.myIncome"), UI.fmt(myInc, cur()))
      ),
      h("div", { class: "card", style: { marginTop: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 10px" } }, UI.icon("list", 18), " " + t("profile.myActivity")),
        myTx.length ? h("div", {}, ...myTx.slice(0, 10).map(txRow)) : UI.emptyState("📜", t("activity.title"), "")
      ),
      h("button", { class: "btn danger block", style: { marginTop: "16px" }, onclick: async () => { if (await UI.confirm(t("common.confirm"))) { await S.logout(); window.App.navigate("#/login"); } } }, UI.icon("logout", 18) + " " + t("auth.logout"))
    );
  }

  // ================= SETTINGS =================
  async function settings() {
    const fam = S.state.family;
    const me = S.state.context.member;
    const wrap = h("div", {});
    const root = h("div", { class: "page-enter" });

    function render() {
      UI.clear(root);
      // family info
      root.appendChild(h("div", { class: "card", style: { marginBottom: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 12px" } }, UI.icon("settings", 18), " " + t("settings.title")),
        h("div", { class: "field" }, h("label", {}, t("settings.familyName")), (() => { const e = h("input", { class: "input", value: fam.name }); e.dataset.k = "name"; return e; })()),
        h("div", { class: "field" }, h("label", {}, t("settings.familyPic")), (() => { const e = h("input", { class: "input", value: fam.image || "", placeholder: "https://..." }); e.dataset.k = "image"; return e; })()),
        h("div", { class: "field" }, h("label", {}, t("settings.currency")), (() => {
          const sel = h("select", { class: "input" }, ...["EGP","USD","EUR","SAR","AED","GBP"].map((c) => h("option", { value: c, selected: c === fam.currency ? "selected" : false }, c)));
          sel.dataset.k = "currency"; return sel;
        })()),
        S.can("manage_family") ? h("button", { class: "btn primary block", onclick: async (ev) => {
          ev.target.disabled = true;
          const name = root.querySelector('[data-k="name"]').value;
          const image = root.querySelector('[data-k="image"]').value;
          const currency = root.querySelector('[data-k="currency"]').value;
          try { await S.updateFamily({ name, image, currency }); UI.toast("✓","ok"); window.App.refresh(); } catch (e) { UI.toast(e.message,"err"); ev.target.disabled = false; }
        } }, t("common.save")) : null
      ));

      // invite
      root.appendChild(h("div", { class: "card", style: { marginBottom: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 12px" } }, UI.icon("gift", 18), " " + t("settings.invite")),
        h("div", { class: "flex", style: { gap: "10px", alignItems: "center" } },
          h("div", { class: "badge blue", style: { fontSize: "20px", padding: "10px 16px", letterSpacing: "2px" } }, fam.inviteCode),
          h("button", { class: "btn sm", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(fam.inviteCode); UI.toast("✓","ok"); } }, t("settings.copy"))
        ),
        h("p", { class: "small muted", style: { marginTop: "8px" } }, t("settings.inviteCode") + ": " + location.href.split("#")[0] + "#/onboarding")
      ));

      // members
      const membersCard = h("div", { class: "card", style: { marginBottom: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 12px", display: "flex", justifyContent: "space-between" } },
          h("span", {}, UI.icon("family", 18) + " " + t("settings.members")),
          S.can("manage_members") ? h("button", { class: "btn sm primary", onclick: addMember }, UI.icon("plus", 16) + " " + t("settings.addMember")) : null
        )
      );
      fam.members.forEach((m) => {
        membersCard.appendChild(h("div", { class: "row" },
          h("div", { class: "avatar", html: UI.avatar(m.name, m.image, "") }),
          h("div", { class: "grow" }, h("div", { class: "name" }, m.name + (m.id === me.id ? " (" + t("settings.you") + ")" : "") + (m.role === "owner" ? " 👑" : "")), h("div", { class: "meta" }, t("settings.allowance") + ": " + UI.fmt(m.allowance || 0, cur()))),
          S.can("manage_members") && m.role !== "owner" ? h("select", { class: "input", style: { width: "auto" }, onchange: async (e) => { try { await S.updateMember(m.id, { role: e.target.value }); UI.toast("✓","ok"); window.App.refresh(); } catch(err){ UI.toast(err.message,"err"); } } }, ...["owner","parent","member","child"].map((r) => h("option", { value: r, selected: r === m.role ? "selected" : false }, r))) : h("span", { class: "badge gray" }, m.role)
        ));
      });
      root.appendChild(membersCard);

      // categories
      const catCard = h("div", { class: "card", style: { marginBottom: "14px" } },
        h("div", { class: "section-title", style: { margin: "0 0 12px", display: "flex", justifyContent: "space-between" } },
          h("span", {}, UI.icon("tag", 18) + " " + t("settings.categories")),
          S.can("manage_categories") ? h("button", { class: "btn sm primary", onclick: addCategory }, UI.icon("plus", 16) + " " + t("settings.addCategory")) : null
        )
      );
      const grid = h("div", { class: "flex wrap", style: { gap: "8px" } });
      fam.categories.forEach((c) => {
        grid.appendChild(h("div", { class: "flex", style: { gap: "6px", alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "999px", padding: "5px 10px" } },
          h("span", { style: { width: "10px", height: "10px", borderRadius: "3px", background: c.color, display: "inline-block" } }),
          h("span", { class: "small", style: { fontWeight: "600" } }, c.name),
          S.can("manage_categories") && !c.isDefault ? h("button", { class: "icon-btn", style: { width: "24px", height: "24px" }, onclick: async () => { if (await UI.confirm(t("common.confirm"))) { try { await S.deleteCategory(c.id); UI.toast("✓"); window.App.refresh(); } catch(e){ UI.toast(e.message,"err"); } } } }, UI.icon("close", 14)) : null
        ));
      });
      catCard.appendChild(grid);
      root.appendChild(catCard);

      // danger
      root.appendChild(h("div", { class: "card", style: { marginBottom: "14px" } },
        me.role !== "owner" ? h("button", { class: "btn block", style: { borderColor: "var(--warning)", color: "var(--warning)" }, onclick: async () => { if (await UI.confirm(t("common.confirm"))) { await S.leaveFamily(); await S.me(); window.App.navigate("#/onboarding"); } } }, t("settings.leave")) : null,
        h("button", { class: "btn danger block", style: { marginTop: "10px" }, onclick: async () => { if (await UI.confirm(t("common.confirm"))) { await S.logout(); window.App.navigate("#/login"); } } }, t("settings.deleteAccount"))
      ));
    }
    function addMember() {
      openForm(t("settings.addMember"), [
        field("name", { label: t("settings.memberName") }),
        { key: "role", type: "select", label: t("settings.memberRole"), options: ["owner","parent","member","child"].map((r)=>({value:r,label:r})), value: "member" },
        field("allowance", { label: t("settings.allowance"), type: "number", value: 0 }),
        field("email", { label: t("auth.email"), optional: true }),
      ], async (v) => { await S.addMember({ name: v.name, role: v.role, allowance: Number(v.allowance)||0, email: v.email || undefined }); UI.toast("✓","ok"); window.App.refresh(); }, t("common.add"));
    }
    function addCategory() {
      openForm(t("settings.addCategory"), [
        field("name", { label: t("settings.catName") }),
        { key: "type", type: "select", label: t("settings.catType"), options: [{value:"expense",label:t("cat.expense")},{value:"income",label:t("cat.income")},{value:"both",label:t("cat.both")}], value: "expense" },
      ], async (v) => { await S.addCategory({ name: v.name, type: v.type }); UI.toast("✓","ok"); window.App.refresh(); }, t("common.add"));
    }
    render();
    return root;
  }

  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); }; }

  return { login, register, forgot, onboarding, dashboard, transactions, budgets, bills, debts, goals, analytics, activity, notifications, profile, settings, _txModal: openTransactionModal };
})();
