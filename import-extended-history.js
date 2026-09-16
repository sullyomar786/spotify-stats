// import-extended-history.js
// One-off script: reads Spotify Extended Streaming History export file(s)
// and merges them into data/YYYY-MM.json in the unified schema, alongside
// whatever live-poll data is already there.
//
// Usage:
//   node import-extended-history.js path/to/export1.json path/to/export2.json ...
//
// Spotify's export is sometimes split across multiple files
// (e.g. Streaming_History_Audio_2023_0.json, ..._2024_1.json, etc) —
// pass as many as you have, they'll all be merged in one run.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

// Converts one raw Extended Streaming History entry into the unified schema.
function toUnifiedShape(raw) {
  return {
    played_at: new Date(raw.ts).getTime(),
    track: raw.master_metadata_track_name,
    artist: raw.master_metadata_album_artist_name,
    album: raw.master_metadata_album_album_name,
    duration_ms: raw.ms_played, // Extended History has no separate "full track length" field
    ms_played: raw.ms_played,
    source: "extended_history",
    platform: raw.platform,
    country: raw.conn_country,
    spotify_track_uri: raw.spotify_track_uri,
    reason_start: raw.reason_start,
    reason_end: raw.reason_end,
    shuffle: raw.shuffle,
    skipped: raw.skipped,
    offline: raw.offline,
    incognito_mode: raw.incognito_mode,
  };
}

function groupByMonth(entries) {
  const groups = {};
  for (const entry of entries) {
    if (!entry.played_at || Number.isNaN(entry.played_at)) {
      console.warn("Skipping entry with missing/invalid ts:", entry.track);
      continue;
    }
    // Skip entries with no track name (e.g. podcast-only entries, if any)
    if (!entry.track) continue;

    const date = new Date(entry.played_at);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

function entryId(entry) {
  return `${entry.played_at}|${entry.track}|${entry.artist}`;
}

function loadExisting(monthFile) {
  if (!fs.existsSync(monthFile)) return [];
  try {
    const raw = fs.readFileSync(monthFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Could not parse existing file ${monthFile}, treating as empty:`, err.message);
    return [];
  }
}

function mergeAndDedupe(existing, incoming) {
  const seen = new Map();
  for (const entry of existing) seen.set(entryId(entry), entry);
  let addedCount = 0;
  for (const entry of incoming) {
    const id = entryId(entry);
    // If this exact play already exists (e.g. from live-poll), prefer the
    // Extended History version since it has richer data — but only if the
    // existing one is the leaner live-poll entry.
    if (seen.has(id)) {
      const existingEntry = seen.get(id);
      if (existingEntry.source === "live_poll" && entry.source === "extended_history") {
        seen.set(id, entry); // upgrade to richer record
      }
      continue;
    }
    seen.set(id, entry);
    addedCount++;
  }
  const merged = Array.from(seen.values());
  merged.sort((a, b) => a.played_at - b.played_at);
  return { merged, addedCount };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node import-extended-history.js <export1.json> [export2.json ...]");
    process.exit(1);
  }

  let allRawEntries = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(raw)) {
      console.error(`Expected an array in ${file}, got something else. Skipping.`);
      continue;
    }
    console.log(`Loaded ${raw.length} entries from ${file}`);
    allRawEntries = allRawEntries.concat(raw);
  }

  const entries = allRawEntries.map(toUnifiedShape);
  console.log(`Converted ${entries.length} entries to unified schema.`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const grouped = groupByMonth(entries);
  let totalAdded = 0;

  for (const [monthKey, monthEntries] of Object.entries(grouped)) {
    const monthFile = path.join(DATA_DIR, `${monthKey}.json`);
    const existing = loadExisting(monthFile);
    const { merged, addedCount } = mergeAndDedupe(existing, monthEntries);

    fs.writeFileSync(monthFile, JSON.stringify(merged, null, 2) + "\n");
    console.log(`${monthKey}.json: +${addedCount} new (${merged.length} total)`);
    totalAdded += addedCount;
  }

  console.log(`\nDone. ${totalAdded} new entries added across all months.`);
  console.log("Note: entries already present from live-poll data were upgraded to the richer Extended History version where a match was found.");
}

main();