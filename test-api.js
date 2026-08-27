"use strict";
const BASE = "http://localhost:3000";

async function call(method, path, body, cookie) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, setCookie };
}

(async () => {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra) => { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, extra || ""); } };

  // register user A
  let r = await call("POST", "/api/auth/register", { name: "Dad", email: "dad@test.com", password: "pass123" });
  ok("register A", r.status === 200 && r.data.user, r.data);
  let cookieA = r.setCookie;
  ok("session cookie A", !!cookieA, r.setCookie);

  r = await call("GET", "/api/auth/me", null, cookieA);
  ok("me A no family", r.data.context.family === null, r.data);

  // create family
  r = await call("POST", "/api/family", { name: "Al Mansour", currency: "EGP" }, cookieA);
  ok("create family", r.status === 200 && r.data.family, r.data);
  const fam = r.data.family;
  ok("default categories seeded", fam.categories.length >= 18, fam.categories.length);
  ok("invite code present", !!fam.inviteCode, fam.inviteCode);

  // add expense
  r = await call("POST", "/api/transactions", { type: "expense", amount: 350, title: "Groceries", category: "Groceries", paymentMethod: "card" }, cookieA);
  ok("add expense", r.status === 200 && r.data.transaction.type === "expense", r.data);

  // add income
  r = await call("POST", "/api/transactions", { type: "income", amount: 15000, title: "Salary", category: "Salary" }, cookieA);
  ok("add income", r.status === 200 && r.data.transaction.type === "income", r.data);

  // budget
  r = await call("PATCH", "/api/budget", { income: 15000, amount: 10000 }, cookieA);
  ok("set budget", r.status === 200 && r.data.budget.amount === 10000, r.data);

  // bills
  r = await call("POST", "/api/bills", { name: "Electricity", amount: 600, dueDate: "2026-09-01" }, cookieA);
  ok("add bill", r.status === 200 && r.data.bill, r.data);
  const billId = r.data.bill.id;
  r = await call("PATCH", "/api/bills/" + billId, { pay: true }, cookieA);
  ok("pay bill -> expense created", r.status === 200 && r.data.bill.status === "paid", r.data);

  // debts
  r = await call("POST", "/api/debts", { person: "Uncle", amount: 2000, reason: "loan" }, cookieA);
  ok("add debt", r.status === 200 && r.data.debt, r.data);
  const debtId = r.data.debt.id;
  r = await call("POST", "/api/debts/" + debtId + "/payments", { amount: 800 }, cookieA);
  ok("debt payment", r.status === 200 && r.data.debt.paid === 800, r.data);

  // goals
  r = await call("POST", "/api/goals", { name: "New TV", target: 20000 }, cookieA);
  ok("add goal", r.status === 200 && r.data.goal, r.data);
  const goalId = r.data.goal.id;
  r = await call("POST", "/api/goals/" + goalId + "/deposit", { amount: 8500 }, cookieA);
  ok("goal deposit", r.status === 200 && r.data.goal.saved === 8500, r.data);

  // transactions list + filter
  r = await call("GET", "/api/transactions?type=expense", null, cookieA);
  ok("list expenses", r.status === 200 && r.data.transactions.length >= 2, r.data.transactions.length);
  r = await call("GET", "/api/transactions?search=grocer", null, cookieA);
  ok("search transactions", r.data.transactions.length >= 1, r.data);

  // insights
  r = await call("GET", "/api/insights", null, cookieA);
  ok("insights", r.status === 200 && Array.isArray(r.data.insights), r.data);

  // add member
  r = await call("POST", "/api/family/members", { name: "Sara", role: "child", allowance: 500 }, cookieA);
  ok("add member", r.status === 200 && r.data.member.name === "Sara", r.data);

  // categories add
  r = await call("POST", "/api/categories", { name: "Pets", type: "expense", color: "#000" }, cookieA);
  ok("add category", r.status === 200 && r.data.category.name === "Pets", r.data);

  // notifications + activity
  r = await call("GET", "/api/notifications", null, cookieA);
  ok("notifications exist", r.status === 200 && r.data.notifications.length >= 1, r.data.notifications.length);
  r = await call("GET", "/api/activity", null, cookieA);
  ok("activity exists", r.status === 200 && r.data.activities.length >= 1, r.data.activities.length);

  // export csv
  r = await call("GET", "/api/export/csv", null, cookieA);
  ok("export csv", r.status === 200, r.status);

  // register user B and join
  let r2 = await call("POST", "/api/auth/register", { name: "Mom", email: "mom@test.com", password: "pass123" });
  ok("register B", r2.status === 200, r2.data);
  const cookieB = r2.setCookie;
  r = await call("POST", "/api/family/join", { inviteCode: fam.inviteCode }, cookieB);
  ok("join family B", r.status === 200 && r.data.family.id === fam.id, r.data);
  // B should see A's transactions (same family)
  r = await call("GET", "/api/transactions", null, cookieB);
  ok("B sees family data", r.data.transactions.length >= 3, r.data.transactions.length);
  // B (member) cannot delete A's expense without permission? member can delete own only
  const someTx = r.data.transactions.find((t) => t.userId !== "nope");
  // logout
  r = await call("POST", "/api/auth/logout", {}, cookieA);
  ok("logout A", r.status === 200, r.data);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("TEST ERROR", e); process.exit(2); });
