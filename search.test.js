const fs=require("fs"),path=require("path"),vm=require("vm");
global.window={};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,"generator.js"),"utf8"),{filename:"generator.js"});
global.GalaxyGenerator=window.GalaxyGenerator;
vm.runInThisContext(fs.readFileSync(path.join(__dirname,"naming.js"),"utf8"),{filename:"naming.js"});
global.GalaxyNaming=window.GalaxyNaming;
vm.runInThisContext(fs.readFileSync(path.join(__dirname,"search-core.js"),"utf8"),{filename:"search-core.js"});
global.GalaxySearch=window.GalaxySearch;

GalaxyGenerator.setPixelConversionTable(fs.readFileSync(path.join(__dirname,"data","PixelConversion.bin")));
const sectors=JSON.parse(fs.readFileSync(path.join(__dirname,"data","Sectors.json"),"utf8")).sec;
const starConfigs=JSON.parse(fs.readFileSync(path.join(__dirname,"data","StarTypes.json"),"utf8")).starTypes;
const mapBytes=2048*2048*4,rgbPixels=new Uint8Array(mapBytes),densityPixels=new Uint8Array(mapBytes);
for(let x=1018;x<=1032;x++)for(let y=1584;y<=1598;y++)densityPixels[(y*2048+x)*4]=1;

function real(name,x,type="G"){
  return{name,mainCategory:"Star",coords:{x:String(x),y:"0",z:"0"},references:{simbad:{SpectralType:type,typeMain:"*",typeAll:"*"}}};
}
const stars=[real("Fixed",0),real("Dynamic",20)];
const planets=[
  {system:"Fixed",Name:"Fixed A1",type:"RockPlanet",dist:10,size:1,rings:0},
  {system:"Fixed",Name:"Fixed Belt",type:"Asteroids",dist:20,size:5,rings:0,mater1:"Diamonds",mater2:"MethaneClathrate",mater3:"Uraninite"}
];
const engine=new GalaxySearch.SearchEngine({stars,planets,sectors,starConfigs,rgbPixels,densityPixels});
const base={centerLy:{x:0,y:0},radius:100,targetMode:"star",targetType:"G-WhiteYellow"};

function classified(typeMain,spectral="",typeAll="",name="Test",mainCategory="Star"){
  return GalaxySearch.classifyRealStar({name,mainCategory,references:{simbad:{typeMain,SpectralType:spectral,typeAll}}});
}
const classificationCases=[
  [["*","K",""],"K-RedGiant"],[["*","M",""],"M-RedGiant"],[["s*b","W",""],"B-BlueWhiteSupergiant"],
  [["pr*","P",""],"Preonstar"],[["s*p","P",""],"Preonstar"],[["TT*","F",""],"TauriF"],
  [["sg*","O",""],"O-BlueSupergiant"],[["PM*","","BD*,WD*,K*,A*"],"A-BlueWhite"],
  [["PM*","A","","V123 Tauri"],"HerbigAeStar"],[["PM*","W",""],"WO-WolfRayetStar"],
  [["PM*","","","Test","Young Stellar Object"],"M-RedDwarf"],[["PM*","","","Test","Emission-line Star"],"K-YellowOrange"]
];
for(const [args,expected] of classificationCases)if(classified(...args)!==expected)throw new Error(`real-star classification failed for ${args.join("/")}`);

const collisionEngine=new GalaxySearch.SearchEngine({stars:[real("First",0),real("Duplicate",.01),real("Third",.5)],planets:[],sectors,starConfigs,rgbPixels,densityPixels});
const collisionStars=collisionEngine.cellReal(1025,1591);
if(collisionStars.length!==2||collisionStars[0].starId!==0||collisionStars[1].starId!==1)throw new Error("real-star collision IDs must use accepted cell order");

function sources(query){return engine.processCell(1025,1591,{...base,...query}).filter(x=>x.source==="real").map(x=>x.systemName);}
if(JSON.stringify(sources({excludeFixed:false,excludeNamed:false}))!==JSON.stringify(["Fixed","Dynamic"]))throw new Error("all-source exclusion case failed");
if(JSON.stringify(sources({excludeFixed:true,excludeNamed:false}))!==JSON.stringify(["Dynamic"]))throw new Error("default exclusion case failed");
if(sources({excludeFixed:false,excludeNamed:true}).length)throw new Error("named exclusion case failed");
if(sources({excludeFixed:true,excludeNamed:true}).length)throw new Error("combined exclusion case failed");
const fixedBelt=engine.realBodies(engine.cellReal(1025,1591)[0]).find(body=>body.type==="Asteroids");
if(JSON.stringify(fixedBelt.resources.map(resource=>resource.name))!==JSON.stringify(["Diamonds","MethaneClathrate","Uraninite"]))throw new Error("fixed asteroid resources must flow from the planet database into search bodies");
const allFixedPlanets=engine.processCell(1025,1591,{...base,targetMode:"planet",targetType:"",excludeFixed:false,excludeNamed:false}).filter(result=>result.systemName==="Fixed");
if(allFixedPlanets.length!==1||JSON.stringify(allFixedPlanets[0].matchedObjects.map(result=>result.type))!==JSON.stringify(["RockPlanet","Asteroids"]))throw new Error("all matching planets in one system must be grouped into one result");
const allStarTypes=engine.matches({source:"test",globalId:1,name:"Mixed",xLy:0,yLy:0,mapX:1025,mapY:1591,starType:"G-WhiteYellow"},[
  {kind:"star",type:"G-WhiteYellow",group:0},{kind:"star",type:"M-RedDwarf",group:0}
],{...base,targetType:""});
if(allStarTypes.length!==1||JSON.stringify(allStarTypes[0].matchedObjects.map(result=>result.type))!==JSON.stringify(["G-WhiteYellow","M-RedDwarf"]))throw new Error("all matching stars in one system must be grouped into one result");
const diamondResults=engine.processCell(1025,1591,{...base,targetMode:"mineral",targetType:"Diamonds",excludeFixed:false,excludeNamed:false}).filter(result=>result.systemName==="Fixed");
if(diamondResults.length!==1||diamondResults[0].kind!=="mineral"||diamondResults[0].abundance<=0||diamondResults[0].matchedObjects[0].objectIndex!==2)throw new Error("ordinary mineral searches must return the containing asteroid belt and its abundance");
const deepResults=engine.matches({source:"test",globalId:2,name:"Deep",secX:1023,secY:1588,xLy:0,yLy:0,mapX:1023,mapY:1588,starType:"G-WhiteYellow"},[
  {kind:"star",type:"G-WhiteYellow",group:0},{kind:"planet",type:"Asteroids",group:0,resources:[]}
],{...base,targetMode:"mineral",targetType:"VoidOpal"});
if(deepResults.length!==1||deepResults[0].abundance!==5||deepResults[0].matchedObjects[0].resourceKind!=="deep")throw new Error("Void Opal searches must match remainder-1 sectors at the 5% deep-asteroid rate");
const mineralOrder=[{systemName:"NearLow",distance:1,abundance:10},{systemName:"FarHigh",distance:90,abundance:60}].sort((a,b)=>GalaxySearch.compareResults(a,b,{targetMode:"mineral"}));
if(mineralOrder[0].systemName!=="FarHigh")throw new Error("mineral results must sort by abundance before distance");

(async()=>{
  const query={centerLy:{x:0,y:0},radius:300,targetMode:"star",targetType:"M-RedDwarf",excludeFixed:true,excludeNamed:true};
  const optimized=await engine.search(query,{yieldEvery:100000});
  const limited=await engine.search({...query,resultLimit:3},{yieldEvery:100000});
  const centerMap=GalaxySearch.lyToMap(0,0),complete=[];
  for(const cell of engine.buildCells(centerMap,query.radius))complete.push(...engine.processCell(cell.x,cell.y,query));
  complete.sort((a,b)=>a.distance-b.distance||a.systemName.localeCompare(b.systemName)||a.objectIndex-b.objectIndex);complete.length=Math.min(10,complete.length);
  const signature=items=>items.map(item=>[item.systemName,item.objectIndex,item.distance]);
  if(JSON.stringify(signature(optimized))!==JSON.stringify(signature(complete)))throw new Error("nearest-10 early stop differs from exhaustive scan");
  if(limited.length!==Math.min(3,complete.length)||JSON.stringify(signature(limited))!==JSON.stringify(signature(complete.slice(0,3))))throw new Error("custom result limit differs from exhaustive scan");
  const namedCenter=engine.resolveName("fIxEd");
  if(namedCenter.length!==1||namedCenter[0].label!=="Fixed")throw new Error("real center lookup must be exact and case-insensitive");
  const edgeCells=engine.buildCells({x:-10,y:-10},2000);
  if(edgeCells.some(cell=>cell.x<0||cell.y<0||cell.x>=2048||cell.y>=2048))throw new Error("map boundary clipping failed");
  const none=await engine.search({...query,radius:1,targetType:"BlackHole"},{yieldEvery:100000});
  if(none.length!==0)throw new Error("empty range search failed");
  let cancel=false,cancelled=false;
  try{await engine.search({...query,radius:2000},{yieldEvery:1,progress:()=>{cancel=true;},cancelled:()=>cancel});}catch(error){cancelled=error.message==="SEARCH_CANCELLED";}
  if(!cancelled)throw new Error("search cancellation failed");
  const repeated=await engine.search(query,{yieldEvery:100000});
  if(JSON.stringify(signature(repeated))!==JSON.stringify(signature(optimized)))throw new Error("repeated search changed results");
  if(repeated.some(result=>!Array.isArray(result.systemPlanets)))throw new Error("search results must include the complete system planet list");
  if(repeated.some(result=>result.systemPlanets.some(planet=>!Array.isArray(planet.surfaceMaterials))))throw new Error("search planets must include surface material data");
  console.log(`Range search PASS: exclusions, centers, bounds, cancellation + nearest ${optimized.length} of ${complete.length}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
