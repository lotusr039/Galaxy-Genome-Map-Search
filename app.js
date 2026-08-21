const YEARS_PER_PIXEL=43.74,SOL_MAP_X=1025,SOL_MAP_Y=1591;
const state={centerMode:"name",targetMode:"planet",center:null,centerChoices:[],resolvedName:"",results:[],selected:null,view:{x:SOL_MAP_X,y:SOL_MAP_Y,zoom:1.8},mapImage:new Image(),worker:null,workerReady:false,requestId:0,pendingResolve:new Map(),activeSearch:null,dragging:null};
const $=selector=>document.querySelector(selector);
const elements={form:$("#searchForm"),centerName:$("#centerNameInput"),namePanel:$("#nameCenterPanel"),coordPanel:$("#coordCenterPanel"),choices:$("#centerChoices"),x:$("#xInput"),y:$("#yInput"),targetType:$("#targetTypeSelect"),targetLabel:$("#targetTypeLabel"),radius:$("#radiusInput"),resultLimit:$("#resultLimitInput"),excludeFixed:$("#excludeFixed"),excludeNamed:$("#excludeNamed"),search:$("#searchButton"),cancel:$("#cancelButton"),results:$("#results"),count:$("#resultCount"),progress:$("#searchProgress"),details:$("#details"),status:$("#dataStatus"),canvas:$("#mapCanvas"),template:$("#resultTemplate")};

const TYPE_NAMES={
  EarthLikePlanet:"类地行星",AmmoniaPlanet:"氨行星",GasGiantwithAmmoniaLife:"具有氨寿命的气体巨行星",
  HeliumRichGasGiant:"富氦气体巨行星",GasGiantClassI:"气体行星 I 级别",GasGiantClassII:"气体行星 II 级别",
  GasGiantClassIII:"气体行星 III 级别",GasGiantClassIV:"气体行星 IV 级别",GasGiantClassV:"气体行星 V 级别",
  GasGiantwithWaterLife:"具有水生命的气体巨行星",HighMetalPlanet:"高金属行星",IcePlanet:"冰行星",
  MetalRichPlanet:"富金属行星",RockPlanet:"岩石行星",WaterGiant:"水体巨行星",WaterWorld:"水世界",
  "Y-BrownDwarf":"Y - 褐矮星",Asteroids:"小行星带",
  "M-RedDwarf":"M - 红矮星","K-YellowOrange":"K - 黄橙主序","G-WhiteYellow":"G - 白黄主序",
  "F-White":"F - 白色主序","A-BlueWhite":"A - 蓝白主序","B-BlueWhite":"B - 蓝白主序","O-BlueWhite":"O - 蓝白主序",
  WolfRayetStar:"沃尔夫-雷耶特类恒星","WC-WolfRayetStar":"WC - 沃尔夫-雷耶特类恒星",
  "WN-WolfRayetStar":"WN - 沃尔夫-雷耶特类恒星","WNC-WolfRayetStar":"WNC - 沃尔夫-雷耶特类恒星",
  "WO-WolfRayetStar":"WO - 沃尔夫-雷耶特类恒星","DA-WhiteDwarf":"DA - 白矮星",
  "DAV-WhiteDwarf":"DAV - 白矮星","DAZ-WhiteDwarf":"DAZ - 白矮星","DB-WhiteDwarf":"DB - 白矮星",
  "DBV-WhiteDwarf":"DBV - 白矮星","DC-WhiteDwarf":"DC - 白矮星","DCV-WhiteDwarf":"DCV - 白矮星",
  "DO-WhiteDwarf":"DO -白矮星","DOV-WhiteDwarf":"DOV - 白矮星","DQ-WhiteDwarf":"DQ - 白矮星","DX-WhiteDwarf":"DX - 白矮星",
  HerbigAeStar:"赫比格Ae恒星",HerbigBeStar:"赫比格Be恒星","L-BrownDwarf":"L - 褐矮星","T-BrownDwarf":"T - 褐矮星",
  TauriG:"金牛座 G",TauriK:"金牛座 K",TauriF:"金牛座 F",TauriM:"金牛座 M",BursterPulsar:"中子星",
  RadioPulsar:"脉冲行星",MillisecondPulsar:"毫秒脉冲星",SoftGammaRepeaterMagnetar:"软伽马中继行星",
  "AnomalousX-rayMagnetar":"高能X射线脉冲星",Quarkstar:"夸克行星",Preonstar:"前子星",BlackHole:"黑洞",
  "K-RedGiant":"K -橙色巨星","M-RedGiant":"M - 红色巨星","G-YellowGiant":"G - 黄色巨星","F-YellowGiant":"F - 黄色巨星",
  "M-RedSupergiant":"M - 红色超巨星","F-YellowSupergiant":"F - 黄色超巨星",
  "A-BlueWhiteSupergiant":"A - 蓝白色超巨星","B-BlueWhiteSupergiant":"B - 蓝白超巨星",
  "O-BlueSupergiant":"O - 蓝色超巨星","O-Hypergiant":"O - 蓝色超巨星","CarbonC-RStar":"碳星",
  "CarbonC-HdStar":"碳星","CarbonC-HStar":"碳星","CarbonC-JStar":"碳星","CarbonC-NStar":"C-N 碳星",
  "CarbonC-SStar":"C-S 碳星","CarbonM-SStar":"M-S 碳星","S-Star":"S级恒星"
};
const MINERAL_NAMES={Diamonds:"钻石",Alexandrite:"亚历山大石",Bouxite:"铝土矿",Gallite:"镓石",Coltan:"钶钽铁矿",Bromellite:"溴锂石",Rutile:"金红石",Uraninite:"铀矿",Monazite:"独居石",Painite:"铝硼锆钙石",Lepidolite:"锂云母",LithiumHydroxide:"氢氧化锂",MethaneClathrate:"甲烷水合物",VoidOpal:"虚空蛋白石",Musgravite:"镁塔菲石"};
const SURFACE_MATERIAL_NAMES={Sulphur:"硫磺",Selenium:"硒",Manganese:"锰",Nickel:"镍",Vanadium:"钒",Chromium:"铬",Iron:"铁",Polonium:"钋",Tellurium:"碲",Cadmium:"镉",Germanium:"锗",Phosphorus:"磷",Carbon:"碳"};

function number(value,digits=2){return Number(value).toLocaleString("zh-CN",{maximumFractionDigits:digits});}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);}
function mapToLy(x,y){return{x:(x-SOL_MAP_X)*YEARS_PER_PIXEL,y:(SOL_MAP_Y-y)*YEARS_PER_PIXEL};}
function lyToMap(x,y){return{x:x/YEARS_PER_PIXEL+SOL_MAP_X,y:-y/YEARS_PER_PIXEL+SOL_MAP_Y};}

async function imagePixels(image,src){image.src=src;await image.decode();const canvas=document.createElement("canvas");canvas.width=canvas.height=2048;const context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(image,0,0);return context.getImageData(0,0,2048,2048).data;}

async function loadData(){
  const rgbImage=new Image(),densityImage=new Image();
  const [stars,planetPayload,sectorPayload,starTypePayload,pixelConversion,rgbPixels,densityPixels]=await Promise.all([
    fetch("data/starsDBv2.json").then(response=>response.json()),fetch("data/PlanetsDB.json").then(response=>response.json()),fetch("data/Sectors.json").then(response=>response.json()),fetch("data/StarTypes.json").then(response=>response.json()),fetch("data/PixelConversion.bin").then(response=>response.arrayBuffer()),imagePixels(rgbImage,"map/galaxyMapRGB.png"),imagePixels(densityImage,"map/galaxyMapBW.png")
  ]);
  state.mapImage.src="map/galaxyMapColor.png";await state.mapImage.decode();fillTargetTypes();
  state.worker=new Worker("search-worker.js");state.worker.onmessage=handleWorkerMessage;state.worker.onerror=event=>showError(event.message||"搜索器运行失败");
  state.worker.postMessage({type:"init",data:{stars,planets:planetPayload.planets||[],sectors:sectorPayload.sec||[],starConfigs:starTypePayload.starTypes||[],pixelConversion,rgbPixels,densityPixels}});
  elements.status.textContent=`${number(stars.length,0)} 个真实恒星 · ${number(planetPayload.planets?.length||0,0)} 个固定天体`;elements.status.classList.add("ready");
}

function typeName(value){return `${value}(${TYPE_NAMES[value]||value})`;}
function mineralName(value){return `${value}(${MINERAL_NAMES[value]||value})`;}
function surfaceMaterialName(value){return `${value}(${SURFACE_MATERIAL_NAMES[value]||value})`;}
function fillTargetTypes(){const values=state.targetMode==="planet"?GalaxyGenerator.getPlanetTypes():state.targetMode==="star"?GalaxyGenerator.getStarTypes():GalaxyGenerator.getMineralTypes();const all=document.createElement("option");all.value="";all.textContent="全部";elements.targetType.replaceChildren(all,...[...new Set(values)].sort().map(value=>{const option=document.createElement("option");option.value=value;option.textContent=state.targetMode==="mineral"?mineralName(value):typeName(value);return option;}));elements.targetLabel.textContent=state.targetMode==="planet"?"行星类型":state.targetMode==="star"?"恒星类型":"矿石类型";}
function handleWorkerMessage(event){
  const message=event.data;if(message.type==="ready"){state.workerReady=true;elements.search.disabled=false;elements.progress.textContent="等待搜索";return;}
  if(message.type==="resolved"){const pending=state.pendingResolve.get(message.requestId);if(pending){state.pendingResolve.delete(message.requestId);pending.resolve(message.choices);}return;}
  if(message.requestId!==state.activeSearch)return;
  if(message.type==="progress")elements.progress.textContent=message.done?"正在整理结果":`已检查 ${message.checked}/${message.total} 格 · ${number(message.distance,0)} ly · ${number(message.candidates,0)} 个候选`;
  else if(message.type==="results")finishSearch(message.results);else if(message.type==="error"){setSearching(false);showError(message.message);}
}
function resolveName(name){const requestId=++state.requestId;return new Promise(resolve=>{state.pendingResolve.set(requestId,{resolve});state.worker.postMessage({type:"resolve",requestId,name});});}
elements.centerName.addEventListener("input",()=>{state.centerChoices=[];state.resolvedName="";elements.choices.hidden=true;});

function setSegment(container,mode){container.querySelectorAll("button").forEach(button=>button.classList.toggle("active",button.dataset.mode===mode));}
$("#centerMode").addEventListener("click",event=>{const mode=event.target.dataset.mode;if(!mode)return;state.centerMode=mode;setSegment($("#centerMode"),mode);elements.namePanel.hidden=mode!=="name";elements.choices.hidden=true;elements.coordPanel.hidden=mode!=="coords";elements.centerName.required=mode==="name";elements.x.required=elements.y.required=mode==="coords";});
$("#targetMode").addEventListener("click",event=>{const mode=event.target.dataset.mode;if(!mode)return;state.targetMode=mode;setSegment($("#targetMode"),mode);fillTargetTypes();});

function renderCenterChoices(choices){elements.choices.replaceChildren();if(choices.length<2){elements.choices.hidden=true;return;}choices.forEach((choice,index)=>{const label=document.createElement("label");label.className="center-choice";const input=document.createElement("input");input.type="radio";input.name="centerChoice";input.value=String(index);const text=document.createElement("span");text.textContent=`候选 ${index+1} · LY ${number(choice.xLy)}, ${number(choice.yLy)}`;label.append(input,text);elements.choices.append(label);});elements.choices.hidden=false;}
async function getCenter(){
  if(state.centerMode==="coords"){const x=Number(elements.x.value),y=Number(elements.y.value);if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error("请输入有效的 X/Y 光年坐标");const map=lyToMap(x,y);return{xLy:x,yLy:y,mapX:map.x,mapY:map.y,label:`LY ${number(x)}, ${number(y)}`};}
  const name=elements.centerName.value.trim();if(!name)throw new Error("请输入中心星系名称");
  if(state.resolvedName!==name.toLowerCase()){state.centerChoices=await resolveName(name);state.resolvedName=name.toLowerCase();renderCenterChoices(state.centerChoices);}
  if(!state.centerChoices.length)throw new Error("没有找到该中心星系，请检查名称");
  if(state.centerChoices.length>1&&!elements.choices.querySelector("input:checked")){elements.progress.textContent="请选择中心星系对应的光年坐标";return null;}
  const selected=Number(elements.choices.querySelector("input:checked")?.value||0);return state.centerChoices[selected];
}

elements.form.addEventListener("submit",async event=>{event.preventDefault();if(!state.workerReady)return;try{const radius=Number(elements.radius.value),resultLimit=Number(elements.resultLimit.value);if(!Number.isFinite(radius)||radius<1||radius>40000)throw new Error("搜索半径必须在 1 到 40000 光年之间");if(!Number.isInteger(resultLimit)||resultLimit<1||resultLimit>1000)throw new Error("结果数量必须是 1 到 1000 之间的整数");const center=await getCenter();if(!center)return;state.center=center;state.view.x=center.mapX;state.view.y=center.mapY;const requestId=++state.requestId;state.activeSearch=requestId;setSearching(true);state.results=[];state.selected=null;renderResults();drawMap();state.worker.postMessage({type:"search",requestId,query:{centerLy:{x:center.xLy,y:center.yLy},radius,resultLimit,targetMode:state.targetMode,targetType:elements.targetType.value,excludeFixed:elements.excludeFixed.checked,excludeNamed:elements.excludeNamed.checked}});}catch(error){showError(error.message);}});
elements.cancel.addEventListener("click",()=>{state.worker?.postMessage({type:"cancel"});state.activeSearch=null;setSearching(false);elements.progress.textContent="搜索已取消";});
function setSearching(searching){elements.search.disabled=searching||!state.workerReady;elements.cancel.hidden=!searching;elements.search.textContent=searching?"搜索中":"搜索最近目标";}
function finishSearch(results){state.results=results;state.activeSearch=null;setSearching(false);elements.progress.textContent=results.length?(state.targetMode==="mineral"?`已返回含量最高的 ${results.length} 个星系`:`已返回最近 ${results.length} 个星系`):"范围内没有匹配目标";renderResults();drawMap();if(results.length)selectResult(results[0]);else renderEmpty("没有匹配目标","请更换类型、扩大范围或调整排除选项。");}

function renderResults(){elements.results.replaceChildren();elements.count.textContent=`${state.results.length} 个星系`;for(const result of state.results){const node=elements.template.content.firstElementChild.cloneNode(true),matched=result.matchedObjects||[result],types=[...new Set(matched.map(item=>item.type))];node.dataset.id=result.id;node.querySelector("strong").textContent=result.systemName;if(result.kind==="mineral"){const item=matched[0];node.querySelector("small").textContent=matched.length===1?`A${item.objectIndex} · ${mineralName(item.type)} · ${number(result.distance)} ly`:`匹配 ${matched.length} 处 · ${types.map(mineralName).join("、")} · ${number(result.distance)} ly`;node.querySelector(".distance").textContent=result.matchedObjects.some(match=>match.resourceKind==="deep"&&match.abundance===result.abundance)?`深层 ${number(result.abundance,0)}%`:`最高 ${number(result.abundance,0)}%`;}else{if(matched.length===1){const item=matched[0];node.querySelector("small").textContent=item.kind==="planet"?`A${item.objectIndex} · ${item.type} · 主恒星 ${item.starType}`:`恒星 ${item.objectIndex} · ${item.type}${item.subtype?` · ${item.subtype}`:""}`;}else node.querySelector("small").textContent=`匹配 ${matched.length} 个${result.kind==="planet"?"行星":"恒星"} · ${types.join("、")}`;node.querySelector(".distance").textContent=`${number(result.distance)} ly`;}node.addEventListener("click",()=>selectResult(result));elements.results.append(node);}}
function selectResult(result){state.selected=result;elements.results.querySelectorAll(".result-item").forEach(node=>node.classList.toggle("active",node.dataset.id===result.id));renderDetails(result);drawMap();}
function renderDetails(result){
  const matched=result.matchedObjects||[result],matchTypes=[...new Set(matched.map(item=>result.kind==="mineral"?mineralName(item.type):typeName(item.type)))];
  const match=result.kind==="mineral"?`当前匹配 ${matched.length} 处矿石 · ${matchTypes.join("、")} · 最高含量 ${number(result.abundance,0)}%`:matched.length===1?(result.kind==="planet"?`当前匹配 A${result.objectIndex} · ${typeName(result.type)} · 所属恒星 ${result.starType}`:`当前匹配 恒星 ${result.objectIndex} · ${result.type}${result.subtype?` · ${result.subtype}`:""}`):`当前匹配 ${matched.length} 个${result.kind==="planet"?"行星":"恒星"} · ${matchTypes.join("、")}`;
  const source=result.source==="generated"?"程序星系":result.fixed?"固定行星系统":"具名真实星系";
  const planets=result.systemPlanets||[];
  const rows=planets.map(planet=>{
    const label=`A${planet.objectIndex}${planet.name?` · ${planet.name}`:""}`;
    const orbit=planet.orbit==null?"-":planet.orbitTo!=null&&planet.orbitTo!==planet.orbit?`${number(planet.orbit,0)}-${number(planet.orbitTo,0)}`:number(planet.orbit,0);
    const normalResources=planet.resources?.map(resource=>`<span class="resource-item"><b>${escapeHtml(mineralName(resource.name))}</b><small>${Math.floor(resource.chance)}%</small></span>`).join("")||"";
    const surfaceResources=planet.surfaceMaterials?.map(material=>`<span class="resource-item"><b>${escapeHtml(surfaceMaterialName(material.name))}</b><small>${number(Math.floor(material.chance*10)/10,1)}%</small></span>`).join("")||"";
    const deepResources=matched.filter(item=>item.kind==="mineral"&&item.resourceKind==="deep"&&item.objectIndex===planet.objectIndex).map(resource=>`<span class="resource-item"><b>${escapeHtml(mineralName(resource.type))}</b><small>深层 ${number(resource.abundance,0)}%</small></span>`).join("");
    const resources=normalResources+surfaceResources+deepResources||"<span class=\"resource-empty\">-</span>";
    return`<tr><td>${escapeHtml(label)}</td><td class="type-tag">${escapeHtml(typeName(planet.type))}</td><td>${escapeHtml(planet.starType)}</td><td>${orbit}</td><td class="resource-cell">${resources}</td></tr>`;
  }).join("");
  const planetSection=planets.length?`<h3 class="table-title">星系内天体（${planets.length}）</h3><div class="table-scroll"><table class="planet-table"><thead><tr><th>序号 / 名称</th><th>行星类型</th><th>所属恒星</th><th>轨道距离</th><th>资源</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="notice">该星系没有生成行星。</div>`;
  elements.details.classList.remove("empty");
  elements.details.innerHTML=`<div class="detail-head"><div><h2>${escapeHtml(result.systemName)}</h2><p>${escapeHtml(match)} · ${source} · 距中心 ${number(result.distance)} ly</p></div><div class="coord-pills"><span>LY ${number(result.xLy)}, ${number(result.yLy)}</span></div></div>${planetSection}`;
}
function renderEmpty(title,message){state.selected=null;elements.details.className="details empty";elements.details.innerHTML=`<div class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;}
function showError(message){elements.progress.textContent="无法搜索";renderEmpty("输入或搜索错误",message);}

function resizeCanvas(){const rect=elements.canvas.getBoundingClientRect(),scale=window.devicePixelRatio||1;elements.canvas.width=Math.round(rect.width*scale);elements.canvas.height=Math.round(rect.height*scale);drawMap();}
function project(mapX,mapY){const scale=18*state.view.zoom;return{x:elements.canvas.width/2+(mapX-state.view.x)*scale,y:elements.canvas.height/2+(mapY-state.view.y)*scale};}
function drawMap(){const context=elements.canvas.getContext("2d"),width=elements.canvas.width,height=elements.canvas.height;context.clearRect(0,0,width,height);context.fillStyle="#05080a";context.fillRect(0,0,width,height);if(state.mapImage.complete&&state.mapImage.naturalWidth){const scale=18*state.view.zoom,dx=width/2-state.view.x*scale,dy=height/2-state.view.y*scale;context.globalAlpha=.62;context.drawImage(state.mapImage,dx-88*scale,dy-188*scale,2048*1.11*scale,2048*1.11*scale);context.globalAlpha=1;}if(state.center){const point=project(state.center.mapX,state.center.mapY);context.strokeStyle="#f0b45a";context.lineWidth=2;context.beginPath();context.moveTo(point.x-9,point.y);context.lineTo(point.x+9,point.y);context.moveTo(point.x,point.y-9);context.lineTo(point.x,point.y+9);context.stroke();}for(const result of state.results){const point=project(result.mapX,result.mapY);if(point.x< -10||point.y< -10||point.x>width+10||point.y>height+10)continue;context.fillStyle=state.selected?.id===result.id?"#fff":"#52d3c7";context.beginPath();context.arc(point.x,point.y,state.selected?.id===result.id?5:3,0,Math.PI*2);context.fill();}}

$("#zoomIn").addEventListener("click",()=>{state.view.zoom=Math.min(12,state.view.zoom*1.35);drawMap();});$("#zoomOut").addEventListener("click",()=>{state.view.zoom=Math.max(.25,state.view.zoom/1.35);drawMap();});$("#resetMap").addEventListener("click",()=>{const target=state.center||{mapX:SOL_MAP_X,mapY:SOL_MAP_Y};state.view.x=target.mapX;state.view.y=target.mapY;state.view.zoom=1.8;drawMap();});
elements.canvas.addEventListener("pointerdown",event=>{state.dragging={x:event.clientX,y:event.clientY,viewX:state.view.x,viewY:state.view.y};elements.canvas.setPointerCapture(event.pointerId);});elements.canvas.addEventListener("pointermove",event=>{if(!state.dragging)return;const scale=18*state.view.zoom/(window.devicePixelRatio||1);state.view.x=state.dragging.viewX-(event.clientX-state.dragging.x)/scale;state.view.y=state.dragging.viewY-(event.clientY-state.dragging.y)/scale;drawMap();});elements.canvas.addEventListener("pointerup",()=>{state.dragging=null;});elements.canvas.addEventListener("wheel",event=>{event.preventDefault();state.view.zoom=Math.max(.25,Math.min(12,state.view.zoom*(event.deltaY<0?1.15:.87)));drawMap();},{passive:false});window.addEventListener("resize",resizeCanvas);
loadData().then(resizeCanvas).catch(error=>{console.error(error);elements.status.textContent="数据库载入失败";showError("请通过 HTTP 静态服务器打开页面。");});
