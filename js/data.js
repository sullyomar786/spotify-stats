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

  // Returns just the primary artist for an entry, for grouping/counting
  // purposes. The two data sources represent multi-artist tracks
  // differently: Spotify's Extended History export stores whatever Spotify
  // considers the primary artist verbatim — which is sometimes itself a
  // name containing a comma (e.g. "Tyler, The Creator") — while the
  // live-poll API returns every credited artist joined into one string
  // with ", " (e.g. "The Weeknd, JENNIE, Lily-Rose Depp"), primary artist
  // always first. A plain "split on first comma" would wrongly break real
  // comma-containing names, so this instead builds a reference set of
  // known real artist names (every artist string ever seen from an
  // extended_history entry, since that source never joins multiple
  // artists together) and only splits a live_poll entry's artist string
  // if the full string ISN'T already a known real name.
  //
  // knownArtistNames: a Set built once per dataset via
  // buildKnownArtistNames(entries) and passed in on every call.
  function primaryArtist(e, knownArtistNames) {
    if (!e.artist) return e.artist;
    if (e.source !== "live_poll") return e.artist; // extended_history is always the real name already
    if (knownArtistNames && knownArtistNames.has(e.artist)) return e.artist; // real name that happens to contain a comma
    const commaIdx = e.artist.indexOf(",");
    return commaIdx === -1 ? e.artist : e.artist.slice(0, commaIdx).trim();
  }

  // Builds the reference set primaryArtist() needs: every distinct artist
  // string that has ever appeared on an extended_history entry. Call once
  // per full dataset (not per entry) and pass the result to primaryArtist.
  function buildKnownArtistNames(entries) {
    const set = new Set();
    for (const e of entries) {
      if (e.source === "extended_history" && e.artist) set.add(e.artist);
    }
    return set;
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
    primaryArtist,
    buildKnownArtistNames,
    renderError,
    setActiveNav,
  };
})();
