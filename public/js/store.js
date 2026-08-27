window.Store = (function () {
  const LS_KEY = "oh_db_v1";
  const SESSION_KEY = "oh_session";

  const DEFAULT_EXPENSE_CATEGORIES = [
    { name: "Food", color: "#f97316", icon: "utensils" },
    { name: "Groceries", color: "#22c55e", icon: "cart" },
    { name: "Electricity", color: "#eab308", icon: "bolt" },
    { name: "Water", color: "#06b6d4", icon: "drop" },
    { name: "Internet", color: "#8b5cf6", icon: "wifi" },
    { name: "Rent", color: "#ef4444", icon: "home" },
    { name: "Transportation", color: "#3b82f6", icon: "car" },
    { name: "Education", color: "#14b8a6", icon: "book" },
    { name: "Healthcare", color: "#ec4899", icon: "heart" },
    { name: "Shopping", color: "#a855f7", icon: "bag" },
    { name: "Entertainment", color: "#f43f5e", icon: "game" },
    { name: "Other", color: "#64748b", icon: "tag" },
  ];
  const DEFAULT_INCOME_CATEGORIES = [
    { name: "Salary", color: "#22c55e", icon: "wallet" },
    { name: "Freelance", color: "#3b82f6", icon: "laptop" },
    { name: "Business", color: "#8b5cf6", icon: "briefcase" },
    { name: "Allowance", color: "#f97316", icon: "gift" },
    { name: "Gift", color: "#ec4899", icon: "present" },
    { name: "Other", color: "#64748b", icon: "tag" },
  ];
  const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];
  const ROLES = ["owner", "parent", "member", "child"];

  const state = {
    user: null,
    context: null,
    family: null,
    currency: "EGP",
    loaded: false,
    role: null,
  };

  // ---------- storage ----------
  function emptyDb() {
    return {
      users: [], families: [], members: [], categories: [], transactions: [],
      bills: [], debts: [], debtPayments: [], goals: [], goalDeposits: [],
      budgets: [], notifications: [], activities: [],
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return Object.assign(emptyDb(), JSON.parse(raw));
    } catch (e) {}
    return emptyDb();
  }
  let db = load();
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) { console.error("Failed to save", e); }
  }

  function uid() {
    return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 6);
  }
  function genCode(n) {
    n = n || 6;
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  const iso = (d) => new Date(d).toISOString();

  // ---------- session / context ----------
  function sessionUser() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return db.users.find((u) => u.id === id) || null;
  }
  function setSession(user) {
    if (user) localStorage.setItem(SESSION_KEY, user.id);
    else localStorage.removeItem(SESSION_KEY);
  }
  function memberForUser(userId) {
    if (!userId) return null;
    return db.members.find((m) => m.userId === userId) || db.members[0] || null;
  }
  function findFamily(id) {
    return db.families.find((f) => f.id === id) || null;
  }
  function familyDetail(fam) {
    return Object.assign({}, fam, {
      members: db.members.filter((m) => m.familyId === fam.id),
      categories: db.categories.filter((c) => c.familyId === fam.id),
    });
  }
  function buildContext(user, member) {
    if (!member) return { family: null, member: null, currency: "EGP" };
    const fam = findFamily(member.familyId);
    return {
      family: fam ? { id: fam.id, name: fam.name, currency: fam.currency, image: fam.image, inviteCode: fam.inviteCode, ownerId: fam.ownerId } : null,
      member: { id: member.id, name: member.name, role: member.role, allowance: member.allowance, image: member.image, userId: member.userId },
      currency: fam ? fam.currency : "EGP",
    };
  }
  function publicUser(u) {
    return { id: u.id, email: u.email, name: u.name, image: u.image };
  }
  function seedCategories(familyId) {
    const now = new Date().toISOString();
    DEFAULT_EXPENSE_CATEGORIES.forEach((c) => db.categories.push({ id: uid(), familyId, name: c.name, type: "expense", color: c.color, icon: c.icon, isDefault: true, createdAt: now }));
    DEFAULT_INCOME_CATEGORIES.forEach((c) => db.categories.push({ id: uid(), familyId, name: c.name, type: "income", color: c.color, icon: c.icon, isDefault: true, createdAt: now }));
  }
  function logActivity(familyId, userName, action, detail, userId) {
    db.activities.push({ id: uid(), familyId, userId: userId || null, userName, action, detail, createdAt: new Date().toISOString() });
    if (db.activities.length > 500) db.activities.splice(0, db.activities.length - 500);
  }
  function notify(familyId, type, title, body, userId, link) {
    db.notifications.push({ id: uid(), familyId, userId: userId || null, type, title, body, link: link || null, read: false, createdAt: new Date().toISOString() });
  }
  function txMonthYear(tx) {
    const d = new Date(tx.date);
    return { m: d.getMonth() + 1, y: d.getFullYear() };
  }
  function currentBudget(familyId) {
    const now = new Date();
    const m = now.getMonth() + 1, y = now.getFullYear();
    let bud = db.budgets.find((b) => b.familyId === familyId && b.month === m && b.year === y);
    if (!bud) bud = { income: 0, amount: 0 };
    const spent = db.transactions.filter((t) => t.familyId === familyId && t.type === "expense" && txMonthYear(t).m === m && txMonthYear(t).y === y).reduce((s, t) => s + t.amount, 0);
    const income = db.transactions.filter((t) => t.familyId === familyId && t.type === "income" && txMonthYear(t).m === m && txMonthYear(t).y === y).reduce((s, t) => s + t.amount, 0);
    return {
      month: m, year: y, income: bud.income || income, amount: bud.amount,
      spent, remaining: Math.max(0, (bud.amount || 0) - spent),
      percent: bud.amount > 0 ? Math.round((spent / bud.amount) * 100) : 0,
      overBudget: bud.amount > 0 && spent > bud.amount,
    };
  }
  function checkBudget(familyId) {
    const b = currentBudget(familyId);
    if (b.amount > 0 && b.spent >= b.amount) {
      notify(familyId, "budget_exceeded", "Budget exceeded", "You spent " + b.spent + " of " + b.amount + " budget", null, "/budgets");
    } else if (b.amount > 0 && b.percent >= 80) {
      notify(familyId, "budget_warning", "Budget warning", "You've used " + b.percent + "% of your budget", null, "/budgets");
    }
  }
  function buildInsights(familyId) {
    const out = [];
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const thisMonth = db.transactions.filter((t) => t.familyId === familyId && t.type === "expense" && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y);
    const lastMonth = db.transactions.filter((t) => t.familyId === familyId && t.type === "expense" && (() => { const d = new Date(t.date); return d.getMonth() === (m === 0 ? 11 : m - 1) && d.getFullYear() === (m === 0 ? y - 1 : y); })());
    const foodThis = thisMonth.filter((t) => /food|grocer/i.test(t.category)).reduce((s, t) => s + t.amount, 0);
    const foodLast = lastMonth.filter((t) => /food|grocer/i.test(t.category)).reduce((s, t) => s + t.amount, 0);
    if (foodLast > 0) {
      const pct = Math.round(((foodThis - foodLast) / foodLast) * 100);
      out.push({ icon: "utensils", text: pct >= 0 ? "You spent " + pct + "% more on food this month." : "You spent " + Math.abs(pct) + "% less on food this month.", tone: pct > 0 ? "warn" : "good" });
    }
    const elec = thisMonth.filter((t) => /electric/i.test(t.category));
    if (elec.length) out.push({ icon: "bolt", text: "Your electricity spending is tracked this month.", tone: "info" });
    const b = currentBudget(familyId);
    if (b.amount > 0) {
      const pct = Math.round((b.spent / b.amount) * 100);
      out.push({ icon: "wallet", text: pct >= 100 ? "You are over budget this month." : "You're " + pct + "% through your monthly budget.", tone: pct >= 100 ? "bad" : pct >= 80 ? "warn" : "good" });
    } else {
      out.push({ icon: "wallet", text: "Set a monthly budget to track your spending.", tone: "info" });
    }
    const goals = db.goals.filter((g) => g.familyId === familyId && !g.achieved);
    goals.forEach((g) => {
      const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
      out.push({ icon: "target", text: "You're " + pct + "% toward your savings goal \"" + g.name + "\".", tone: pct >= 70 ? "good" : "info" });
    });
    if (!thisMonth.length) out.push({ icon: "info", text: "No expenses recorded this month yet.", tone: "info" });
    return out;
  }
  function tiedMember(tx, familyId, memberId, family) {
    if (memberId) {
      const m = (family && family.members) || db.members.filter((x) => x.familyId === familyId);
      const found = m.find((x) => x.id === memberId);
      if (found) { tx.memberId = found.id; tx.memberName = found.name; }
    }
  }

  // ---------- permissions ----------
  const ROLE_PERMS = {
    owner: ["manage_family","manage_members","manage_budgets","manage_categories","manage_bills","manage_debts","manage_goals","view_all","add_transaction","delete_any_transaction"],
    parent: ["manage_members","manage_budgets","manage_categories","manage_bills","manage_debts","manage_goals","view_all","add_transaction","delete_any_transaction"],
    member: ["view_all","add_transaction"],
    child: ["add_transaction"],
  };
  function can(perm) {
    const r = state.role;
    if (!r) return false;
    return (ROLE_PERMS[r] || []).includes(perm);
  }

  // ---------- session endpoints ----------
  async function me() {
    const user = sessionUser();
    if (!user) {
      state.user = null;
      state.context = { family: null, member: null, currency: "EGP" };
      state.family = null;
      state.role = null;
      state.currency = "EGP";
      state.loaded = true;
      return { user: null, context: state.context };
    }
    state.user = user;
    const member = memberForUser(user.id);
    const context = buildContext(user, member);
    state.context = context;
    state.currency = context.currency || "EGP";
    state.role = context.member ? context.member.role : null;
    state.family = null;
    if (context.family) {
      state.family = familyDetail(findFamily(context.family.id));
      state.currency = context.family.currency;
    }
    state.loaded = true;
    return { user: publicUser(user), context };
  }

  async function refreshFamily() {
    const user = sessionUser();
    const member = memberForUser(user && user.id);
    const context = buildContext(user, member);
    state.context = context;
    state.role = context.member ? context.member.role : null;
    if (context.family) {
      state.family = familyDetail(findFamily(context.family.id));
      state.currency = context.family.currency;
    } else {
      state.family = null;
    }
    return { family: state.family, context };
  }

  async function login(email, password) {
    email = (email || "").toLowerCase().trim();
    const u = db.users.find((x) => x.email === email);
    if (!u) { const e = new Error("Invalid email or password"); e.status = 401; throw e; }
    setSession(u);
    return { user: publicUser(u) };
  }
  async function register(name, email, password) {
    email = (email || "").toLowerCase().trim();
    if (!name || !email || !password) { const e = new Error("Name, email and password are required"); e.status = 400; throw e; }
    if (db.users.find((u) => u.email === email)) { const e = new Error("Email already registered"); e.status = 400; throw e; }
    const user = { id: uid(), email, name, image: null, createdAt: new Date().toISOString() };
    db.users.push(user);
    setSession(user);
    persist();
    return { user: publicUser(user) };
  }
  async function logout() {
    setSession(null);
    state.user = null; state.context = null; state.family = null; state.role = null; state.currency = "EGP";
    return { ok: true };
  }

  // ---------- family ----------
  async function createFamily(name, currency) {
    const user = sessionUser();
    name = (name || "").trim();
    if (!name) { const e = new Error("Family name is required"); e.status = 400; throw e; }
    if (!CURRENCIES.includes((currency || "").toUpperCase())) currency = "EGP";
    else currency = currency.toUpperCase();
    if (memberForUser(user.id)) { const e = new Error("You are already in a family"); e.status = 400; throw e; }
    const fam = { id: uid(), name, image: null, currency, ownerId: user.id, inviteCode: genCode(), createdAt: new Date().toISOString() };
    db.families.push(fam);
    db.members.push({ id: uid(), familyId: fam.id, userId: user.id, name: user.name, image: user.image, role: "owner", allowance: 0, joinedAt: new Date().toISOString() });
    seedCategories(fam.id);
    const now = new Date();
    db.budgets.push({ id: uid(), familyId: fam.id, month: now.getMonth() + 1, year: now.getFullYear(), income: 0, amount: 0, createdAt: new Date().toISOString() });
    logActivity(fam.id, user.name, "family_created", "Created family " + name, user.id);
    notify(fam.id, "family_created", "Welcome to " + name, "Your family was created. Start tracking!", null, "/dashboard");
    persist();
    const member = memberForUser(user.id);
    return { family: familyDetail(fam), context: buildContext(user, member) };
  }
  async function joinFamily(code) {
    const user = sessionUser();
    code = (code || "").trim().toUpperCase();
    const fam = db.families.find((f) => f.inviteCode === code);
    if (!fam) { const e = new Error("Invalid invite code"); e.status = 400; throw e; }
    if (memberForUser(user.id)) { const e = new Error("You are already in a family"); e.status = 400; throw e; }
    db.members.push({ id: uid(), familyId: fam.id, userId: user.id, name: user.name, image: user.image, role: "member", allowance: 0, joinedAt: new Date().toISOString() });
    logActivity(fam.id, user.name, "member_joined", user.name + " joined the family", user.id);
    notify(fam.id, "member_joined", "New member", user.name + " joined " + fam.name, null, "/activity");
    persist();
    const member = memberForUser(user.id);
    return { family: familyDetail(fam), context: buildContext(user, member) };
  }
  async function getFamily() {
    return refreshFamily();
  }
  async function updateFamily(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || member.role !== "owner") { const e = new Error("Only owner can update family"); e.status = 403; throw e; }
    const fam = findFamily(member.familyId);
    if (body.name) fam.name = body.name;
    if (body.currency && CURRENCIES.includes((body.currency || "").toUpperCase())) fam.currency = body.currency.toUpperCase();
    if (typeof body.image === "string") fam.image = body.image || null;
    persist();
    return { family: familyDetail(fam) };
  }
  async function addMember(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const name = (body.name || "").trim();
    if (!name) { const e = new Error("Member name required"); e.status = 400; throw e; }
    let role = (body.role || "member").toLowerCase();
    if (!ROLES.includes(role)) role = "member";
    const allowance = Number(body.allowance) || 0;
    const fam = findFamily(member.familyId);
    let linkedUserId = null;
    if (body.email) {
      const email = (body.email || "").toLowerCase().trim();
      const existing = db.users.find((u) => u.email === email);
      if (existing) linkedUserId = existing.id;
    }
    const newMember = { id: uid(), familyId: fam.id, userId: linkedUserId, name, image: body.image || null, role, allowance, joinedAt: new Date().toISOString() };
    db.members.push(newMember);
    logActivity(fam.id, user.name, "member_added", "Added " + name + " as " + role, user.id);
    notify(fam.id, "member_joined", "Member added", name + " was added to " + fam.name, linkedUserId, "/profile");
    persist();
    return { member: newMember, generatedPassword: null };
  }
  async function updateMember(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const target = db.members.find((m) => m.id === id && m.familyId === member.familyId);
    if (!target) { const e = new Error("Member not found"); e.status = 404; throw e; }
    if (body.name) target.name = body.name;
    if (body.role && ROLES.includes((body.role || "").toLowerCase())) target.role = body.role.toLowerCase();
    if (typeof body.allowance === "number") target.allowance = body.allowance;
    if (typeof body.image === "string") target.image = body.image || null;
    persist();
    return { member: target };
  }
  async function deleteMember(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const target = db.members.find((m) => m.id === id && m.familyId === member.familyId);
    if (!target) { const e = new Error("Member not found"); e.status = 404; throw e; }
    if (target.role === "owner") { const e = new Error("Cannot remove owner"); e.status = 400; throw e; }
    db.members = db.members.filter((m) => m.id !== target.id);
    db.transactions.forEach((t) => { if (t.memberId === target.id) { t.memberId = null; t.memberName = target.name; } });
    persist();
    return { ok: true };
  }
  async function leaveFamily() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) { const e = new Error("Not in a family"); e.status = 400; throw e; }
    if (member.role === "owner") { const e = new Error("Owner cannot leave. Transfer ownership or delete family."); e.status = 400; throw e; }
    db.members = db.members.filter((m) => m.id !== member.id);
    persist();
    return { ok: true };
  }

  // ---------- categories ----------
  async function getCategories() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { categories: [] };
    return { categories: db.categories.filter((c) => c.familyId === member.familyId) };
  }
  async function addCategory(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const name = (body.name || "").trim();
    if (!name) { const e = new Error("Category name required"); e.status = 400; throw e; }
    const type = ["expense", "income", "both"].includes(body.type) ? body.type : "expense";
    const cat = { id: uid(), familyId: member.familyId, name, type, color: body.color || "#3478f6", icon: body.icon || "tag", isDefault: false, createdAt: new Date().toISOString() };
    db.categories.push(cat);
    persist();
    return { category: cat };
  }
  async function deleteCategory(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    db.categories = db.categories.filter((c) => !(c.id === id && c.familyId === member.familyId && !c.isDefault));
    persist();
    return { ok: true };
  }

  // ---------- budget ----------
  async function getBudget() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { budget: null };
    return { budget: currentBudget(member.familyId) };
  }
  async function setBudget(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const now = new Date();
    let bud = db.budgets.find((x) => x.familyId === member.familyId && x.month === now.getMonth() + 1 && x.year === now.getFullYear());
    if (!bud) {
      bud = { id: uid(), familyId: member.familyId, month: now.getMonth() + 1, year: now.getFullYear(), income: 0, amount: 0, createdAt: new Date().toISOString() };
      db.budgets.push(bud);
    }
    if (typeof body.income === "number") bud.income = body.income;
    if (typeof body.amount === "number") bud.amount = body.amount;
    persist();
    return { budget: currentBudget(member.familyId) };
  }

  // ---------- transactions ----------
  async function listTransactions(params) {
    params = params || {};
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { transactions: [] };
    const famId = member.familyId;
    let list = db.transactions.filter((t) => t.familyId === famId);
    const q = params;
    if (q.type) list = list.filter((t) => t.type === q.type);
    if (q.category) list = list.filter((t) => t.category === q.category);
    if (q.memberId) list = list.filter((t) => t.memberId === q.memberId);
    if (q.search) {
      const s = q.search.toLowerCase();
      list = list.filter((t) =>
        (t.title || "").toLowerCase().includes(s) ||
        (t.category || "").toLowerCase().includes(s) ||
        (t.memberName || "").toLowerCase().includes(s) ||
        String(t.amount).includes(s)
      );
    }
    if (q.from) list = list.filter((t) => new Date(t.date) >= new Date(q.from));
    if (q.to) list = list.filter((t) => new Date(t.date) <= new Date(q.to + "T23:59:59"));
    if (q.period === "today") { const d = new Date().toISOString().slice(0, 10); list = list.filter((t) => t.date.slice(0, 10) === d); }
    if (q.period === "week") { const w = new Date(Date.now() - 7 * 864e5); list = list.filter((t) => new Date(t.date) >= w); }
    if (q.period === "month") { const n = new Date(); const m0 = new Date(n.getFullYear(), n.getMonth(), 1); list = list.filter((t) => new Date(t.date) >= m0); }
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { transactions: list.slice(0, 500) };
  }
  async function addTransaction(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) { const e = new Error("No family"); e.status = 400; throw e; }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) { const e = new Error("Valid amount required"); e.status = 400; throw e; }
    const type = body.type === "income" ? "income" : "expense";
    const tx = {
      id: uid(), familyId: member.familyId, userId: user.id, memberId: null, memberName: null,
      type, amount, title: (body.title || (type === "income" ? "Income" : "Expense")).trim(),
      category: (body.category || "Other").trim(), categoryId: body.categoryId || null,
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      paymentMethod: body.paymentMethod || "cash", notes: body.notes || null,
      receipt: body.receipt || null, billId: body.billId || null, createdAt: new Date().toISOString(),
    };
    tiedMember(tx, member.familyId, body.memberId, null);
    db.transactions.push(tx);
    logActivity(member.familyId, user.name, type === "income" ? "income_added" : "expense_added", user.name + " added " + type + " " + tx.title + " — " + tx.amount, user.id);
    notify(member.familyId, type === "income" ? "new_income" : "new_expense", type === "income" ? "New income" : "New expense", user.name + " recorded " + tx.title + " (" + tx.amount + ")", null, "/transactions");
    if (type === "expense") checkBudget(member.familyId);
    persist();
    return { transaction: tx };
  }
  async function updateTransaction(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const tx = db.transactions.find((t) => t.id === id);
    if (!tx) { const e = new Error("Not found"); e.status = 404; throw e; }
    if (!member || tx.familyId !== member.familyId) { const e = new Error("Forbidden"); e.status = 403; throw e; }
    if (typeof body.amount === "number") tx.amount = body.amount;
    if (body.title) tx.title = body.title;
    if (body.category) tx.category = body.category;
    if (body.paymentMethod) tx.paymentMethod = body.paymentMethod;
    if (body.notes !== undefined) tx.notes = body.notes;
    if (body.date) tx.date = new Date(body.date).toISOString();
    if (body.memberId) tiedMember(tx, member.familyId, body.memberId, null);
    persist();
    return { transaction: tx };
  }
  async function deleteTransaction(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const tx = db.transactions.find((t) => t.id === id);
    if (!tx) { const e = new Error("Not found"); e.status = 404; throw e; }
    if (!member || tx.familyId !== member.familyId) { const e = new Error("Forbidden"); e.status = 403; throw e; }
    db.transactions = db.transactions.filter((t) => t.id !== id);
    persist();
    return { ok: true };
  }

  // ---------- bills ----------
  async function listBills() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { bills: [] };
    const list = db.bills.filter((b) => b.familyId === member.familyId).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return { bills: list };
  }
  async function addBill(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent", "member"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) { const e = new Error("Valid amount required"); e.status = 400; throw e; }
    const bill = { id: uid(), familyId: member.familyId, memberId: body.memberId || null, name: (body.name || "Bill").trim(), amount, dueDate: new Date(body.dueDate).toISOString(), status: body.status || "pending", recurring: !!body.recurring, categoryId: body.categoryId || null, note: body.note || null, paidTxId: null, createdAt: new Date().toISOString() };
    db.bills.push(bill);
    logActivity(member.familyId, user.name, "bill_added", "Added bill " + bill.name + " — " + bill.amount, user.id);
    persist();
    return { bill };
  }
  async function updateBill(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const bill = db.bills.find((x) => x.id === id && x.familyId === member.familyId);
    if (!bill) { const e = new Error("Not found"); e.status = 404; throw e; }
    if (body.name) bill.name = body.name;
    if (typeof body.amount === "number") bill.amount = body.amount;
    if (body.dueDate) bill.dueDate = new Date(body.dueDate).toISOString();
    if (body.status) bill.status = body.status;
    if (typeof body.recurring === "boolean") bill.recurring = body.recurring;
    if (body.note !== undefined) bill.note = body.note;
    if (body.pay === true) {
      bill.status = "paid";
      const tx = { id: uid(), familyId: member.familyId, userId: user.id, memberId: bill.memberId, memberName: bill.memberId ? (db.members.find((m) => m.id === bill.memberId) || {}).name : null, type: "expense", amount: bill.amount, title: bill.name, category: "Other", categoryId: bill.categoryId, date: new Date().toISOString(), paymentMethod: "cash", notes: "Bill payment", receipt: null, billId: bill.id, createdAt: new Date().toISOString() };
      db.transactions.push(tx);
      bill.paidTxId = tx.id;
      logActivity(member.familyId, user.name, "bill_paid", "Paid bill " + bill.name + " — " + bill.amount, user.id);
      notify(member.familyId, "bill_paid", "Bill paid", bill.name + " was marked as paid", null, "/bills");
      checkBudget(member.familyId);
    }
    persist();
    return { bill };
  }
  async function deleteBill(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { ok: true };
    db.bills = db.bills.filter((x) => x.id !== id);
    persist();
    return { ok: true };
  }

  // ---------- debts ----------
  async function listDebts() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { debts: [] };
    const list = db.debts.filter((d) => d.familyId === member.familyId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { debts: list };
  }
  async function addDebt(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent", "member"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) { const e = new Error("Valid amount required"); e.status = 400; throw e; }
    const debt = { id: uid(), familyId: member.familyId, memberId: body.memberId || null, person: (body.person || "Someone").trim(), amount, paid: 0, reason: body.reason || null, date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(), dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null, settled: false, note: body.note || null, createdAt: new Date().toISOString() };
    db.debts.push(debt);
    logActivity(member.familyId, user.name, "debt_added", "Added debt from " + debt.person + " — " + debt.amount, user.id);
    persist();
    return { debt };
  }
  async function updateDebt(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const debt = db.debts.find((d) => d.id === id && d.familyId === member.familyId);
    if (!debt) { const e = new Error("Not found"); e.status = 404; throw e; }
    if (body.person) debt.person = body.person;
    if (typeof body.amount === "number") debt.amount = body.amount;
    if (body.reason !== undefined) debt.reason = body.reason;
    if (body.dueDate) debt.dueDate = new Date(body.dueDate).toISOString();
    if (typeof body.settled === "boolean") { debt.settled = body.settled; if (body.settled) debt.paid = debt.amount; }
    if (typeof body.note === "string") debt.note = body.note;
    persist();
    return { debt };
  }
  async function deleteDebt(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { ok: true };
    db.debts = db.debts.filter((d) => d.id !== id);
    db.debtPayments = db.debtPayments.filter((p) => p.debtId !== id);
    persist();
    return { ok: true };
  }
  async function addDebtPayment(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const debt = db.debts.find((d) => d.id === id && d.familyId === member.familyId);
    if (!debt) { const e = new Error("Not found"); e.status = 404; throw e; }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) { const e = new Error("Valid amount required"); e.status = 400; throw e; }
    const payment = { id: uid(), debtId: debt.id, amount, date: new Date(body.date || Date.now()).toISOString(), note: body.note || null, createdAt: new Date().toISOString() };
    db.debtPayments.push(payment);
    debt.paid = (debt.paid || 0) + amount;
    if (debt.paid >= debt.amount) { debt.paid = debt.amount; debt.settled = true; notify(member.familyId, "debt_settled", "Debt settled", "Debt from " + debt.person + " is fully paid", null, "/debts"); }
    logActivity(member.familyId, user.name, "debt_payment", "Paid " + amount + " toward " + debt.person + "'s debt", user.id);
    persist();
    return { debt, payment };
  }

  // ---------- goals ----------
  async function listGoals() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { goals: [] };
    return { goals: db.goals.filter((g) => g.familyId === member.familyId) };
  }
  async function addGoal(body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member || !["owner", "parent", "member"].includes(member.role)) { const e = new Error("Not allowed"); e.status = 403; throw e; }
    const target = Number(body.target);
    if (!target || target <= 0) { const e = new Error("Valid target required"); e.status = 400; throw e; }
    const goal = { id: uid(), familyId: member.familyId, name: (body.name || "Goal").trim(), target, saved: 0, color: body.color || "#22c55e", icon: body.icon || "target", achieved: false, createdAt: new Date().toISOString() };
    db.goals.push(goal);
    logActivity(member.familyId, user.name, "goal_added", "Created goal " + goal.name + " — " + goal.target, user.id);
    persist();
    return { goal };
  }
  async function updateGoal(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const goal = db.goals.find((g) => g.id === id && g.familyId === member.familyId);
    if (!goal) { const e = new Error("Not found"); e.status = 404; throw e; }
    if (body.name) goal.name = body.name;
    if (typeof body.target === "number") goal.target = body.target;
    if (body.color) goal.color = body.color;
    if (body.icon) goal.icon = body.icon;
    persist();
    return { goal };
  }
  async function deleteGoal(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { ok: true };
    db.goals = db.goals.filter((g) => g.id !== id);
    db.goalDeposits = db.goalDeposits.filter((d) => d.goalId !== id);
    persist();
    return { ok: true };
  }
  async function depositGoal(id, body) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const goal = db.goals.find((g) => g.id === id && g.familyId === member.familyId);
    if (!goal) { const e = new Error("Not found"); e.status = 404; throw e; }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) { const e = new Error("Valid amount required"); e.status = 400; throw e; }
    const dep = { id: uid(), goalId: goal.id, amount, date: new Date(body.date || Date.now()).toISOString(), note: body.note || null, createdAt: new Date().toISOString() };
    db.goalDeposits.push(dep);
    goal.saved = (goal.saved || 0) + amount;
    if (!goal.achieved && goal.saved >= goal.target) { goal.achieved = true; notify(member.familyId, "goal_achieved", "Goal achieved!", goal.name + " reached its target", null, "/goals"); }
    logActivity(member.familyId, user.name, "goal_deposit", "Added " + amount + " to " + goal.name, user.id);
    persist();
    return { goal, deposit: dep };
  }

  // ---------- notifications / activity / insights ----------
  async function listNotifications() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { notifications: [] };
    const list = db.notifications.filter((n) => n.familyId === member.familyId && (!n.userId || n.userId === user.id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { notifications: list };
  }
  async function markNotification(id) {
    const user = sessionUser();
    const member = memberForUser(user.id);
    const n = db.notifications.find((x) => x.id === id && x.familyId === member.familyId);
    if (n) { n.read = true; persist(); }
    return { notification: n };
  }
  async function markAll() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    db.notifications.forEach((n) => { if (n.familyId === member.familyId && (!n.userId || n.userId === user.id)) n.read = true; });
    persist();
    return { ok: true };
  }
  async function listActivity() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { activities: [] };
    const list = db.activities.filter((a) => a.familyId === member.familyId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200);
    return { activities: list };
  }
  async function getInsights() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) return { insights: [] };
    return { insights: buildInsights(member.familyId) };
  }
  async function exportCsv() {
    const user = sessionUser();
    const member = memberForUser(user.id);
    if (!member) { const e = new Error("Forbidden"); e.status = 403; throw e; }
    const list = db.transactions.filter((t) => t.familyId === member.familyId);
    const header = ["Date", "Type", "Title", "Category", "Amount", "PaidBy", "Method", "Notes"];
    const rows = list.map((t) => [t.date.slice(0, 10), t.type, t.title, t.category, t.amount, t.memberName || "", t.paymentMethod, (t.notes || "").replace(/"/g, '""')]);
    const csv = [header].concat(rows).map((r) => r.map((c) => '"' + c + '"').join(",")).join("\n");
    return "\uFEFF" + csv;
  }

  return {
    state, me, refreshFamily, can,
    login, register, logout,
    createFamily, joinFamily, getFamily, updateFamily,
    addMember, updateMember, deleteMember, leaveFamily,
    getCategories, addCategory, deleteCategory,
    getBudget, setBudget,
    listTransactions, addTransaction, updateTransaction, deleteTransaction,
    listBills, addBill, updateBill, deleteBill,
    listDebts, addDebt, updateDebt, deleteDebt, addDebtPayment,
    listGoals, addGoal, updateGoal, deleteGoal, depositGoal,
    listNotifications, markNotification, markAll,
    listActivity, getInsights, exportCsv,
  };
})();