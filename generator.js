(function () {
  const MAX_INT = 2147483647;
  let pixelConversion = null;
  let verifiedSystems = {};

  function airRound(value) { return Math.floor(value + 0.5); }
  function getPixelChannel(channel, alpha) {
    if (pixelConversion) return pixelConversion[(alpha << 8) | channel];
    if (alpha === 0) return 0;
    const premultiplied = airRound(channel * alpha / 255);
    return Math.min(255, Math.max(0, airRound(premultiplied * 255 / alpha)));
  }

  class FlashRandom {
    constructor(seed) {
      this.state = seed <= 0 ? 1 : seed;
      this.pointer = 0;
      this.pixels = [];
    }
    nextState() {
      this.state = (this.state * 16807) % MAX_INT;
      return this.state;
    }
    pixel(index) {
      while (this.pixels.length <= index) {
        const rawR = this.nextState() & 255;
        const rawG = this.nextState() & 255;
        const rawB = this.nextState() & 255;
        const a = this.nextState() & 255;
        const r = getPixelChannel(rawR, a);
        const g = getPixelChannel(rawG, a);
        const b = getPixelChannel(rawB, a);
        this.pixels.push((((a << 24) >>> 0) | (r << 16) | (g << 8) | b) >>> 0);
      }
      return this.pixels[index];
    }
    random() {
      this.pointer = (this.pointer + 1) % 200000;
      return (this.pixel(this.pointer) * 0.999999999999998 + 1e-15) / 4294967295;
    }
    float(min, max) { return this.random() * (max - min) + min; }
    integer(min, max) { return Math.floor(this.float(min, max)); }
    uinteger() { return (this.integer(-2147483647, 2147483646) + 2147483647.5) >>> 0; }
  }

  const starDefs = [
    ["M-RedDwarf",1000000,"all",120],["K-YellowOrange",780000,"all",140],["G-WhiteYellow",250000,"all",150],
    ["F-White",350000,"all",160],["A-BlueWhite",180000,"all",180],["B-BlueWhite",40000,"green",220],
    ["O-BlueWhite",3200,"green",245],["WolfRayetStar",7,"red",200],["WC-WolfRayetStar",148,"red",200],
    ["WN-WolfRayetStar",111,"red",200],["WNC-WolfRayetStar",118,"red",200],["WO-WolfRayetStar",355,"red",200],
    ["DA-WhiteDwarf",37700,"green",120],["DAV-WhiteDwarf",4160,"green",120],["DAZ-WhiteDwarf",1780,"green",120],
    ["DB-WhiteDwarf",6500,"green",120],["DBV-WhiteDwarf",1300,"green",120],["DC-WhiteDwarf",57000,"green",120],
    ["DCV-WhiteDwarf",5070,"green",120],["DO-WhiteDwarf",60,"green",120],["DOV-WhiteDwarf",35,"green",120],
    ["DQ-WhiteDwarf",100,"green",120],["DX-WhiteDwarf",40,"green",120],["HerbigAeStar",900,"green",200],
    ["HerbigBeStar",380,"green",200],["L-BrownDwarf",500000,"all",110],["T-BrownDwarf",250000,"all",100],
    ["TauriG",40000,"all",155],["TauriK",25000,"all",145],["TauriF",10000,"all",210],
    ["TauriM",5000,"all",120],["Y-BrownDwarf",75000,"all",90],["BursterPulsar",5000,"blue",40],
    ["RadioPulsar",40000,"green",40],["MillisecondPulsar",5000,"blue",50],["SoftGammaRepeaterMagnetar",125,"blue",60],
    ["AnomalousX-rayMagnetar",100,"blue",60],["Quarkstar",15,"red",40],["Preonstar",0,"red",30],
    ["BlackHole",1300,"red",50],["K-RedGiant",2350,"green",190],["M-RedGiant",3600,"green",200],
    ["G-YellowGiant",700,"green",210],["F-YellowGiant",500,"green",210],["M-RedSupergiant",120,"green",260],
    ["F-YellowSupergiant",375,"green",250],["A-BlueWhiteSupergiant",1125,"green",250],["B-BlueWhiteSupergiant",320,"green",250],
    ["O-BlueSupergiant",220,"green",260],["O-Hypergiant",60,"green",290],["CarbonC-RStar",2500,"all",200],
    ["CarbonC-HdStar",800,"all",210],["CarbonC-HStar",2100,"all",210],["CarbonC-JStar",1950,"all",200],
    ["CarbonC-NStar",17200,"all",220],["CarbonC-SStar",5000,"all",200],["CarbonM-SStar",27000,"all",200],
    ["S-Star",28500,"all",220]
  ].map(([name,chance,zone,sizeTo]) => ({name,chance,zone,sizeTo:sizeTo*3.3}));
  const starByName = new Map(starDefs.map(x => [x.name, x]));

  const planetDefs = [
    ["EarthLikePlanet",15000,273,353],["AmmoniaPlanet",15000,250,353],["GasGiantwithAmmoniaLife",32000,110,170],
    ["HeliumRichGasGiant",1000,270,1800],["GasGiantClassI",125000,70,160],["GasGiantClassII",75000,200,300],
    ["GasGiantClassIII",1200,350,800],["GasGiantClassIV",11200,900,1300],["GasGiantClassV",1120,1400,1900],
    ["GasGiantwithWaterLife",75000,160,250],["HighMetalPlanet",1180000,250,1100],["IcePlanet",1298000,0,220],
    ["MetalRichPlanet",100000,250,1800],["RockPlanet",740000,175,500],["WaterGiant",1300,240,333],
    ["WaterWorld",118000,250,333],["Y-BrownDwarf",75000,80,90],["Asteroids",1240000,0,5000]
  ].map(([name,chance,tempFrom,tempTo]) => ({name,chance,tempFrom,tempTo}));

  // GoodsType.enumMinerals order and _basicCost values from the AIR game.
  // The last two entries are uncommon minerals and are excluded from belts.
  const mineralDefs = [
    ["Diamonds",1],["Alexandrite",2.1],["Bouxite",.05],["Gallite",.2],["Coltan",.09],
    ["Bromellite",.8],["Rutile",.08],["Uraninite",.21],["Monazite",1.3],["Painite",1.1],
    ["Lepidolite",.15],["LithiumHydroxide",.22],["MethaneClathrate",.25],["VoidOpal",15],["Musgravite",10]
  ].map(([name,cost])=>({name,cost}));
  const commonMineralCount=mineralDefs.length-2;

  function mineralDropChances(materials){
    const costs=materials.map(material=>material.cost),max=Math.max(...costs),min=Math.min(...costs);
    const weights=materials.map(material=>max-material.cost+min),total=weights.reduce((sum,value)=>sum+value,0);
    return materials.map((material,index)=>({name:material.name,chance:100*weights[index]/total}));
  }

  function randomMinerals(rng,preferred=null){
    const available=Array.from({length:commonMineralCount},(_,index)=>index),picked=[];
    if(preferred){
      const preferredIndex=mineralDefs.findIndex(material=>material.name===preferred);
      const availableIndex=available.indexOf(preferredIndex);
      if(preferredIndex>=0){
        if(availableIndex>=0)available.splice(availableIndex,1);
        picked.push(mineralDefs[preferredIndex]);
      }
    }
    while(picked.length<3){
      const availableIndex=rng.integer(0,available.length);
      picked.push(mineralDefs[available.splice(availableIndex,1)[0]]);
    }
    return mineralDropChances(picked);
  }

  function weighted(rng, list) {
    const total = list.reduce((sum, item) => sum + item.chance, 0);
    const value = rng.float(0, total);
    let cursor = 0;
    for (const item of list) { cursor += item.chance; if (value <= cursor) return item; }
    return list[list.length - 1];
  }

  function getZoneStar(rng, rgb) {
    while (true) {
      const type = weighted(rng, starDefs);
      if (type.zone === "all") return type;
      const channel = type.zone === "red" ? rgb.r : type.zone === "green" ? rgb.g : rgb.b;
      if (rng.integer(0,255) <= channel || rng.integer(0,255) < 25) return type;
    }
  }

  function mapStarType(code) {
    const exact = {WN:"WN-WolfRayetStar",WNC:"WNC-WolfRayetStar",WC:"WC-WolfRayetStar",WO:"WO-WolfRayetStar",DA:"DA-WhiteDwarf",DAV:"DAV-WhiteDwarf",DZ:"DAZ-WhiteDwarf",DB:"DB-WhiteDwarf",DBV:"DBV-WhiteDwarf",DC:"DC-WhiteDwarf",DCV:"DCV-WhiteDwarf",DO:"DO-WhiteDwarf",DOV:"DOV-WhiteDwarf",DQ:"DQ-WhiteDwarf",DX:"DX-WhiteDwarf",T0t:"TauriF",T1t:"TauriG",T2t:"TauriK",T3t:"TauriM"};
    if (exact[code]) return exact[code];
    const first=code[0], second=code[1]||"", third=code[2]||"";
    if (third === "") {
      const special = {HA:"HerbigAeStar",HB:"HerbigBeStar",Qk:"Quarkstar",Pr:"Preonstar"};
      return special[code] || ({M:"M-RedDwarf",F:"F-White",B:"B-BlueWhite",G:"G-WhiteYellow",K:"K-YellowOrange",A:"A-BlueWhite",L:"L-BrownDwarf",Y:"Y-BrownDwarf",T:"T-BrownDwarf",O:"O-BlueWhite",N:"RadioPulsar",W:"WolfRayetStar",C:"S-Star",X:"BlackHole"})[first] || null;
    }
    return ({Ns:"SoftGammaRepeaterMagnetar",Nm:"MillisecondPulsar",Nb:"BursterPulsar",Nx:"AnomalousX-rayMagnetar",Cr:"CarbonC-RStar",Cd:"CarbonC-HdStar",Ch:"CarbonC-HStar",Cj:"CarbonC-JStar",Cn:"CarbonC-NStar",Cs:"CarbonC-SStar",Cm:"CarbonM-SStar",As:"A-BlueWhiteSupergiant",Bs:"B-BlueWhiteSupergiant",Oh:"O-Hypergiant",Gg:"G-YellowGiant",Fg:"F-YellowGiant",Fs:"F-YellowSupergiant",Kg:"K-RedGiant",Mg:"M-RedGiant",Ms:"M-RedSupergiant",Os:"O-BlueSupergiant"})[first+third] || null;
  }

  function randomStarConfig(rng, type, configs) {
    const matches = configs.filter(c => mapStarType(c.type) === type.name);
    const picked = matches[rng.integer(0, matches.length)] || {temp:3000,luminosity:1,type:""};
    return {type, temperature:Number(picked.temp), luminosity:Number(picked.luminosity), subtype:picked.type};
  }

  const pairNames = ["HerbigBeStar","HerbigAeStar","RadioPulsar","O-BlueSupergiant","B-BlueWhiteSupergiant","DC-WhiteDwarf","A-BlueWhiteSupergiant","O-BlueWhite","WO-WolfRayetStar","M-RedSupergiant","F-YellowSupergiant","BlackHole","B-BlueWhite","K-RedGiant","F-YellowGiant","M-RedGiant","A-BlueWhite","CarbonC-HStar","CarbonC-HdStar","CarbonC-JStar","CarbonC-RStar","CarbonC-NStar","F-White","F-White","F-White","F-White","F-White","TauriF","G-WhiteYellow","G-WhiteYellow","G-WhiteYellow","G-WhiteYellow","G-WhiteYellow","TauriG","K-YellowOrange","K-YellowOrange","K-YellowOrange","K-YellowOrange","K-YellowOrange","TauriK","TauriM","M-RedDwarf","M-RedDwarf","M-RedDwarf","M-RedDwarf","M-RedDwarf","L-BrownDwarf","T-BrownDwarf"];
  const pairTypes = pairNames.map(name => starByName.get(name));

  function starPairs(rng, primary, includePrimary, configs) {
    const stars = includePrimary ? [primary] : [];
    let from = 0, to = 0;
    for (const type of pairTypes) { if (!primary || type === primary.type) from = to; to += type.chance; }
    while (rng.float(0,100) < 100/(Math.max(.5,stars.length)*6) && stars.length < 3) {
      const n=rng.integer(from,to); let cursor=0;
      for (const type of pairTypes) { cursor+=type.chance; if(n<cursor){ stars.push(randomStarConfig(rng,type,configs)); from=cursor; break; } }
    }
    return stars;
  }

  function generatePlanets(rng, primary, configs, group=0, remaining=-1, companions=null) {
    const angle=rng.float(0,Math.PI*2), offsetX=10000*group*Math.sin(angle), offsetY=10000*group*Math.cos(angle);
    let stars;
    if(companions!==null){
      stars=[primary];
      let consumed=0;
      while(consumed<companions.length&&companions[consumed]){
        stars.push(randomStarConfig(rng,companions[consumed],configs));consumed++;
      }
      companions=companions.slice(consumed);
    }else stars=starPairs(rng,primary,true,configs);
    const output=[];
    let maxSize=Math.max(...stars.map(s=>s.type.sizeTo));
    for (const star of stars) { output.push({type:star.type.name,kind:"star",temperature:star.temperature,subtype:star.subtype,orbit:0,orbitTo:0,group}); rng.uinteger(); }
    if(rng.integer(0,100)<10) return output;
    let count;
    if(remaining===-1){count=rng.integer(1,15);remaining=15}else count=rng.integer(1,remaining);
    const used=new Array(500).fill(false), temps=new Array(500);
    for(let i=0;i<500;i++){const dist=10*(i+1)*299792000,lum=stars[0].luminosity*3.846e26;temps[i]=Math.trunc(Math.pow(lum*.7/(16*Math.PI*dist*dist*(5.67e-8)),.25)+40);if(i<3)used[i]=true;}
    const bodies=[];
    let asteroidBelts=0;
    for(let i=0;i<count;i++){
      const type=weighted(rng,planetDefs);
      let span=Math.trunc(rng.integer(100,3000)/10);
      const eligible=[];for(let k=4;k<500;k++)if(!used[k]&&temps[k]>type.tempFrom&&temps[k]<type.tempTo)eligible.push(k);
      if(!eligible.length)continue;
      const pick=rng.integer(0,eligible.length);
      if(type.name==="Asteroids"){
        if(asteroidBelts>1||group>0)continue;
        let free=0;
        while(free<span&&pick+free<used.length&&!used[pick+free])free++;
        free-=8;
        if(free<12)continue;
        asteroidBelts++;
        span=free;
        while(free>0)used[pick+(--free)]=true;
      }else span=0;
      const slot=eligible[pick];used[slot]=true;remaining--;
      rng.float(0,Math.PI*2);rng.uinteger();
      const resources=type.name==="Asteroids"?randomMinerals(rng):[];
      bodies.push({type:type.name,kind:"planet",temperature:Math.round(temps[slot]),orbit:(slot+(type.name==="Asteroids"?1:0))*10+25,orbitTo:type.name==="Asteroids"?(slot+span-1)*10+25:slot*10+25,group,resources});
    }
    bodies.sort((a,b)=>a.orbit-b.orbit);output.push(...bodies);
    if(group<3){
      let next;
      if(companions!==null&&companions.length>1){next=[randomStarConfig(rng,companions[1],configs)];companions=companions.slice(2);}
      else if(companions!==null)next=[];
      else next=starPairs(rng,primary,false,configs);
      if(next.length)output.push(...generatePlanets(rng,randomStarConfig(rng,next[0].type,configs),configs,group+1,remaining,companions));
    }
    return output;
  }

  function globalId(secX,secY,starId){return ((((secX&4095)<<20)>>>0)+((secY&4095)<<8)+(starId&255))>>>0;}

  function createSystemRng(seed) {
    // PlanetManager.MakePlanets resets Rndm to the global system ID after the
    // background has been drawn, so none of the background calls carry over.
    return new FlashRandom(seed);
  }

  function generateSeededSystem(seed, type, starConfigs, companions=null) {
    const rng=createSystemRng(seed);
    // MakePlanetsFromDB consumes these calls even when the system has no
    // preset planets and returns null before procedural generation begins.
    randomStarConfig(rng,type,starConfigs);
    rng.float(0,Math.PI*2);
    const primary=randomStarConfig(rng,type,starConfigs);
    return generatePlanets(rng,primary,starConfigs,0,-1,companions);
  }

  function fixedAsteroidResources(seed,starType,preset,starConfigs){
    const rng=createSystemRng(seed),primaryType=starByName.get(starType);
    if(!primaryType)return new Map();
    const primary=randomStarConfig(rng,primaryType,starConfigs);
    rng.float(0,Math.PI*2);
    const resources=new Map(),pendingStars=[primaryType];
    const compactTypes=new Set(["SoftGammaRepeaterMagnetar","RadioPulsar","MillisecondPulsar","BursterPulsar","AnomalousX-rayMagnetar"]);
    let generatedBodyCount=0;
    preset.forEach((item,index)=>{
      const itemStarType=starByName.get(item.type);
      if(itemStarType){
        if(generatedBodyCount)rng.float(0,Math.PI*2);
        pendingStars.push(itemStarType);
      }
      if(pendingStars.length&&(index===preset.length-1||!itemStarType)){
        for(const type of pendingStars){randomStarConfig(rng,type,starConfigs);rng.uinteger();generatedBodyCount++;}
        pendingStars.length=0;
      }
      if(itemStarType)return;
      rng.float(0,Math.PI*2);
      if(compactTypes.has(primary.type.name))randomStarConfig(rng,starByName.get("G-WhiteYellow"),starConfigs);
      rng.uinteger();
      if(item.type==="Asteroids"){
        const specified=[item.mater1,item.mater2,item.mater3].filter(Boolean);
        let beltResources=randomMinerals(rng,specified[0]||null);
        if(specified.length===3)beltResources=mineralDropChances(specified.map(name=>mineralDefs.find(material=>material.name===name)).filter(Boolean));
        resources.set(index,beltResources);
      }
      generatedBodyCount++;
    });
    return resources;
  }

  function adjustedDensity(secX,secY,density){
    let adjusted=Math.trunc(density);
    if(secX===1025&&secY===1591)adjusted=1;
    if(adjusted>1)adjusted=Math.trunc(adjusted/1.5);
    return adjusted;
  }

  function enumerateCell(secX,secY,rgb,density,realBlockers=[],starIdOffset=0){
    const rng=new FlashRandom(secX*10000+secY);
    const adjusted=adjustedDensity(secX,secY,density);
    let starCount=Math.trunc(Math.sqrt(adjusted));starCount*=starCount;
    if(starCount>100)starCount=100;
    let side=Math.sqrt(starCount);if(!side&&(adjusted>0||realBlockers.length))side=1;
    const step=side?1/side:1;
    const occupied=realBlockers.map(star=>({x:star.mapX??star.x,y:star.mapY??star.y}));
    const systems=[];
    for(let i=0;i<side*side;i++){
      const column=i%side,row=Math.floor(i/side);
      const mapX=secX+step/2+column*step+rng.float(0,step/1.3);
      const mapY=secY+row*step+rng.float(0,step/1.3);
      const overlaps=occupied.some(star=>step*step/2>(star.x-mapX)**2+(star.y-mapY)**2);
      if(overlaps)continue;
      const type=getZoneStar(rng,rgb);
      occupied.push({x:mapX,y:mapY});
      const starId=i+starIdOffset;
      systems.push({secX,secY,starId,candidateId:i,mapX,mapY,starType:type.name,globalId:globalId(secX,secY,starId)});
    }
    return systems;
  }

  const api = {
    setPixelConversionTable(buffer) {
      const table = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      if (table.length !== 65536) throw new Error("AIR pixel conversion table must contain 65536 bytes");
      pixelConversion = table;
    },
    setVerifiedSystems(systems) {
      verifiedSystems = systems || {};
    },
    getStarTypes(){return starDefs.map(type=>type.name);},
    getPlanetTypes(){return planetDefs.map(type=>type.name);},
    getMineralTypes(){return mineralDefs.map(material=>material.name);},
    fixedAsteroidResources,
    globalId,
    enumerateCell({secX,secY,rgb,density,realBlockers=[],starIdOffset=0}){
      return enumerateCell(secX,secY,rgb,density,realBlockers,starIdOffset);
    },
    distributionDensity(rawDensity, x, y) {
      const noise = new FlashRandom(0);
      const pointer = (y * 2048 + x + 1) % 200000;
      const value = noise.pixel(pointer) / 4294967295;
      const roll = Math.floor(value * 100);
      if (rawDensity > 3) {
        if (roll < 10) return Math.trunc(rawDensity / 3);
        if (roll < 30) return Math.trunc(rawDensity / 2);
        if (roll < 50) return Math.trunc(rawDensity / 1.5);
      }
      return rawDensity;
    },
    generateSeededSystem(seed, starType, starConfigs) {
      const type=starByName.get(starType);
      if(!type) throw new Error(`Unknown star type: ${starType}`);
      return generateSeededSystem(seed>>>0,type,starConfigs);
    },
    generateRealSystem({secX,secY,starId,starType,companions=[],starConfigs}){
      const type=starByName.get(starType);if(!type)return null;
      const companionTypes=companions.map(name=>name?starByName.get(name)||null:null);
      return {starType,globalId:globalId(secX,secY,starId),bodies:generateSeededSystem(globalId(secX,secY,starId),type,starConfigs,companionTypes)};
    },
    generateSystem({secX,secY,starId,rgb,starConfigs,density=85,realBlockers=[]}) {
      const system=enumerateCell(secX,secY,rgb,density,realBlockers).find(item=>item.starId===starId);
      if(!system)return null;
      const type=starByName.get(system.starType),id=system.globalId;
      const bodies=generateSeededSystem(id,type,starConfigs);
      const reference=verifiedSystems[String(id)];
      const generatedStar=bodies.find(body=>body.kind==="star");
      const generatedTypes=bodies.filter(body=>body.kind==="planet").map(body=>body.type);
      const referenceTypes=reference?.bodies?.map(body=>body.type) || [];
      const verified=Boolean(reference &&
        generatedStar?.temperature===Number(reference.starTemperature) &&
        (!reference.starSubtype || generatedStar?.subtype===reference.starSubtype) &&
        generatedTypes.length===referenceTypes.length &&
        generatedTypes.every((planetType,index)=>planetType===referenceTypes[index]));
      return {...system,bodies,verified};
    }
  };
  globalThis.GalaxyGenerator = api;
  if (typeof window !== "undefined") window.GalaxyGenerator = api;
})();
