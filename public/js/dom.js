window.UI = (function () {
  const I = window.I18N;
  function t(k) { return I.t(k); }

  // ---------- icons ----------
  const P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h.01"/><path d="M3 9h14a2 2 0 0 1 2 2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    drop: '<path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10z"/>',
    wifi: '<path d="M5 12a10 10 0 0 1 14 0"/><path d="M8 15a5 5 0 0 1 8 0"/><path d="M11 18a1 1 0 0 1 2 0"/>',
    car: '<path d="M5 16h14l-1-5-2-4H8L6 11l-1 5z"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/>',
    heart: '<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
    bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    game: '<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M7 12h2M8 11v2M15 11v.01M18 13v.01"/>',
    tag: '<path d="M3 12l8-8 9 9-8 8z"/><circle cx="14" cy="9" r="1.4"/>',
    utensils: '<path d="M4 3v8a2 2 0 0 0 4 0V3M6 11v10"/><path d="M16 3c-2 0-3 3-3 6s1 4 3 4v8"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2 12h12l2-8H6"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    gift: '<rect x="3" y="8" width="18" height="5"/><path d="M5 13v8h14v-8"/><path d="M12 8v13"/><path d="M12 8C9 8 8 4 12 4s3 4 0 4z"/>',
    present: '<rect x="3" y="8" width="18" height="5"/><path d="M5 13v8h14v-8"/><path d="M12 8v13"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M19 5l-1 1M6 18l-1 1"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    "arrow-left": '<path d="M15 5l-7 7 7 7"/>',
    "arrow-right": '<path d="M9 5l7 7-7 7"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    warning: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    family: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 3-5 5-5s5 2 5 5M13 20c0-3 3-5 5-5s3 2 3 5"/>',
    child: '<circle cx="12" cy="8" r="4"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>',
    parent: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a5 5 0 0 1 10 0v2"/><path d="M15 21v-2a5 5 0 0 1 4 0v2"/>',
    owner: '<path d="M3 12l4 4 14-14"/><path d="M3 20h18"/>',
    logout: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h11"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    sparkles: '<path d="M12 3l1.5 4L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  };
  function icon(name, size) {
    size = size || 20;
    const inner = P[name] || P.tag;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }

  // ---------- element helpers ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k === "style" && typeof attrs[k] === "object") Object.assign(el.style, attrs[k]);
        else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
      }
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  // ---------- formatting ----------
  function fmt(amount, currency) {
    currency = currency || window.Store.state.currency || "EGP";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0); }
    catch (e) { return currency + " " + (amount || 0).toFixed(2); }
  }
  function fmtNum(n) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n || 0); }
  function locale() { return I.getLocale() === "ar" ? "ar" : "en"; }
  function date(d) {
    const dt = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat(locale(), { year: "numeric", month: "short", day: "numeric" }).format(dt);
  }
  function dateTime(d) {
    const dt = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(dt);
  }
  function toInputDate(d) {
    const dt = typeof d === "string" ? new Date(d) : (d || new Date());
    const off = dt.getTimezoneOffset();
    return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 10);
  }
  function avatar(name, image, cls) {
    cls = cls || "avatar";
    if (image) return '<div class="' + cls + '"><img src="' + image + '" alt=""></div>';
    const ini = (name || "?").trim().charAt(0).toUpperCase();
    return '<div class="' + cls + '">' + ini + "</div>";
  }

  // ---------- toast ----------
  function toast(msg, type) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = h("div", { class: "toast" + (type ? " " + type : "") }, msg);
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 2600);
  }

  // ---------- modal ----------
  function modal(opts) {
    const root = document.getElementById("modal-root");
    function close() {
      document.removeEventListener("keydown", onKey);
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    const bodyNode = typeof opts.body === "string" ? h("div", { html: opts.body }) : (opts.body || h("div"));
    const footerNode = opts.footer ? (typeof opts.footer === "string" ? h("div", { html: opts.footer }) : opts.footer) : null;
    const titleNode = h("div", { class: "spacer" });
    const head = h("div", { class: "modal-head" },
      h("h3", { style: { margin: "0" } }, opts.title || ""),
      titleNode,
      h("button", { class: "icon-btn", onclick: close, html: icon("close", 20) })
    );
    const panel = h("div", { class: "modal" }, head, bodyNode, footerNode);
    const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) close(); } }, panel);
    document.addEventListener("keydown", onKey);
    root.appendChild(backdrop);
    return { close, el: panel, body: bodyNode, footer: footerNode };
  }

  function confirm(message) {
    return new Promise((resolve) => {
      const m = modal({
        title: t("common.confirm"),
        body: h("p", { class: "muted", style: { marginTop: "0" } }, message),
        footer: h("div", { class: "flex", style: { gap: "10px" } },
          h("button", { class: "btn ghost", onclick: () => { m.close(); resolve(false); } }, t("common.no")),
          h("button", { class: "btn danger", onclick: () => { m.close(); resolve(true); } }, t("common.yes"))
        ),
      });
    });
  }

  function spinner() { return h("div", { class: "center muted", style: { padding: "30px" } }, t("common.loading")); }

  function emptyState(emoji, title, hint, actionBtn) {
    const node = h("div", { class: "empty" },
      h("div", { class: "emoji" }, emoji),
      h("div", { class: "t" }, title),
      hint ? h("div", { class: "small" }, hint) : null,
      actionBtn || null
    );
    return node;
  }

  return { icon, h, clear, fmt, fmtNum, date, dateTime, toInputDate, avatar, toast, modal, confirm, spinner, emptyState, locale };
})();
