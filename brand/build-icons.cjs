// Generates Kairo icon variants from the mark geometry.
//   node brand/build-icons.cjs <outDir>
// Writes SVGs: mark-dev.svg, mark-staging.svg, tray-{tracking,idle,paused}.svg.
// Render them to PNG with any SVG rasterizer (the repo used @resvg/resvg-js).
const fs = require("fs");
const path = require("path");
const out = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(out, { recursive: true });

const RING = "M47.01 24.02A17 17 0 1 1 28.47 15.37";
const HOUR = "M32 32 38.8 35.17";
const MINUTE = "M32 32 35.80 23.84";

// Clock glyph in one or two colours (ring/hour vs. hand/dots).
const glyph = (base, hi) => `
  <path d="${RING}" fill="none" stroke="${base}" stroke-width="5" stroke-linecap="round"/>
  <path d="${HOUR}" fill="none" stroke="${base}" stroke-width="4" stroke-linecap="round"/>
  <path d="${MINUTE}" fill="none" stroke="${hi}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="2.6" fill="${hi}"/>
  <circle cx="39.18" cy="16.59" r="4.6" fill="${hi}"/>`;

const tile = `
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#18213D"/><stop offset="1" stop-color="#0B1020"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#t)"/>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}\n</svg>\n`;

// Environment builds: the normal mark with a diagonal corner ribbon.
const ribbon = (label, color) => `
  <clipPath id="c"><rect width="64" height="64" rx="16"/></clipPath>
  <g clip-path="url(#c)"><g transform="rotate(-45 50 50)">
    <rect x="22" y="47" width="56" height="10" fill="${color}"/>
    <text x="50" y="54.6" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="7.5" font-weight="700" fill="#0B1020" letter-spacing="0.6">${label}</text>
  </g></g>`;

const files = {
  "mark-dev.svg": svg(tile + glyph("#E8ECF5", "#C6F432") + ribbon("DEV", "#FFB547")),
  "mark-staging.svg": svg(tile + glyph("#E8ECF5", "#C6F432") + ribbon("STG", "#22D3EE")),
  // Tray: status-coloured tile, contrasting glyph (lime=tracking, amber=idle, red=paused).
  "tray-tracking.svg": svg(`<rect x="2" y="2" width="60" height="60" rx="15" fill="#C6F432"/>` + glyph("#0B1020", "#0B1020")),
  "tray-idle.svg": svg(`<rect x="2" y="2" width="60" height="60" rx="15" fill="#FBBF24"/>` + glyph("#0B1020", "#0B1020")),
  "tray-paused.svg": svg(`<rect x="2" y="2" width="60" height="60" rx="15" fill="#EF4444"/>` + glyph("#FFFFFF", "#FFFFFF")),
};
for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(out, name), body);
console.log("wrote", Object.keys(files).join(", "), "to", out);
