"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "db.json");

let dbPool = null;
function getPool() {
  if (!dbPool) {
    const { Pool } = require("pg");
    dbPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false } });
    dbPool.on("error", (e) => console.error("pg pool error", e));
  }
  return dbPool;
}
async function ensureDbTable() {
  await getPool().query('CREATE TABLE IF NOT EXISTS app_data (key text PRIMARY KEY, value jsonb NOT NULL)');
}

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

// ---------- Database (JSON file) ----------
let db = {
  users: [],
  sessions: [],
  families: [],
  members: [],
  categories: [],
  transactions: [],
  bills: [],
  debts: [],
  debtPayments: [],
  goals: [],
  goalDeposits: [],
  budgets: [],
  notifications: [],
  activities: [],
};

async function loadDb() {
  if (process.env.DATABASE_URL) {
    try {
      await ensureDbTable();
      const r = await getPool().query("SELECT value FROM app_data WHERE key = 'db'");
      if (r.rows.length && r.rows[0].value) db = Object.assign(db, r.rows[0].value);
      return;
    } catch (e) {
      console.error("Failed to load db from postgres, falling back to file", e.message);
    }
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      db = Object.assign(db, JSON.parse(raw));
    }
  } catch (e) {
    console.error("Failed to load db", e);
  }
}
let saveTimer = null;
function saveDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      if (process.env.DATABASE_URL) {
        await getPool().query(
          "INSERT INTO app_data(key, value) VALUES('db', $1::jsonb) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
          [JSON.stringify(db)]
        );
        return;
      }
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
      console.error("Failed to save db", e);
    }
  }, 50);
}
function id() {
  return crypto.randomBytes(12).toString("hex");
}
function genCode(n = 6) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

// ---------- Auth helpers ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${h}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, h] = stored.split(":");
  const h2 = crypto.scryptSync(pw, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(h2));
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions.push({ token, userId, createdAt: new Date().toISOString() });
  saveDb();
  return token;
}
function getSessionUser(req) {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/oh_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const s = db.sessions.find((x) => x.token === token);
  if (!s) return null;
  return db.users.find((u) => u.id === s.userId) || null;
}
function getMemberForUser(userId) {
  // latest membership
  const ms = db.members
    .filter((m) => m.userId === userId)
    .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
  return ms[0] || null;
}

// ---------- Helpers ----------
function send(res, status, obj, headers = {}) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e7) req.destroy();
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
function setCookie(res, name, value, maxAge = 60 * 60 * 24 * 30) {
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax`);
}
function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}
function logActivity(familyId, userName, action, detail, userId) {
  db.activities.push({
    id: id(), familyId, userId: userId || null, userName, action, detail,
    createdAt: new Date().toISOString(),
  });
  saveDb();
}
function notify(familyId, type, title, body, userId, link) {
  db.notifications.push({
    id: id(), familyId, userId: userId || null, type, title, body,
    link: link || null, read: false, createdAt: new Date().toISOString(),
  });
  saveDb();
}
function findFamily(familyId) {
  return db.families.find((f) => f.id === familyId);
}

// month/year helpers
function txMonthYear(tx) {
  const d = new Date(tx.date);
  return { m: d.getMonth() + 1, y: d.getFullYear() };
}

// ---------- API Router ----------
async function handleApi(req, res, pathname, query) {
  const method = req.method;
  const user = getSessionUser(req);

  // auth endpoints (public)
  if (pathname === "/api/auth/register" && method === "POST") {
    const b = await readBody(req);
    const email = (b.email || "").toLowerCase().trim();
    const password = b.password || "";
    const name = (b.name || "").trim();
    if (!email || !password || !name) return send(res, 400, { error: "Name, email and password are required" });
    if (password.length < 4) return send(res, 400, { error: "Password must be at least 4 characters" });
    if (db.users.find((u) => u.email === email)) return send(res, 400, { error: "Email already registered" });
    const userRec = {
      id: id(), email, name, passwordHash: hashPassword(password), image: null, createdAt: new Date().toISOString(),
    };
    db.users.push(userRec);
    const token = createSession(userRec.id);
    setCookie(res, "oh_session", token);
    return send(res, 200, { user: publicUser(userRec) });
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    const b = await readBody(req);
    const email = (b.email || "").toLowerCase().trim();
    const password = b.password || "";
    const u = db.users.find((x) => x.email === email);
    if (!u || !verifyPassword(password, u.passwordHash)) return send(res, 401, { error: "Invalid email or password" });
    const token = createSession(u.id);
    setCookie(res, "oh_session", token);
    return send(res, 200, { user: publicUser(u) });
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    const cookie = req.headers.cookie || "";
    const m = cookie.match(/oh_session=([^;]+)/);
    if (m) db.sessions = db.sessions.filter((s) => s.token !== decodeURIComponent(m[1]));
    clearCookie(res, "oh_session");
    saveDb();
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/auth/me" && method === "GET") {
    if (!user) return send(res, 401, { error: "Not authenticated" });
    const member = getMemberForUser(user.id);
    return send(res, 200, { user: publicUser(user), context: buildContext(user, member) });
  }

  // require auth for everything else
  if (!user) return send(res, 401, { error: "Not authenticated" });

  // family create
  if (pathname === "/api/family" && method === "POST") {
    const b = await readBody(req);
    const name = (b.name || "").trim();
    if (!name) return send(res, 400, { error: "Family name is required" });
    let currency = (b.currency || "EGP").toUpperCase();
    if (!CURRENCIES.includes(currency)) currency = "EGP";
    const fam = {
      id: id(), name, image: null, currency, ownerId: user.id, inviteCode: genCode(),
      createdAt: new Date().toISOString(),
    };
    db.families.push(fam);
    db.members.push({
      id: id(), familyId: fam.id, userId: user.id, name: user.name, image: user.image,
      role: "owner", allowance: 0, joinedAt: new Date().toISOString(),
    });
    seedCategories(fam.id);
    const now = new Date();
    db.budgets.push({
      id: id(), familyId: fam.id, month: now.getMonth() + 1, year: now.getFullYear(), income: 0, amount: 0,
      createdAt: new Date().toISOString(),
    });
    logActivity(fam.id, user.name, "family_created", `Created family ${name}`, user.id);
    notify(fam.id, "family_created", "Welcome to " + name, "Your family was created. Start tracking!", null, "/dashboard");
    saveDb();
    const member = getMemberForUser(user.id);
    return send(res, 200, { family: familyDetail(fam, member), context: buildContext(user, member) });
  }

  // join family
  if (pathname === "/api/family/join" && method === "POST") {
    const b = await readBody(req);
    const code = (b.inviteCode || "").trim().toUpperCase();
    const fam = db.families.find((f) => f.inviteCode === code);
    if (!fam) return send(res, 400, { error: "Invalid invite code" });
    if (getMemberForUser(user.id)) return send(res, 400, { error: "You are already in a family" });
    const member = {
      id: id(), familyId: fam.id, userId: user.id, name: user.name, image: user.image,
      role: "member", allowance: 0, joinedAt: new Date().toISOString(),
    };
    db.members.push(member);
    logActivity(fam.id, user.name, "member_joined", `${user.name} joined the family`, user.id);
    notify(fam.id, "member_joined", "New member", `${user.name} joined ${fam.name}`, null, "/activity");
    saveDb();
    return send(res, 200, { family: familyDetail(fam, member), context: buildContext(user, member) });
  }

  // get family (+ members, categories, budget)
  if (pathname === "/api/family" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { family: null, context: buildContext(user, null) });
    const fam = findFamily(member.familyId);
    return send(res, 200, { family: familyDetail(fam, member), context: buildContext(user, member) });
  }

  // update family settings
  if (pathname === "/api/family" && method === "PATCH") {
    const member = getMemberForUser(user.id);
    if (!member || member.role !== "owner") return send(res, 403, { error: "Only owner can update family" });
    const b = await readBody(req);
    const fam = findFamily(member.familyId);
    if (b.name) fam.name = b.name;
    if (b.currency && CURRENCIES.includes((b.currency || "").toUpperCase())) fam.currency = b.currency.toUpperCase();
    if (typeof b.image === "string") fam.image = b.image || null;
    saveDb();
    return send(res, 200, { family: familyDetail(fam, member) });
  }

  // add member
  if (pathname === "/api/family/members" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const name = (b.name || "").trim();
    if (!name) return send(res, 400, { error: "Member name required" });
    let role = (b.role || "member").toLowerCase();
    if (!ROLES.includes(role)) role = "member";
    const allowance = Number(b.allowance) || 0;
    const fam = findFamily(member.familyId);
    let linkedUserId = null;
    let generatedPassword = null;
    if (b.email) {
      const email = (b.email || "").toLowerCase().trim();
      let existing = db.users.find((u) => u.email === email);
      if (existing && !getMemberForUser(existing.id)) {
        linkedUserId = existing.id;
      } else if (!existing) {
        generatedPassword = genCode(8).toLowerCase() + "1";
        existing = {
          id: id(), email, name, passwordHash: hashPassword(generatedPassword), image: b.image || null,
          createdAt: new Date().toISOString(),
        };
        db.users.push(existing);
        linkedUserId = existing.id;
      }
    }
    const newMember = {
      id: id(), familyId: fam.id, userId: linkedUserId, name, image: b.image || null,
      role, allowance, joinedAt: new Date().toISOString(),
    };
    db.members.push(newMember);
    logActivity(fam.id, user.name, "member_added", `Added ${name} as ${role}`, user.id);
    notify(fam.id, "member_joined", "Member added", `${name} was added to ${fam.name}`, linkedUserId, "/profile");
    saveDb();
    return send(res, 200, { member: newMember, generatedPassword });
  }

  // update / delete member
  let mm = pathname.match(/^\/api\/family\/members\/([\w]+)$/);
  if (mm) {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const target = db.members.find((m) => m.id === mm[1] && m.familyId === member.familyId);
    if (!target) return send(res, 404, { error: "Member not found" });
    if (method === "PATCH") {
      const b = await readBody(req);
      if (b.name) target.name = b.name;
      if (b.role && ROLES.includes((b.role || "").toLowerCase())) target.role = b.role.toLowerCase();
      if (typeof b.allowance === "number") target.allowance = b.allowance;
      if (typeof b.image === "string") target.image = b.image || null;
      saveDb();
      return send(res, 200, { member: target });
    }
    if (method === "DELETE") {
      if (target.userId === member.familyId && target.role === "owner") return send(res, 400, { error: "Cannot remove owner" });
      db.members = db.members.filter((m) => m.id !== target.id);
      db.transactions.forEach((t) => { if (t.memberId === target.id) { t.memberId = null; t.memberName = target.name; } });
      saveDb();
      return send(res, 200, { ok: true });
    }
  }

  // leave family
  if (pathname === "/api/family/leave" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 400, { error: "Not in a family" });
    if (member.role === "owner") return send(res, 400, { error: "Owner cannot leave. Transfer ownership or delete family." });
    db.members = db.members.filter((m) => m.id !== member.id);
    saveDb();
    return send(res, 200, { ok: true });
  }

  // categories
  if (pathname === "/api/categories" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { categories: [] });
    return send(res, 200, { categories: db.categories.filter((c) => c.familyId === member.familyId) });
  }
  if (pathname === "/api/categories" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const name = (b.name || "").trim();
    if (!name) return send(res, 400, { error: "Category name required" });
    const type = ["expense", "income", "both"].includes(b.type) ? b.type : "expense";
    const cat = {
      id: id(), familyId: member.familyId, name, type, color: b.color || "#3478f6",
      icon: b.icon || "tag", isDefault: false, createdAt: new Date().toISOString(),
    };
    db.categories.push(cat);
    saveDb();
    return send(res, 200, { category: cat });
  }
  let cm = pathname.match(/^\/api\/categories\/([\w]+)$/);
  if (cm && method === "DELETE") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    db.categories = db.categories.filter((c) => !(c.id === cm[1] && c.familyId === member.familyId && !c.isDefault));
    saveDb();
    return send(res, 200, { ok: true });
  }

  // budget (current month)
  if (pathname === "/api/budget" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { budget: null });
    return send(res, 200, { budget: currentBudget(member.familyId) });
  }
  if (pathname === "/api/budget" && method === "PATCH") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const now = new Date();
    let bud = db.budgets.find((x) => x.familyId === member.familyId && x.month === now.getMonth() + 1 && x.year === now.getFullYear());
    if (!bud) {
      bud = { id: id(), familyId: member.familyId, month: now.getMonth() + 1, year: now.getFullYear(), income: 0, amount: 0, createdAt: new Date().toISOString() };
      db.budgets.push(bud);
    }
    if (typeof b.income === "number") bud.income = b.income;
    if (typeof b.amount === "number") bud.amount = b.amount;
    saveDb();
    return send(res, 200, { budget: currentBudget(member.familyId) });
  }

  // transactions
  if (pathname === "/api/transactions" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { transactions: [] });
    const famId = member.familyId;
    let list = db.transactions.filter((t) => t.familyId === famId);
    const q = query;
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
    return send(res, 200, { transactions: list.slice(0, 500) });
  }
  if (pathname === "/api/transactions" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 400, { error: "No family" });
    if (!["owner", "parent", "member", "child"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const amount = Number(b.amount);
    if (!amount || amount <= 0) return send(res, 400, { error: "Valid amount required" });
    const type = b.type === "income" ? "income" : "expense";
    let memberName = null, memberId = null;
    if (b.memberId) {
      const m = db.members.find((x) => x.id === b.memberId && x.familyId === member.familyId);
      if (m) { memberId = m.id; memberName = m.name; }
    }
    const tx = {
      id: id(), familyId: member.familyId, userId: user.id, memberId, memberName,
      type, amount, title: (b.title || (type === "income" ? "Income" : "Expense")).trim(),
      category: (b.category || "Other").trim(), categoryId: b.categoryId || null,
      date: b.date ? new Date(b.date).toISOString() : new Date().toISOString(),
      paymentMethod: b.paymentMethod || "cash", notes: b.notes || null,
      receipt: b.receipt || null, billId: b.billId || null, createdAt: new Date().toISOString(),
    };
    db.transactions.push(tx);
    logActivity(member.familyId, user.name, type === "income" ? "income_added" : "expense_added",
      `${user.name} added ${type} ${tx.title} — ${tx.amount}`, user.id);
    notify(member.familyId, type === "income" ? "new_income" : "new_expense",
      type === "income" ? "New income" : "New expense",
      `${user.name} recorded ${tx.title} (${tx.amount})`, null, "/transactions");
    // budget warning
    if (type === "expense") checkBudget(member.familyId);
    saveDb();
    return send(res, 200, { transaction: tx });
  }
  let tm = pathname.match(/^\/api\/transactions\/([\w]+)$/);
  if (tm) {
    const member = getMemberForUser(user.id);
    const tx = db.transactions.find((t) => t.id === tm[1]);
    if (!tx) return send(res, 404, { error: "Not found" });
    if (tx.familyId !== member.familyId) return send(res, 403, { error: "Forbidden" });
    if (method === "PATCH") {
      const b = await readBody(req);
      if (typeof b.amount === "number") tx.amount = b.amount;
      if (b.title) tx.title = b.title;
      if (b.category) tx.category = b.category;
      if (b.paymentMethod) tx.paymentMethod = b.paymentMethod;
      if (b.notes !== undefined) tx.notes = b.notes;
      if (b.date) tx.date = new Date(b.date).toISOString();
      if (b.memberId) { const m = db.members.find((x) => x.id === b.memberId && x.familyId === member.familyId); if (m) { tx.memberId = m.id; tx.memberName = m.name; } }
      saveDb();
      return send(res, 200, { transaction: tx });
    }
    if (method === "DELETE") {
      if (member.role === "child" && tx.userId !== user.id) return send(res, 403, { error: "Cannot delete others' transactions" });
      if (!["owner", "parent"].includes(member.role) && tx.userId !== user.id) return send(res, 403, { error: "Forbidden" });
      db.transactions = db.transactions.filter((t) => t.id !== tm[1]);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }

  // bills
  if (pathname === "/api/bills" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { bills: [] });
    const list = db.bills.filter((b) => b.familyId === member.familyId).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return send(res, 200, { bills: list });
  }
  if (pathname === "/api/bills" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent", "member"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const amount = Number(b.amount);
    if (!amount || amount <= 0) return send(res, 400, { error: "Valid amount required" });
    const bill = {
      id: id(), familyId: member.familyId, memberId: b.memberId || null, name: (b.name || "Bill").trim(),
      amount, dueDate: new Date(b.dueDate).toISOString(), status: b.status || "pending",
      recurring: !!b.recurring, categoryId: b.categoryId || null, note: b.note || null, paidTxId: null,
      createdAt: new Date().toISOString(),
    };
    db.bills.push(bill);
    logActivity(member.familyId, user.name, "bill_added", `Added bill ${bill.name} — ${bill.amount}`, user.id);
    saveDb();
    return send(res, 200, { bill });
  }
  let bm = pathname.match(/^\/api\/bills\/([\w]+)$/);
  if (bm) {
    const member = getMemberForUser(user.id);
    const bill = db.bills.find((x) => x.id === bm[1] && x.familyId === member.familyId);
    if (!bill) return send(res, 404, { error: "Not found" });
    if (method === "PATCH") {
      const b = await readBody(req);
      if (b.name) bill.name = b.name;
      if (typeof b.amount === "number") bill.amount = b.amount;
      if (b.dueDate) bill.dueDate = new Date(b.dueDate).toISOString();
      if (b.status) bill.status = b.status;
      if (typeof b.recurring === "boolean") bill.recurring = b.recurring;
      if (b.note !== undefined) bill.note = b.note;
      if (b.pay === true) {
        bill.status = "paid";
        const tx = {
          id: id(), familyId: member.familyId, userId: user.id, memberId: bill.memberId,
          memberName: bill.memberId ? (db.members.find((m) => m.id === bill.memberId) || {}).name : null,
          type: "expense", amount: bill.amount, title: bill.name, category: "Other", categoryId: bill.categoryId,
          date: new Date().toISOString(), paymentMethod: "cash", notes: "Bill payment", receipt: null,
          billId: bill.id, createdAt: new Date().toISOString(),
        };
        db.transactions.push(tx);
        bill.paidTxId = tx.id;
        logActivity(member.familyId, user.name, "bill_paid", `Paid bill ${bill.name} — ${bill.amount}`, user.id);
        notify(member.familyId, "bill_paid", "Bill paid", `${bill.name} was marked as paid`, null, "/bills");
        checkBudget(member.familyId);
      }
      saveDb();
      return send(res, 200, { bill });
    }
    if (method === "DELETE") {
      db.bills = db.bills.filter((x) => x.id !== bm[1]);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }

  // debts
  if (pathname === "/api/debts" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { debts: [] });
    const list = db.debts.filter((d) => d.familyId === member.familyId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return send(res, 200, { debts: list });
  }
  if (pathname === "/api/debts" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent", "member"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const amount = Number(b.amount);
    if (!amount || amount <= 0) return send(res, 400, { error: "Valid amount required" });
    const debt = {
      id: id(), familyId: member.familyId, memberId: b.memberId || null, person: (b.person || "Someone").trim(),
      amount, paid: 0, reason: b.reason || null, date: b.date ? new Date(b.date).toISOString() : new Date().toISOString(),
      dueDate: b.dueDate ? new Date(b.dueDate).toISOString() : null, settled: false, note: b.note || null,
      createdAt: new Date().toISOString(),
    };
    db.debts.push(debt);
    logActivity(member.familyId, user.name, "debt_added", `Added debt from ${debt.person} — ${debt.amount}`, user.id);
    saveDb();
    return send(res, 200, { debt });
  }
  let dm = pathname.match(/^\/api\/debts\/([\w]+)$/);
  if (dm) {
    const member = getMemberForUser(user.id);
    const debt = db.debts.find((d) => d.id === dm[1] && d.familyId === member.familyId);
    if (!debt) return send(res, 404, { error: "Not found" });
    if (method === "PATCH") {
      const b = await readBody(req);
      if (b.person) debt.person = b.person;
      if (typeof b.amount === "number") debt.amount = b.amount;
      if (b.reason !== undefined) debt.reason = b.reason;
      if (b.dueDate) debt.dueDate = new Date(b.dueDate).toISOString();
      if (typeof b.settled === "boolean") { debt.settled = b.settled; if (b.settled) { debt.paid = debt.amount; } }
      if (typeof b.note === "string") debt.note = b.note;
      saveDb();
      return send(res, 200, { debt });
    }
    if (method === "DELETE") {
      db.debts = db.debts.filter((d) => d.id !== dm[1]);
      db.debtPayments = db.debtPayments.filter((p) => p.debtId !== dm[1]);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }
  let dpm = pathname.match(/^\/api\/debts\/([\w]+)\/payments$/);
  if (dpm && method === "POST") {
    const member = getMemberForUser(user.id);
    const debt = db.debts.find((d) => d.id === dpm[1] && d.familyId === member.familyId);
    if (!debt) return send(res, 404, { error: "Not found" });
    const b = await readBody(req);
    const amount = Number(b.amount);
    if (!amount || amount <= 0) return send(res, 400, { error: "Valid amount required" });
    const payment = { id: id(), debtId: debt.id, amount, date: new Date(b.date || Date.now()).toISOString(), note: b.note || null, createdAt: new Date().toISOString() };
    db.debtPayments.push(payment);
    debt.paid = (debt.paid || 0) + amount;
    if (debt.paid >= debt.amount) { debt.paid = debt.amount; debt.settled = true; notify(member.familyId, "debt_settled", "Debt settled", `Debt from ${debt.person} is fully paid`, null, "/debts"); }
    logActivity(member.familyId, user.name, "debt_payment", `Paid ${amount} toward ${debt.person}'s debt`, user.id);
    saveDb();
    return send(res, 200, { debt, payment });
  }

  // goals
  if (pathname === "/api/goals" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { goals: [] });
    const list = db.goals.filter((g) => g.familyId === member.familyId);
    return send(res, 200, { goals: list });
  }
  if (pathname === "/api/goals" && method === "POST") {
    const member = getMemberForUser(user.id);
    if (!member || !["owner", "parent", "member"].includes(member.role)) return send(res, 403, { error: "Not allowed" });
    const b = await readBody(req);
    const target = Number(b.target);
    if (!target || target <= 0) return send(res, 400, { error: "Valid target required" });
    const goal = {
      id: id(), familyId: member.familyId, name: (b.name || "Goal").trim(), target, saved: 0,
      color: b.color || "#22c55e", icon: b.icon || "target", achieved: false, createdAt: new Date().toISOString(),
    };
    db.goals.push(goal);
    logActivity(member.familyId, user.name, "goal_added", `Created goal ${goal.name} — ${goal.target}`, user.id);
    saveDb();
    return send(res, 200, { goal });
  }
  let gm = pathname.match(/^\/api\/goals\/([\w]+)$/);
  if (gm) {
    const member = getMemberForUser(user.id);
    const goal = db.goals.find((g) => g.id === gm[1] && g.familyId === member.familyId);
    if (!goal) return send(res, 404, { error: "Not found" });
    if (method === "PATCH") {
      const b = await readBody(req);
      if (b.name) goal.name = b.name;
      if (typeof b.target === "number") goal.target = b.target;
      if (b.color) goal.color = b.color;
      if (b.icon) goal.icon = b.icon;
      saveDb();
      return send(res, 200, { goal });
    }
    if (method === "DELETE") {
      db.goals = db.goals.filter((g) => g.id !== gm[1]);
      db.goalDeposits = db.goalDeposits.filter((d) => d.goalId !== gm[1]);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }
  let gdm = pathname.match(/^\/api\/goals\/([\w]+)\/deposit$/);
  if (gdm && method === "POST") {
    const member = getMemberForUser(user.id);
    const goal = db.goals.find((g) => g.id === gdm[1] && g.familyId === member.familyId);
    if (!goal) return send(res, 404, { error: "Not found" });
    const b = await readBody(req);
    const amount = Number(b.amount);
    if (!amount || amount <= 0) return send(res, 400, { error: "Valid amount required" });
    const dep = { id: id(), goalId: goal.id, amount, date: new Date(b.date || Date.now()).toISOString(), note: b.note || null, createdAt: new Date().toISOString() };
    db.goalDeposits.push(dep);
    goal.saved = (goal.saved || 0) + amount;
    if (!goal.achieved && goal.saved >= goal.target) { goal.achieved = true; notify(member.familyId, "goal_achieved", "Goal achieved!", `${goal.name} reached its target`, null, "/goals"); }
    logActivity(member.familyId, user.name, "goal_deposit", `Added ${amount} to ${goal.name}`, user.id);
    saveDb();
    return send(res, 200, { goal, deposit: dep });
  }

  // notifications
  if (pathname === "/api/notifications" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { notifications: [] });
    const list = db.notifications.filter((n) => n.familyId === member.familyId && (!n.userId || n.userId === user.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return send(res, 200, { notifications: list });
  }
  let nm = pathname.match(/^\/api\/notifications\/([\w]+)$/);
  if (nm && method === "PATCH") {
    const member = getMemberForUser(user.id);
    const n = db.notifications.find((x) => x.id === nm[1] && x.familyId === member.familyId);
    if (!n) return send(res, 404, { error: "Not found" });
    n.read = true; saveDb();
    return send(res, 200, { notification: n });
  }
  if (pathname === "/api/notifications/read-all" && method === "POST") {
    const member = getMemberForUser(user.id);
    db.notifications.forEach((n) => { if (n.familyId === member.familyId && (!n.userId || n.userId === user.id)) n.read = true; });
    saveDb();
    return send(res, 200, { ok: true });
  }

  // activity
  if (pathname === "/api/activity" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { activities: [] });
    const list = db.activities.filter((a) => a.familyId === member.familyId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200);
    return send(res, 200, { activities: list });
  }

  // insights
  if (pathname === "/api/insights" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 200, { insights: [] });
    const insights = buildInsights(member.familyId);
    return send(res, 200, { insights });
  }

  // export csv
  if (pathname === "/api/export/csv" && method === "GET") {
    const member = getMemberForUser(user.id);
    if (!member) return send(res, 403, { error: "Forbidden" });
    const list = db.transactions.filter((t) => t.familyId === member.familyId);
    const header = ["Date", "Type", "Title", "Category", "Amount", "PaidBy", "Method", "Notes"];
    const rows = list.map((t) => [t.date.slice(0, 10), t.type, t.title, t.category, t.amount, t.memberName || "", t.paymentMethod, (t.notes || "").replace(/"/g, '""')]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=our-home-transactions.csv" });
    return res.end("\uFEFF" + csv);
  }

  return send(res, 404, { error: "Not found" });
}

// ---------- Build context / derived data ----------
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, image: u.image };
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
function familyDetail(fam, member) {
  const members = db.members.filter((m) => m.familyId === fam.id);
  const categories = db.categories.filter((c) => c.familyId === fam.id);
  return { ...fam, members, categories };
}
function seedCategories(familyId) {
  const now = new Date().toISOString();
  DEFAULT_EXPENSE_CATEGORIES.forEach((c) => db.categories.push({ id: id(), familyId, name: c.name, type: "expense", color: c.color, icon: c.icon, isDefault: true, createdAt: now }));
  DEFAULT_INCOME_CATEGORIES.forEach((c) => db.categories.push({ id: id(), familyId, name: c.name, type: "income", color: c.color, icon: c.icon, isDefault: true, createdAt: now }));
  saveDb();
}
function currentBudget(familyId) {
  const now = new Date();
  const m = now.getMonth() + 1, y = now.getFullYear();
  let bud = db.budgets.find((b) => b.familyId === familyId && b.month === m && b.year === y);
  if (!bud) bud = { income: 0, amount: 0 };
  const spent = db.transactions.filter((t) => t.familyId === familyId && t.type === "expense" && txMonthYear(t).m === m && txMonthYear(t).y === y)
    .reduce((s, t) => s + t.amount, 0);
  const income = db.transactions.filter((t) => t.familyId === familyId && t.type === "income" && txMonthYear(t).m === m && txMonthYear(t).y === y)
    .reduce((s, t) => s + t.amount, 0);
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
    notify(familyId, "budget_exceeded", "Budget exceeded", `You spent ${b.spent} of ${b.amount} budget`, null, "/budgets");
  } else if (b.amount > 0 && b.percent >= 80) {
    notify(familyId, "budget_warning", "Budget warning", `You've used ${b.percent}% of your budget`, null, "/budgets");
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
    out.push({ icon: "utensils", text: pct >= 0 ? `You spent ${pct}% more on food this month.` : `You spent ${Math.abs(pct)}% less on food this month.`, tone: pct > 0 ? "warn" : "good" });
  }
  const elec = thisMonth.filter((t) => /electric/i.test(t.category));
  if (elec.length) out.push({ icon: "bolt", text: `Your electricity spending is ${foodThis > 0 ? "tracked" : "recorded"} this month.`, tone: "info" });
  const b = currentBudget(familyId);
  if (b.amount > 0) {
    const pct = Math.round((b.spent / b.amount) * 100);
    out.push({ icon: "wallet", text: pct >= 100 ? "You are over budget this month." : `You're ${pct}% through your monthly budget.`, tone: pct >= 100 ? "bad" : pct >= 80 ? "warn" : "good" });
  } else {
    out.push({ icon: "wallet", text: "Set a monthly budget to track your spending.", tone: "info" });
  }
  const goals = db.goals.filter((g) => g.familyId === familyId && !g.achieved);
  goals.forEach((g) => {
    const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
    out.push({ icon: "target", text: `You're ${pct}% toward your savings goal "${g.name}".`, tone: pct >= 70 ? "good" : "info" });
  });
  if (!thisMonth.length) out.push({ icon: "info", text: "No expenses recorded this month yet.", tone: "info" });
  return out;
}

// ---------- Static file serving ----------
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png",
  ".woff2": "font/woff2",
};
function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[\/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: "Forbidden" });
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, d2) => {
        if (e2) return send(res, 404, { error: "Not found" });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(u.pathname);
  const query = Object.fromEntries(u.searchParams.entries());
  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname, query);
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: "Server error", detail: String(err && err.message || err) });
  }
});
(async () => {
  try {
    await loadDb();
  } catch (e) {
    console.error("Startup load failed", e);
  }
  server.listen(PORT, () => {
    console.log(`Our Home running at http://localhost:${PORT}`);
  });
})();
