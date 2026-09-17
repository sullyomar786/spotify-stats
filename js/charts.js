// charts.js
// Minimal, dependency-free SVG chart helpers. Kept simple deliberately —
// this is a personal stats site, not a charting library, so we only build
// exactly the chart types the pages need: a line/area chart over time,
// and a horizontal bar chart for rankings.

const Charts = (function () {
  function lineAreaChart({ values, labels, width = 900, height = 260, valueFormatter }) {
    const padding = { top: 20, right: 20, bottom: 34, left: 46 };
    const w = width - padding.left - padding.right;
    const h = height - padding.top - padding.bottom;

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

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
        ${gridLines.join("")}
        <path class="chart-area" d="${areaPath}" />
        <path class="chart-line" d="${linePath}" />
        ${dots}
        ${xLabels}
      </svg>
    `;
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

  return { lineAreaChart, horizontalBarChart };
})();
