window.UICharts = (function () {
  const UI = window.UI;
  const h = UI.h;

  // Horizontal bars (great for category breakdown, comparisons)
  function hBars(items, opts) {
    opts = opts || {};
    const max = Math.max(1, ...items.map((i) => i.value));
    const wrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });
    items.forEach((it) => {
      const pct = Math.round((it.value / max) * 100);
      const row = h("div",
        h("div", { class: "flex between small", style: { marginBottom: "4px" } },
          h("span", { style: { fontWeight: "700" } }, it.label),
          h("span", { class: "muted qty" }, opts.format ? opts.format(it.value) : UI.fmtNum(it.value))
        ),
        h("div", { class: "progress" },
          h("span", { style: { width: pct + "%", background: it.color || "var(--brand)" } })
        )
      );
      wrap.appendChild(row);
    });
    return wrap;
  }

  // Vertical bars (for monthly trend)
  function vBars(items, opts) {
    opts = opts || {};
    const max = Math.max(1, ...items.map((i) => i.value));
    const wrap = h("div", { style: { display: "flex", alignItems: "flex-end", gap: "8px", height: (opts.height || 170) + "px" } });
    items.forEach((it) => {
      const pct = Math.max(2, Math.round((it.value / max) * 100));
      const col = h("div", { style: { flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "0" } },
        h("div", { class: "small muted qty", style: { fontSize: "10px" } }, opts.format ? opts.format(it.value) : UI.fmtNum(it.value)),
        h("div", { style: { width: "100%", height: pct + "%", background: it.color || "var(--brand)", borderRadius: "7px 7px 4px 4px", minHeight: "3px" } }),
        h("div", { class: "small muted", style: { fontSize: "10px" } }, it.label)
      );
      wrap.appendChild(col);
    });
    return wrap;
  }

  // Donut chart
  function donut(segments, opts) {
    opts = opts || {};
    const size = opts.size || 150;
    const r = (size / 2) - 12;
    const cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    const bg = document.createElementNS(ns, "circle");
    bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
    bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "var(--surface-2)"); bg.setAttribute("stroke-width", "13");
    svg.appendChild(bg);
    segments.forEach((seg) => {
      if (seg.value <= 0) return;
      const len = (seg.value / total) * C;
      const c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
      c.setAttribute("fill", "none"); c.setAttribute("stroke", seg.color || "var(--brand)");
      c.setAttribute("stroke-width", "13"); c.setAttribute("stroke-linecap", "butt");
      c.setAttribute("stroke-dasharray", len + " " + (C - len));
      c.setAttribute("stroke-dashoffset", -acc);
      c.setAttribute("transform", "rotate(-90 " + cx + " " + cy + ")");
      svg.appendChild(c);
      acc += len;
    });
    const txt = document.createElementNS(ns, "text");
    txt.setAttribute("x", cx); txt.setAttribute("y", cy - 2); txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("class", "ring-text"); txt.setAttribute("font-size", "15"); txt.textContent = opts.center || UI.fmtNum(Math.round(total));
    svg.appendChild(txt);
    const sub = document.createElementNS(ns, "text");
    sub.setAttribute("x", cx); sub.setAttribute("y", cy + 14); sub.setAttribute("text-anchor", "middle");
    sub.setAttribute("fill", "var(--text-2)"); sub.setAttribute("font-size", "10"); sub.textContent = opts.sub || "";
    svg.appendChild(sub);
    return svg;
  }

  function legend(segments) {
    const wrap = h("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: "12px" } });
    segments.forEach((s) => {
      wrap.appendChild(h("div", { class: "flex", style: { gap: "6px", fontSize: "12.5px" } },
        h("span", { style: { width: "11px", height: "11px", borderRadius: "3px", background: s.color, display: "inline-block" } }),
        h("span", { class: "muted" }, s.label)
      ));
    });
    return wrap;
  }

  return { hBars, vBars, donut, legend };
})();
