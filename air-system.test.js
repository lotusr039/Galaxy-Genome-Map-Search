const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = {};
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "generator.js"), "utf8"),
  { filename: "generator.js" }
);

const generator = window.GalaxyGenerator;
generator.setPixelConversionTable(
  fs.readFileSync(path.join(__dirname, "data", "PixelConversion.bin"))
);
const starConfigs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "StarTypes.json"), "utf8")
).starTypes;
const goldenPath = path.join(__dirname, "..", "air-noise-test", "SystemGoldenBatch.jsonl");
const cases = fs.readFileSync(goldenPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);

function normalize(body) {
  return {
    kind: body.kind,
    type: body.type,
    subtype: body.kind === "star" ? body.subtype : undefined,
    temperature: body.temperature,
    orbit: body.orbit,
    orbitTo: body.orbitTo,
    group: body.group
  };
}

let comparedBodies = 0;
for (const golden of cases) {
  const actual = generator.generateSeededSystem(golden.seed, golden.type, starConfigs)
    .map(normalize);
  const expected = golden.bodies.map(normalize);
  comparedBodies += expected.length;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `AIR system mismatch: seed=${golden.seed}, type=${golden.type}\n` +
      `Expected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`
    );
  }
}

console.log(`AIR system differential PASS: ${cases.length} systems, ${comparedBodies} bodies`);
