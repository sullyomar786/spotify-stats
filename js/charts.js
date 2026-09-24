// charts.js
// Minimal, dependency-free SVG chart helpers. Kept simple deliberately —
// this is a personal stats site, not a charting library, so we only build
// exactly the chart types the pages need: a line/area chart over time,
// and a horizontal bar chart for rankings.
//
// Line charts support hover/tap tooltips: each data point gets an
// invisible, generously-sized hit target carrying its label/value as
// data attributes. Charts.attachTooltips() (call once after inserting
// chart HTML into the DOM) wires up a single shared tooltip element that
// follows pointer/touch events, so every chart on a page reuses the same
// tooltip rather than each needing its own listeners.

const Charts = (function () {
  let tooltipEl = null;
  let idCounter = 0;

  function ensureTooltipEl() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "chart-tooltip";
    tooltipEl.setAttribute("role", "status");
    tooltipEl.setAttribute("aria-live", "polite");
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function showTooltip(target, label, value) {
    const tip = ensureTooltipEl();
    tip.innerHTML = `<span class="chart-tooltip-label">${label}</span><span class="chart-tooltip-value">${value}</span>`;
    tip.classList.add("visible");

    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;
    let top = rect.top - tipRect.height - 10 + window.scrollY;

    // Keep on-screen horizontally
    const margin = 8;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }
    // If there's no room above (near top of viewport), show below instead
    if (rect.top - tipRect.height - 10 < 0) {
      top = rect.bottom + 10 + window.scrollY;
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove("visible");
  }

  // Call once after inserting chart HTML into the DOM (or after replacing
  // it) so hover/tap targets get their listeners. Safe to call repeatedly —
  // only wires up targets that don't already have a listener.
  function attachTooltips(container) {
    const root = container || document;
    const targets = root.querySelectorAll("[data-chart-tip]:not([data-tip-bound])");
    targets.forEach((el) => {
      el.setAttribute("data-tip-bound", "1");
      const label = el.getAttribute("data-chart-tip-label");
      const value = el.getAttribute("data-chart-tip-value");

      el.addEventListener("mouseenter", () => showTooltip(el, label, value));
      el.addEventListener("mouseleave", hideTooltip);
      el.addEventListener("focus", () => showTooltip(el, label, value));
      el.addEventListener("blur", hideTooltip);

      // Touch: tap to show, tap elsewhere to hide. Prevent the tap from
      // also firing a click-through on whatever's underneath.
      el.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          showTooltip(el, label, value);
        },
        { passive: false }
      );
    });

    // Hide on tapping/clicking anywhere outside a chart hit target (only
    // wire this up once, globally).
    if (!document.body.hasAttribute("data-chart-tip-outside-bound")) {
      document.body.setAttribute("data-chart-tip-outside-bound", "1");
      document.addEventListener("touchstart", (e) => {
        if (!e.target.closest("[data-chart-tip]")) hideTooltip();
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest("[data-chart-tip]")) hideTooltip();
      });
    }
  }

  function lineAreaChart({ values, labels, width = 900, height = 260, valueFormatter, tooltipLabel }) {
    const padding = { top: 20, right: 20, bottom: 34, left: 46 };
    const w = width - padding.left - padding.right;
    const h = height - padding.top - padding.bottom;
    const chartId = `chart-${idCounter++}`;

    const maxVal = Math.max(...values, 1);
    const stepX = values.length > 1 ? w / (values.length - 1) : 0;

    const points = values.map((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + h - (v / maxVal) * h;
      return [x, y];
    });

    const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const areaPath =
      linePath +
      ` L${points[points.length - 1][0].toFixed(1)},${(padding.top + h).toFixed(1)}` +
      ` L${points[0][0].toFixed(1)},${(padding.top + h).toFixed(1)} Z`;

    // Y-axis gridlines (4 bands)
    const gridLines = [];
    for (let i = 0; i <= 3; i++) {
      const y = padding.top + (h / 3) * i;
      const val = maxVal - (maxVal / 3) * i;
      gridLines.push(
        `<line class="chart-gridline" x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}" />` +
        `<text class="chart-axis-label" x="${padding.left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${valueFormatter ? valueFormatter(val) : Math.round(val)}</text>`
      );
    }

    // X-axis labels (show a subset if too many)
    const labelEvery = Math.ceil(labels.length / 8);
    const xLabels = labels
      .map((lab, i) => {
        if (i % labelEvery !== 0) return "";
        const x = padding.left + i * stepX;
        return `<text class="chart-axis-label" x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle">${lab}</text>`;
      })
      .join("");

    const dots = points
      .map((p) => `<circle class="chart-point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" />`)
      .join("");

    // Invisible, generously-sized hit targets (18px radius — much bigger
    // than the visible 2.5px dot) so hovering/tapping near a point is easy,
    // not pixel-precise. Each carries its label/value for the tooltip.
    const hitTargets = points
      .map((p, i) => {
        const displayVal = valueFormatter ? valueFormatter(values[i]) : Math.round(values[i]).toLocaleString();
        const label = tooltipLabel ? tooltipLabel(labels[i], values[i]) : labels[i];
        return `<circle class="chart-hit-target" data-chart-tip data-chart-tip-label="${escapeAttr(label)}" data-chart-tip-value="${escapeAttr(String(displayVal))}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="18" tabindex="0" />`;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart" data-chart-id="${chartId}">
        ${gridLines.join("")}
        <path class="chart-area" d="${areaPath}" />
        <path class="chart-line" d="${linePath}" />
        ${dots}
        ${xLabels}
        ${hitTargets}
      </svg>
    `;
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function horizontalBarChart({ items, width = 900, barHeight = 28, gap = 10, valueFormatter, highlightFirst = true }) {
    const padding = { left: 4, right: 60, top: 4, bottom: 4 };
    const maxVal = Math.max(...items.map((i) => i.value), 1);
    const rowHeight = barHeight + gap;
    const height = padding.top + padding.bottom + items.length * rowHeight;
    const usableWidth = width - padding.left - padding.right - 160; // leave room for labels

    const bars = items
      .map((item, i) => {
        const y = padding.top + i * rowHeight;
        const barW = Math.max((item.value / maxVal) * usableWidth, 2);
        const cls = highlightFirst && i === 0 ? "chart-bar highlight" : "chart-bar";
        return `
          <text class="chart-axis-label" x="0" y="${(y + barHeight / 2 + 4).toFixed(1)}" text-anchor="start" style="font-size:12px">${item.label}</text>
          <rect class="${cls}" x="160" y="${y}" width="${barW.toFixed(1)}" height="${barHeight}" rx="2" />
          <text class="chart-axis-label" x="${(160 + barW + 8).toFixed(1)}" y="${(y + barHeight / 2 + 4).toFixed(1)}" text-anchor="start">${valueFormatter ? valueFormatter(item.value) : item.value}</text>
        `;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">
        ${bars}
      </svg>
    `;
  }

  return { lineAreaChart, horizontalBarChart, attachTooltips };
})();
