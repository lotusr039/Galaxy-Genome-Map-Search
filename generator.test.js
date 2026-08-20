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
generator.setVerifiedSystems(JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "VerifiedProceduralSystems.json"), "utf8")
));

const starConfigs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "StarTypes.json"), "utf8")
).starTypes;

// Actox Cp-Ex E21 decodes to cell (1004, 1134), generated star id 21.
// The RGB and density values are from the original 2048x2048 map assets.
const density = generator.distributionDensity(252, 1004, 1134);
const system = generator.generateSystem({
  secX: 1004,
  secY: 1134,
  starId: 21,
  rgb: { r: 255, g: 71, b: 0 },
  starConfigs,
  density
});

if (!system) throw new Error("Actox Cp-Ex E21 was rejected as an overlapping star");

const planets = system.bodies.filter(body => body.kind === "planet");
const ordinary = planets.filter(body => body.type !== "Asteroids");
const asteroidBelts = planets.filter(body => body.type === "Asteroids");

const expected = {
  starType: "F-White",
  ordinaryPlanets: 9,
  asteroidBelts: 1
};
const actual = {
  starType: system.starType,
  ordinaryPlanets: ordinary.length,
  asteroidBelts: asteroidBelts.length,
  typeCounts: Object.fromEntries(
    [...new Set(planets.map(body => body.type))]
      .sort()
      .map(type => [type, planets.filter(body => body.type === type).length])
  )
};
expected.typeCounts = {
  Asteroids: 1,
  GasGiantClassII: 1,
  GasGiantwithAmmoniaLife: 1,
  HighMetalPlanet: 2,
  IcePlanet: 4,
  RockPlanet: 1
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    `Actox Cp-Ex E21 regression failed\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`
  );
}

const orderedTypes = planets.map(body => body.type);
const expectedOrder = [
  "RockPlanet", "HighMetalPlanet", "HighMetalPlanet", "GasGiantClassII",
  "IcePlanet", "IcePlanet", "IcePlanet", "IcePlanet", "Asteroids",
  "GasGiantwithAmmoniaLife"
];
const star = system.bodies.find(body => body.kind === "star");
if (!system.verified || star.temperature !== 7050 || JSON.stringify(orderedTypes) !== JSON.stringify(expectedOrder)) {
  throw new Error(`Actox verified profile mismatch: ${star.temperature} K, ${orderedTypes.join(",")}`);
}
if (star.subtype !== "F2" || planets.some(body => body.temperature == null || body.orbit == null)) {
  throw new Error("Actox must use generated star/planet details rather than verified-data placeholders");
}

generator.setVerifiedSystems({});
const unverifiedSystem = generator.generateSystem({
  secX: 1004,
  secY: 1134,
  starId: 21,
  rgb: { r: 255, g: 71, b: 0 },
  starConfigs,
  density
});
const unverifiedStar = unverifiedSystem.bodies.find(body => body.kind === "star");
const unverifiedTypes = unverifiedSystem.bodies
  .filter(body => body.kind === "planet")
  .map(body => body.type);
if (unverifiedSystem.verified || unverifiedStar.temperature !== 7050 ||
    JSON.stringify(unverifiedTypes) !== JSON.stringify(expectedOrder)) {
  throw new Error("Actox procedural result must not depend on VerifiedProceduralSystems.json");
}

console.log("Actox Cp-Ex E21 PASS", actual);
