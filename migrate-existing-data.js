// migrate-existing-data.js
// One-off script: converts data/*.json files already in the old flat shape
// (track/artist/played_at/duration_ms only) into the new unified schema.
// Run this ONCE, before running backup.js or import-extended-history.js
// again, so every file in data/ is in the same shape.
//
// Usage:
//   node migrate-existing-data.js

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

function isOldShape(entry) {
  // Old shape has exactly these 4 fields and no "source" field.
  return entry.source === undefined;
}

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

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log("No data/ directory found — nothing to migrate.");
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No .json files found in data/ — nothing to migrate.");
    return;
  }

  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(raw)) {
      console.warn(`Skipping ${file}: not an array`);
      continue;
    }

    let migratedCount = 0;
    let skippedCount = 0;

    const updated = raw.map((entry) => {
      if (isOldShape(entry)) {
        migratedCount++;
        return toUnifiedShape(entry);
      }
      skippedCount++;
      return entry; // already in unified shape, leave as-is
    });

    if (migratedCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + "\n");
      console.log(`${file}: migrated ${migratedCount} entries (${skippedCount} already unified)`);
    } else {
      console.log(`${file}: nothing to migrate (${skippedCount} already unified)`);
    }

    totalMigrated += migratedCount;
    totalSkipped += skippedCount;
  }

  console.log(`\nDone. ${totalMigrated} entries migrated, ${totalSkipped} were already in unified shape.`);
}

main();