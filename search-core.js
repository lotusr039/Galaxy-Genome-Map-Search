(function () {
  const YEARS_PER_PIXEL=43.74,SOL_X=1025,SOL_Y=1591,MAP_SIZE=2048,MAX_RESULTS=10;

  const companionCodes={A:"A-BlueWhite",B:"B-BlueWhite",O:"O-BlueWhite",WD:"DA-WhiteDwarf",BH:"BlackHole",K:"K-YellowOrange",G:"G-WhiteYellow",M:"M-RedDwarf",L:"L-BrownDwarf",S:"S-Star",C:"CarbonC-NStar",W:"WO-WolfRayetStar",N:"RadioPulsar"};
  const mainTypes={"s*b":"B-BlueWhiteSupergiant",BH:"BlackHole","s*r":"M-RedSupergiant","g*K":"K-RedGiant","g*M":"M-RedGiant","WD*":"DC-WhiteDwarf","DN*":"DX-WhiteDwarf","ZZ*":"DAZ-WhiteDwarf","WD?":"DAV-WhiteDwarf","BD*":"L-BrownDwarf","C*":"CarbonC-NStar","S*":"S-Star","CH*":"CarbonC-HStar","N*":"RadioPulsar","Ae*":"HerbigAeStar","WR*":"WO-WolfRayetStar","Be*":"HerbigBeStar",Psr:"MillisecondPulsar"};
  const spectralTypes={M:"M-RedDwarf",K:"K-YellowOrange",G:"G-WhiteYellow",F:"F-White",A:"A-BlueWhite",B:"B-BlueWhite",O:"O-BlueWhite",S:"S-Star",C:"CarbonC-NStar",W:"WO-WolfRayetStar"};

  function mapToLy(x,y){return{x:(x-SOL_X)*YEARS_PER_PIXEL,y:(SOL_Y-y)*YEARS_PER_PIXEL};}
  function lyToMap(x,y){return{x:x/YEARS_PER_PIXEL+SOL_X,y:-y/YEARS_PER_PIXEL+SOL_Y};}
  function classifyRealStar(star){
    const simbad=star.references?.simbad||{};
    const spectral=String(simbad.SpectralType||"");
    const exact=spectral.length===1?spectral:"";
    const all=String(simbad.typeAll||"").split(",");
    const main=simbad.typeMain==="*"?`g*${spectral}`:simbad.typeMain;
    let type=mainTypes[main]||null;
    if(main==="TT*")type={M:"TauriM",K:"TauriK",G:"TauriG",F:"TauriF"}[exact]||null;
    if(main==="sg*")type={M:"M-RedSupergiant",O:"O-BlueSupergiant",B:"B-BlueWhiteSupergiant",A:"A-BlueWhiteSupergiant",F:"F-YellowSupergiant"}[exact]||null;
    if((main==="pr*"||main==="s*p")&&exact==="P")type="Preonstar";
    if(!type){
      const ordered=[["BD*","L-BrownDwarf"],["WD*","DAZ-WhiteDwarf"],["K*","K-YellowOrange"],["G*","G-WhiteYellow"],["F*","F-White"],["M*","M-RedDwarf"],["B*","B-BlueWhite"],["O*","O-BlueWhite"],["A*","A-BlueWhite"]];
      for(const [code,name] of ordered)if(all.includes(code))type=name;
      if(String(star.name).includes(" Tauri"))type={M:"TauriM",K:"TauriK",G:"TauriG",F:"TauriF",A:"HerbigAeStar",B:"HerbigBeStar"}[exact]||type;
    }
    if(!type)type=spectralTypes[exact.toUpperCase()]||null;
    if(!type)type=star.mainCategory==="Young Stellar Object"?"M-RedDwarf":star.mainCategory==="Emission-line Star"?"K-YellowOrange":"F-White";
    return type;
  }

  function parseCompanions(star){
    const value=star.references?.simbad?.Satellites;
    if(!value)return[];
    const result=[];
    for(const group of String(value).split(";")){
      for(const code of group.split(",")){const type=companionCodes[code];if(type)result.push(type);}
      result.push(null);
    }
    return result;
  }

  function minCellDistanceLy(cellX,cellY,center){
    const dx=center.x<cellX?cellX-center.x:center.x>cellX+1?center.x-(cellX+1):0;
    const dy=center.y<cellY?cellY-center.y:center.y>cellY+1?center.y-(cellY+1):0;
    return Math.hypot(dx,dy)*YEARS_PER_PIXEL;
  }

  class SearchEngine{
    constructor({stars,planets,sectors,starConfigs,rgbPixels,densityPixels}){
      this.sectors=sectors;this.centers=GalaxyNaming.buildSectorCenters();this.starConfigs=starConfigs;
      this.rgbPixels=rgbPixels;this.densityPixels=densityPixels;
      this.planetsBySystem=new Map();
      for(const planet of planets){if(!this.planetsBySystem.has(planet.system))this.planetsBySystem.set(planet.system,[]);this.planetsBySystem.get(planet.system).push(planet);}
      this.fixedSystems=new Set(this.planetsBySystem.keys());
      this.realByName=new Map();this.realByCell=new Map();
      stars.forEach((raw,databaseIndex)=>{
        const xLy=Number(raw.coords?.x||0),yLy=Number(raw.coords?.z||0),zLy=Number(raw.coords?.y||0),map=lyToMap(xLy,yLy);
        const real={source:"real",databaseIndex,name:raw.name,xLy,yLy,zLy,mapX:map.x,mapY:map.y,secX:Math.floor(map.x),secY:Math.floor(map.y),starType:classifyRealStar(raw),spectral:String(raw.references?.simbad?.SpectralType||""),companions:parseCompanions(raw),raw};
        this.realByName.set(String(raw.name).toLowerCase(),real);
        if(map.x<0||map.y<0||map.x>=MAP_SIZE||map.y>=MAP_SIZE)return;
        if(!(Math.abs(zLy)<7||Math.abs(map.x-SOL_X)>200/YEARS_PER_PIXEL||Math.abs(map.y-SOL_Y)>200/YEARS_PER_PIXEL))return;
        const key=`${real.secX},${real.secY}`;if(!this.realByCell.has(key))this.realByCell.set(key,[]);this.realByCell.get(key).push(real);
      });
      for(const [key,items] of this.realByCell){
        const reserved=new Set(),accepted=[];
        items.forEach(real=>{
          const qx=Math.min(99,Math.round((real.mapX-real.secX)*100)),qy=Math.min(99,Math.round((real.mapY-real.secY)*100)),q=`${qx},${qy}`;
          if(reserved.has(q))return;reserved.add(q);real.starId=accepted.length;real.globalId=GalaxyGenerator.globalId(real.secX,real.secY,real.starId);accepted.push(real);
        });
        let anonymous=0;
        for(const real of accepted)if(!real.name){anonymous++;real.anonymousIndex=anonymous;}
        accepted.anonymousCount=anonymous;
        this.realByCell.set(key,accepted);
      }
      this.starTypes=new Set(GalaxyGenerator.getStarTypes());
    }

    pixel(secX,secY){const offset=(secY*MAP_SIZE+secX)*4;return{rgb:{r:this.rgbPixels[offset],g:this.rgbPixels[offset+1],b:this.rgbPixels[offset+2]},density:GalaxyGenerator.distributionDensity(this.densityPixels[offset]||0,secX,secY)};}
    cellReal(secX,secY){return this.realByCell.get(`${secX},${secY}`)||[];}
    cellGenerated(secX,secY){const real=this.cellReal(secX,secY),pixel=this.pixel(secX,secY);return GalaxyGenerator.enumerateCell({secX,secY,...pixel,realBlockers:real,starIdOffset:real.anonymousCount||0});}
    generatedName(system){return GalaxyNaming.encodeCell(system.secX,system.secY,system.starId,this.sectors,this.centers);}

    realBodies(real){
      const preset=this.planetsBySystem.get(real.name);
      if(preset){
        const bodies=[{kind:"star",type:real.starType,subtype:real.spectral,temperature:null,group:0,orbit:0}],pendingStars=[];
        let group=0,seenPlanet=false;
        for(const item of preset){
          if(this.starTypes.has(item.type)){
            if(seenPlanet&&pendingStars.length===0)group++;
            pendingStars.push({kind:"star",type:item.type,subtype:"",temperature:null,group,orbit:Number(item.dist||0)});
            continue;
          }
          if(pendingStars.length)bodies.push(...pendingStars.splice(0));
          bodies.push({kind:"planet",type:item.type,temperature:null,orbit:Number(item.dist||0),orbitTo:Number(item.dist||0)+Number(item.size||0),group,Name:item.Name,presetIndex:preset.indexOf(item)});
          seenPlanet=true;
        }
        bodies.push(...pendingStars);
        const beltResources=GalaxyGenerator.fixedAsteroidResources(real.globalId,real.starType,preset,this.starConfigs);
        for(const body of bodies)if(body.type==="Asteroids")body.resources=beltResources.get(body.presetIndex)||[];
        return bodies;
      }
      return GalaxyGenerator.generateRealSystem({secX:real.secX,secY:real.secY,starId:real.starId,starType:real.starType,companions:real.companions,starConfigs:this.starConfigs}).bodies;
    }

    generatedBodies(system){return GalaxyGenerator.generateSeededSystem(system.globalId,system.starType,this.starConfigs);}

    matches(system,bodies,query){
      const distance=Math.hypot(system.xLy-query.centerLy.x,system.yLy-query.centerLy.y);
      if(distance>query.radius)return[];
      let planetIndex=0;
      const systemPlanets=bodies.filter(body=>body.kind==="planet").map(body=>{
        const group=body.group??0,groupStar=bodies.find(item=>item.kind==="star"&&(item.group??0)===group);
        return{objectIndex:++planetIndex,name:body.Name||"",type:body.type,temperature:body.temperature??null,orbit:body.orbit??null,orbitTo:body.orbitTo??body.orbit??null,group,starType:groupStar?.type||system.starType,resources:body.resources||[]};
      });
      const matches=[];
      bodies.forEach((body,index)=>{
        if(body.kind!==query.targetMode||body.type!==query.targetType)return;
        const sameKindBefore=bodies.slice(0,index).filter(item=>item.kind===body.kind).length;
        const group=body.group??0,groupStar=bodies.find(item=>item.kind==="star"&&(item.group??0)===group);
        matches.push({id:`${system.source}-${system.globalId??system.databaseIndex}-${body.kind}-${index}`,systemName:system.name,source:system.source,fixed:Boolean(system.fixed),kind:body.kind,type:body.type,subtype:body.subtype||"",temperature:body.temperature??null,orbit:body.orbit??null,group,objectIndex:sameKindBefore+1,xLy:system.xLy,yLy:system.yLy,mapX:system.mapX,mapY:system.mapY,distance,starType:groupStar?.type||system.starType,systemPlanets});
      });
      return matches;
    }

    processCell(secX,secY,query){
      const output=[],realStars=this.cellReal(secX,secY);
      if(!query.excludeNamed){
        for(const real of realStars){
          const fixed=this.fixedSystems.has(real.name);if(query.excludeFixed&&fixed)continue;
          const name=real.name||this.generatedName({...real,starId:real.anonymousIndex});
          output.push(...this.matches({...real,name,fixed},this.realBodies(real),query));
        }
      }
      for(const generated of this.cellGenerated(secX,secY)){
        const ly=mapToLy(generated.mapX,generated.mapY),system={...generated,source:"generated",name:this.generatedName(generated),xLy:ly.x,yLy:ly.y,fixed:false};
        output.push(...this.matches(system,this.generatedBodies(generated),query));
      }
      return output;
    }

    resolveName(input){
      const exact=this.realByName.get(String(input).trim().toLowerCase());
      if(exact)return[{xLy:exact.xLy,yLy:exact.yLy,mapX:exact.mapX,mapY:exact.mapY,label:exact.name}];
      const variants=new Set([String(input).trim()]);
      const match=String(input).trim().match(/^(.+?)\s+(.{2})-(.{2})\s+([b-e])(\d+)$/i);
      if(match)variants.add(`${match[1]} ${match[2][0].toUpperCase()}${match[2][1].toLowerCase()}-${match[3][0].toUpperCase()}${match[3][1].toLowerCase()} ${match[4].toUpperCase()}${match[5]}`);
      const choices=[];
      for(const variant of variants){
        const decoded=GalaxyNaming.parseName(variant,this.sectors,this.centers);if(!decoded)continue;
        for(const candidate of decoded.candidates){
          const systems=this.cellGenerated(candidate.mapX,candidate.mapY),system=systems.find(item=>item.starId===decoded.starId);if(!system)continue;
          const ly=mapToLy(system.mapX,system.mapY),key=`${system.mapX},${system.mapY}`;
          if(!choices.some(item=>item.key===key))choices.push({key,xLy:ly.x,yLy:ly.y,mapX:system.mapX,mapY:system.mapY,label:variant});
        }
      }
      return choices;
    }

    buildCells(centerMap,radius){
      const cellRadius=Math.ceil(radius/YEARS_PER_PIXEL)+1,cells=[];
      for(let x=Math.max(0,Math.floor(centerMap.x)-cellRadius);x<=Math.min(MAP_SIZE-1,Math.floor(centerMap.x)+cellRadius);x++)for(let y=Math.max(0,Math.floor(centerMap.y)-cellRadius);y<=Math.min(MAP_SIZE-1,Math.floor(centerMap.y)+cellRadius);y++){
        const minDistance=minCellDistanceLy(x,y,centerMap);if(minDistance<=radius)cells.push({x,y,minDistance});
      }
      return cells.sort((a,b)=>a.minDistance-b.minDistance||a.x-b.x||a.y-b.y);
    }

    async search(query,{cancelled=()=>false,progress=()=>{},yieldEvery=8}={}){
      const centerMap=lyToMap(query.centerLy.x,query.centerLy.y),cells=this.buildCells(centerMap,query.radius),results=[];
      let checked=0,candidates=0;
      for(const cell of cells){
        if(cancelled())throw new Error("SEARCH_CANCELLED");
        const cellResults=this.processCell(cell.x,cell.y,query);
        results.push(...cellResults);candidates+=cellResults.length;checked++;
        results.sort((a,b)=>a.distance-b.distance||a.systemName.localeCompare(b.systemName)||a.objectIndex-b.objectIndex);
        if(results.length>MAX_RESULTS)results.length=MAX_RESULTS;
        const tenth=results[9];if(tenth&&cells[checked]?.minDistance>tenth.distance)break;
        if(checked%yieldEvery===0){progress({checked,total:cells.length,distance:cell.minDistance,candidates});await new Promise(resolve=>setTimeout(resolve,0));}
      }
      progress({checked,total:cells.length,distance:results[9]?.distance??query.radius,candidates,done:true});return results;
    }
  }

  const api={SearchEngine,classifyRealStar,mapToLy,lyToMap,minCellDistanceLy};
  globalThis.GalaxySearch=api;
  if(typeof window!=="undefined")window.GalaxySearch=api;
})();
