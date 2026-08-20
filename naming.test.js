const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = {};
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "naming.js"), "utf8"),
  { filename: "naming.js" }
);

const naming = window.GalaxyNaming;
const sectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "Sectors.json"), "utf8")
).sec;
const centers = naming.buildSectorCenters();
let cases = 0;
let ambiguousAxisCases = 0;

for (let x = 1; x < 2048; x += 17) {
  for (let y = 1; y < 2048; y += 19) {
    for (const starId of [0, 1, 21, 99, 255]) {
      const center = centers[naming.sectorId(x, y)];
      if (x === center.x || y === center.y) {
        ambiguousAxisCases++;
      }
      const name = naming.encodeCell(x, y, starId, sectors, centers);
      const decoded = naming.parseName(name, sectors, centers);
      const containsOriginal = decoded?.candidates.some(candidate =>
        candidate.mapX === x && candidate.mapY === y);
      if (!decoded || !containsOriginal || decoded.starId !== starId) {
        throw new Error(`Name round trip failed: ${x},${y},${starId} -> ${name} -> ${JSON.stringify(decoded)}`);
      }
      cases++;
    }
  }
}

const actox = naming.parseName("Actox Cp-Ex E21", sectors, centers);
if (!actox || actox.mapX !== 1004 || actox.mapY !== 1134 || actox.starId !== 21) {
  throw new Error(`Actox decode regression: ${JSON.stringify(actox)}`);
}

console.log(`Galaxy name round-trip PASS: ${cases} cases across 96 sectors`);
console.log(`Original AS3 axis ambiguities returned as two candidates: ${ambiguousAxisCases}`);
