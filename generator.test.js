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
const actoxResources = asteroidBelts[0].resources.map(resource => [resource.name, Math.floor(resource.chance)]);
const expectedResources = [["Painite",13],["LithiumHydroxide",67],["Diamonds",19]];
if (JSON.stringify(actoxResources) !== JSON.stringify(expectedResources)) {
  throw new Error(`Actox asteroid resources mismatch: ${JSON.stringify(actoxResources)}`);
}
const actoxSurfaceResources=ordinary.map(body=>generator.surfaceMaterials(body.type,body.seed).map(material=>material.name));
const expectedSurfaceResources=[
  ["Sulphur","Manganese","Vanadium"],["Nickel","Vanadium","Sulphur"],["Sulphur","Iron","Tellurium"],
  [],["Iron","Sulphur","Chromium"],["Iron","Phosphorus","Cadmium"],
  ["Iron","Sulphur","Nickel"],["Iron","Selenium","Polonium"],[]
];
if(JSON.stringify(actoxSurfaceResources)!==JSON.stringify(expectedSurfaceResources)){
  throw new Error(`Actox surface materials mismatch: ${JSON.stringify(actoxSurfaceResources)}`);
}
for(const body of ordinary){
  const materials=generator.surfaceMaterials(body.type,body.seed);
  if(materials.length&&Math.abs(materials.reduce((sum,material)=>sum+material.chance,0)-100)>1e-9)throw new Error("Surface material chances must total 100%");
}
if(JSON.stringify(generator.surfaceMaterials("MetalRichPlanet",1).map(material=>material.name))!==JSON.stringify(["Carbon","Iron","Vanadium"]))throw new Error("Metal-rich planets must use the fixed AIR surface material set");

// Actox Cc-Cl D95: game coordinates approximately (-1462, 11637).
const d95Density=generator.distributionDensity(155,991,1324);
const d95=generator.generateSystem({secX:991,secY:1324,starId:95,rgb:{r:181,g:83,b:4},starConfigs,density:d95Density});
if(!d95)throw new Error("Actox Cc-Cl D95 was not generated");
const d95Planets=d95.bodies.filter(body=>body.kind==="planet");
if(d95.starType!=="G-WhiteYellow"||JSON.stringify(d95Planets.map(body=>body.type))!==JSON.stringify(["HighMetalPlanet","HighMetalPlanet","Asteroids"])){
  throw new Error(`Actox Cc-Cl D95 body mismatch: ${d95.starType}, ${d95Planets.map(body=>body.type).join(",")}`);
}
const displayedSurfaceProfile=body=>generator.surfaceMaterials(body.type,body.seed).map(material=>[material.name,Math.floor(material.chance*10)/10]);
const d95Profiles=d95Planets.slice(0,2).map(displayedSurfaceProfile);
const expectedD95Profiles=[[["Chromium",40],["Iron",50],["Polonium",10]],[["Sulphur",45.4],["Selenium",9],["Iron",45.4]]];
if(JSON.stringify(d95Profiles)!==JSON.stringify(expectedD95Profiles))throw new Error(`Actox Cc-Cl D95 surface profile mismatch: ${JSON.stringify(d95Profiles)}`);

// Actox Cd-Ct D9 A4 is an IcePlanet with a uint seed above INT_MAX.
const d9Density=generator.distributionDensity(145,992,1332);
const d9=generator.generateSystem({secX:992,secY:1332,starId:9,rgb:{r:205,g:78,b:4},starConfigs,density:d9Density});
if(!d9)throw new Error("Actox Cd-Ct D9 was not generated");
const d9A4=d9.bodies.filter(body=>body.kind==="planet")[3];
const d9A4Profile=generator.surfaceMaterials(d9A4.type,d9A4.seed).map(material=>[material.name,Math.floor(material.chance*10)/10]);
const expectedD9A4Profile=[["Iron",47.6],["Phosphorus",33.3],["Vanadium",19]];
if(JSON.stringify(d9A4Profile)!==JSON.stringify(expectedD9A4Profile))throw new Error(`Actox Cd-Ct D9 A4 surface profile mismatch: ${JSON.stringify(d9A4Profile)}`);

const fixedResourceMap = generator.fixedAsteroidResources(123456, "G-WhiteYellow", [{
  type: "Asteroids", mater1: "Diamonds", mater2: "MethaneClathrate", mater3: "Uraninite"
}], starConfigs);
const fixedResources=fixedResourceMap.get(0);
if (JSON.stringify(fixedResources.map(resource => resource.name)) !== JSON.stringify(["Diamonds","MethaneClathrate","Uraninite"]) ||
    Math.floor(fixedResources.reduce((sum, resource) => sum + resource.chance, 0)) !== 100) {
  throw new Error("Fixed asteroid material overrides must replace the random selection and retain drop chances");
}
if(!Number.isInteger(fixedResourceMap.bodySeeds.get(0)))throw new Error("Fixed-system body seeds must be retained for surface material generation");

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
