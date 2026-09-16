// generate-manifest.js
// Writes/refreshes data/manifest.json, listing every month data file present.
// The front-end (index.html, hosted on GitHub Pages) reads this manifest to
// know which files to fetch, since it can't hit the GitHub API from the
// browser without running into rate limits or CSP restrictions.
//
// Run this once now (your data/ already has files but no manifest yet).
// backup.js and import-extended-history.js also call this automatically
// going forward, so you generally won't need to run it manually again.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error("No data/ directory found.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .sort();

  const manifestPath = path.join(DATA_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ files }, null, 2) + "\n");
  console.log(`manifest.json written: ${files.length} month files listed.`);
  console.log(files.join(", "));
}

main();