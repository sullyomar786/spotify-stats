// backup.js
// Fetches the full "play-history" array from Upstash Redis (REST API),
// splits entries by month (based on played_at), and merges them into
// data/YYYY-MM.json files, deduplicating against what's already saved.
//
// Env vars required (set as GitHub Actions secrets):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const REDIS_KEY = "play-history";

async function fetchPlayHistory() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars"
    );
  }

  // Upstash REST API: GET /get/<key>
  const res = await fetch(`${url}/get/${REDIS_KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Upstash request failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();

  if (!body.result) {
    console.log("No data found under key:", REDIS_KEY);
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(body.result);
  } catch (err) {
    throw new Error(`Failed to parse play-history JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("play-history value is not an array");
  }

  return parsed;
}

// Groups entries by "YYYY-MM" based on their played_at timestamp (ms).
function groupByMonth(entries) {
  const groups = {};
  for (const entry of entries) {
    if (typeof entry.played_at !== "number") {
      console.warn("Skipping entry with missing/invalid played_at:", entry);
      continue;
    }
    const date = new Date(entry.played_at);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

// Converts a raw live-poll entry (Upstash shape) into the unified schema.
function toUnifiedShape(raw) {
  return {
    played_at: raw.played_at,
    track: raw.track,
    artist: raw.artist,
    album: null,
    duration_ms: raw.duration_ms,
    ms_played: null,
    source: "live_poll",
    platform: null,
    country: null,
    spotify_track_uri: null,
    reason_start: null,
    reason_end: null,
    shuffle: null,
    skipped: null,
    offline: null,
    incognito_mode: null,
  };
}

// A stable identity for dedup: same track + same played_at = same play.
// Works across sources since both use the same played_at/track/artist fields.
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
    if (!seen.has(id)) {
      seen.set(id, entry);
      addedCount++;
    }
  }
  const merged = Array.from(seen.values());
  // Keep entries sorted by played_at for readability/diffs.
  merged.sort((a, b) => a.played_at - b.played_at);
  return { merged, addedCount };
}

async function main() {
  console.log("Fetching play-history from Upstash...");
  const rawEntries = await fetchPlayHistory();
  console.log(`Fetched ${rawEntries.length} total entries from Upstash.`);
  const entries = rawEntries.map(toUnifiedShape);

  if (entries.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const grouped = groupByMonth(entries);
  let totalAdded = 0;

  for (const [monthKey, monthEntries] of Object.entries(grouped)) {
    const monthFile = path.join(DATA_DIR, `${monthKey}.json`);
    const existing = loadExisting(monthFile);
    const { merged, addedCount } = mergeAndDedupe(existing, monthEntries);

    if (addedCount > 0) {
      fs.writeFileSync(monthFile, JSON.stringify(merged, null, 2) + "\n");
      console.log(`${monthKey}.json: +${addedCount} new (${merged.length} total)`);
      totalAdded += addedCount;
    } else {
      console.log(`${monthKey}.json: no new entries (${merged.length} total)`);
    }
  }

  console.log(`Done. ${totalAdded} new entries added across all months.`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});