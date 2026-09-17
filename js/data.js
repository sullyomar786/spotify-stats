// data.js
// Shared data loading + core utilities, used by every page.
// Data lives in ../data/ relative to each page (pages sit in /pages/,
// data sits in /data/ at repo root — adjust DATA_BASE per page if needed).

const DataCore = (function () {
  async function loadAllEntries(dataBase) {
    const manifestRes = await fetch(dataBase + "manifest.json");
    if (!manifestRes.ok) throw new Error("Could not load manifest.json (status " + manifestRes.status + ")");
    const manifest = await manifestRes.json();
    const files = manifest.files.slice().sort();

    const chunks = await Promise.all(
      files.map(async (f) => {
        const res = await fetch(dataBase + f);
        if (!res.ok) throw new Error("Failed to fetch " + f);
        return res.json();
      })
    );
    return chunks.flat();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function fmtNum(n) {
    return Math.round(n).toLocaleString();
  }

  function fmtHours(ms) {
    return (ms / 1000 / 60 / 60).toFixed(1);
  }

  function monthKey(ts) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function artistSlug(name) {
    return encodeURIComponent(name);
  }

  // Groups entries by month key ("YYYY-MM"), returns a Map preserving chronological order.
  function groupByMonth(entries) {
    const map = new Map();
    for (const e of entries) {
      const key = monthKey(e.played_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return new Map([...map.entries()].sort());
  }

  function playedMs(e) {
    return e.ms_played ?? e.duration_ms ?? 0;
  }

  function renderError(containerId, err) {
    document.getElementById(containerId).innerHTML = `
      <div class="status">
        <span class="display">Couldn't reach the record.</span>
        ${escapeHtml(err.message)}
      </div>
    `;
  }

  function setActiveNav() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("nav.top .links a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href === path || (path === "" && href === "index.html")) {
        a.classList.add("active");
      }
    });
  }

  return {
    loadAllEntries,
    escapeHtml,
    fmtNum,
    fmtHours,
    monthKey,
    dayKey,
    artistSlug,
    groupByMonth,
    playedMs,
    renderError,
    setActiveNav,
  };
})();
