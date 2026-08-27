window.Store = (function () {
  const state = {
    user: null,
    context: null,
    family: null, // detailed (members, categories)
    currency: "EGP",
    loaded: false,
    role: null,
  };

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ("HTTP " + res.status));
      err.data = data; err.status = res.status;
      throw err;
    }
    return data;
  }

  async function me() {
    const data = await api("GET", "/api/auth/me");
    state.user = data.user;
    state.context = data.context;
    state.currency = (data.context && data.context.currency) || "EGP";
    state.role = data.context && data.context.member ? data.context.member.role : null;
    if (data.context && data.context.family) await refreshFamily();
    state.loaded = true;
    return data;
  }

  async function refreshFamily() {
    const data = await api("GET", "/api/family");
    if (data.family) {
      state.family = data.family;
      state.currency = data.family.currency;
      state.context = data.context;
      state.role = data.context && data.context.member ? data.context.member.role : state.role;
    } else {
      state.family = null;
    }
    return data;
  }

  // permissions
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

  return {
    state, api, me, refreshFamily, can,
    login: (email, password) => api("POST", "/api/auth/login", { email, password }),
    register: (name, email, password) => api("POST", "/api/auth/register", { name, email, password }),
    logout: () => api("POST", "/api/auth/logout"),
    createFamily: (name, currency) => api("POST", "/api/family", { name, currency }),
    joinFamily: (code) => api("POST", "/api/family/join", { inviteCode: code }),
    updateFamily: (body) => api("PATCH", "/api/family", body),
    addMember: (body) => api("POST", "/api/family/members", body),
    updateMember: (id, body) => api("PATCH", "/api/family/members/" + id, body),
    deleteMember: (id) => api("DELETE", "/api/family/members/" + id),
    leaveFamily: () => api("POST", "/api/family/leave"),
    getCategories: () => api("GET", "/api/categories"),
    addCategory: (body) => api("POST", "/api/categories", body),
    deleteCategory: (id) => api("DELETE", "/api/categories/" + id),
    getBudget: () => api("GET", "/api/budget"),
    setBudget: (body) => api("PATCH", "/api/budget", body),
    listTransactions: (params) => {
      const q = new URLSearchParams();
      Object.keys(params || {}).forEach((k) => { if (params[k] !== undefined && params[k] !== "" && params[k] !== null) q.set(k, params[k]); });
      return api("GET", "/api/transactions?" + q.toString());
    },
    addTransaction: (body) => api("POST", "/api/transactions", body),
    updateTransaction: (id, body) => api("PATCH", "/api/transactions/" + id, body),
    deleteTransaction: (id) => api("DELETE", "/api/transactions/" + id),
    listBills: () => api("GET", "/api/bills"),
    addBill: (body) => api("POST", "/api/bills", body),
    updateBill: (id, body) => api("PATCH", "/api/bills/" + id, body),
    deleteBill: (id) => api("DELETE", "/api/bills/" + id),
    listDebts: () => api("GET", "/api/debts"),
    addDebt: (body) => api("POST", "/api/debts", body),
    updateDebt: (id, body) => api("PATCH", "/api/debts/" + id, body),
    deleteDebt: (id) => api("DELETE", "/api/debts/" + id),
    addDebtPayment: (id, body) => api("POST", "/api/debts/" + id + "/payments", body),
    listGoals: () => api("GET", "/api/goals"),
    addGoal: (body) => api("POST", "/api/goals", body),
    updateGoal: (id, body) => api("PATCH", "/api/goals/" + id, body),
    deleteGoal: (id) => api("DELETE", "/api/goals/" + id),
    depositGoal: (id, body) => api("POST", "/api/goals/" + id + "/deposit", body),
    listNotifications: () => api("GET", "/api/notifications"),
    markNotification: (id) => api("PATCH", "/api/notifications/" + id, {}),
    markAll: () => api("POST", "/api/notifications/read-all"),
    listActivity: () => api("GET", "/api/activity"),
    getInsights: () => api("GET", "/api/insights"),
    exportCsv: () => api("GET", "/api/export/csv"),
  };
})();
