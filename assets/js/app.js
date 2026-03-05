import { loadJson, Storage, Dom, Time, SplitFlap, renderQrToCanvas, readQrFromImageFile } from "./lib.js";

const STORAGE_KEY = "cercanias_panel_config_v2";
const PATH_ESTACIONES = "./assets/data/estaciones_normalizadas.json";
const PATH_RED = "./assets/data/red_cercanias.json";

// [cambiar_por_url_woker] Sustituye esta URL por la de tu Worker real (o configúralo en ⚙).
const DEFAULT_WORKER_URL = "[cambiar_por_url_woker]https://bitter-meadow-5628.juanantoniosanchezplaza.workers.dev";

const GTFS_TRIP_UPDATES = "https://gtfsrt.renfe.com/trip_updates.json";
const GTFS_VEHICLE_POSITIONS = "https://gtfsrt.renfe.com/vehicle_positions.json";
const GTFS_ALERTS = "https://gtfsrt.renfe.com/alerts.json";

const TRAINS_TO_SHOW = 2;

const DEFAULT_CONFIG = {
  provincia: "",
  poblacion: "",
  origen: "18000",
  destino: "17000",
  style: "splitflap",
  refreshSeconds: 60,
  debug: false,
  workerUrl: DEFAULT_WORKER_URL
};

const state = {
  refreshTimer: null,
  clockTimer: null,
  estaciones: null,
  red: null,
  config: null,
  isUpdating: false,
  lastRelevantAlerts: []
};

const ui = {
  clock: document.getElementById("uiClock"),
  status: document.getElementById("uiStatus"),
  stationTitle: document.getElementById("uiStationTitle"),
  subtitle: document.getElementById("uiSubtitle"),
  alert: document.getElementById("uiAlert"),
  alertText: document.getElementById("uiAlertText"),
  trains: document.getElementById("uiTrains"),
  refreshInfo: document.getElementById("uiRefreshInfo"),
  debugWrap: document.getElementById("uiDebugWrap"),
  debugBox: document.getElementById("uiDebug"),
  configDrawer: document.getElementById("configDrawer"),
  configBackdrop: document.getElementById("configBackdrop"),
  btnOpenConfig: document.getElementById("btnOpenConfig"),
  btnCloseConfig: document.getElementById("btnCloseConfig"),
  btnOpenQr: document.getElementById("btnOpenQr"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  btnCloseModal: document.getElementById("btnCloseModal"),
  modalBody: document.getElementById("modalBody"),
  incBanner: document.getElementById("uiIncidenciasBanner"),
  incBannerText: document.getElementById("uiIncidenciasBannerText"),
  btnIncDetails: document.getElementById("btnIncidenciasDetails"),
  qrOverlay: document.getElementById("qrOverlay"),
  qrBackdrop: document.getElementById("qrBackdrop"),
  btnCloseQr: document.getElementById("btnCloseQr"),
  qrCanvas: document.getElementById("qrCanvas"),
  qrImportFile: document.getElementById("qrImportFile"),
  btnQrImport: document.getElementById("btnQrImport"),
  btnQrCopy: document.getElementById("btnQrCopy"),
  qrDebug: document.getElementById("qrDebug"),
  cfgProvincia: document.getElementById("cfgProvincia"),
  cfgPoblacion: document.getElementById("cfgPoblacion"),
  cfgOrigen: document.getElementById("cfgOrigen"),
  cfgDestino: document.getElementById("cfgDestino"),
  cfgStyle: document.getElementById("cfgStyle"),
  cfgRefresh: document.getElementById("cfgRefresh"),
  cfgWorkerUrl: document.getElementById("cfgWorkerUrl"),
  cfgDebug: document.getElementById("cfgDebug"),
  btnSaveConfig: document.getElementById("btnSaveConfig"),
  btnResetConfig: document.getElementById("btnResetConfig")
};

boot().catch((err)=>{
  ui.status.textContent="Error al iniciar.";
  setAlert(`Fallo al iniciar: ${String(err?.message||err)}`);
});

async function boot(){
  startClock();
  state.config = loadConfig();
  ui.refreshInfo.textContent = `Refresco: ${state.config.refreshSeconds}s`;
  wireUiEvents();
  await loadStaticData();
  initConfigSelects();
  applyConfigToUi();
  await refreshRealtime();
  scheduleRefresh();
}

function startClock(){
  tickClock();
  if(state.clockTimer) clearInterval(state.clockTimer);
  state.clockTimer=setInterval(tickClock, 500);
}

function tickClock(){
  const d=new Date();
  ui.clock.textContent = `${Time.pad2(d.getHours())}:${Time.pad2(d.getMinutes())}:${Time.pad2(d.getSeconds())}`;
}

async function loadStaticData(){
  const estacionesJson = await loadJson(PATH_ESTACIONES);
  state.estaciones = estacionesJson?.estaciones || {};
  const redJson = await loadJson(PATH_RED);
  state.red = redJson?.estaciones || {};
}

function loadConfig(){
  const raw = Storage.get(STORAGE_KEY);
  if(!raw) return {...DEFAULT_CONFIG};
  const parsed = Storage.safeJsonParse(raw);
  if(!parsed || typeof parsed!=="object") return {...DEFAULT_CONFIG};
  return {...DEFAULT_CONFIG, ...parsed};
}

function saveConfig(next){
  Storage.set(STORAGE_KEY, JSON.stringify(next));
}

function wireUiEvents(){
  ui.btnOpenConfig.addEventListener("click", ()=>openConfigDrawer());
  ui.btnCloseConfig.addEventListener("click", ()=>closeConfigDrawer());
  ui.configBackdrop.addEventListener("click", ()=>closeConfigDrawer());
  ui.btnOpenQr.addEventListener("click", ()=>openQrOverlay().catch(e=>setQrDebug(String(e?.message||e))));
  ui.btnCloseModal.addEventListener("click", ()=>closeModal());
  ui.modalBackdrop.addEventListener("click", ()=>closeModal());
  ui.btnCloseQr.addEventListener("click", ()=>closeQrOverlay());
  ui.qrBackdrop.addEventListener("click", ()=>closeQrOverlay());
  ui.cfgProvincia.addEventListener("change", ()=>onProvinciaChange());
  ui.cfgPoblacion.addEventListener("change", ()=>onPoblacionChange());
  ui.btnSaveConfig.addEventListener("click", ()=>onSaveConfig());
  ui.btnResetConfig.addEventListener("click", ()=>onResetConfig());
  ui.btnIncDetails.addEventListener("click", ()=>openIncidenciasModal());
  ui.btnQrImport.addEventListener("click", ()=>importQrConfig().catch(e=>setQrDebug(String(e?.message||e))));
  ui.btnQrCopy.addEventListener("click", ()=>copyConfigJson().catch(e=>setQrDebug(String(e?.message||e))));
}

function initConfigSelects(){
  const estacionesList = Object.values(state.estaciones).filter((e)=>Boolean(e?.cercanias));
  const provincias = Dom.uniqueSorted(estacionesList.map((e)=>Dom.safeText(e.provincia)));
  Dom.fillSelect(ui.cfgProvincia, ["", ...provincias], (v)=>v? v : "— Selecciona provincia —");
  ui.cfgProvincia.value = state.config.provincia || "";
  onProvinciaChange();
}

function onProvinciaChange(){
  const provincia = ui.cfgProvincia.value || "";
  state.config.provincia = provincia;
  const estacionesList = Object.values(state.estaciones).filter((e)=>Boolean(e?.cercanias));
  const filtered = provincia ? estacionesList.filter((e)=>Dom.safeText(e.provincia)===provincia) : estacionesList;
  const poblaciones = Dom.uniqueSorted(filtered.map((e)=>Dom.safeText(e.poblacion)));
  Dom.fillSelect(ui.cfgPoblacion, ["", ...poblaciones], (v)=>v? v : "— Selecciona localidad —");
  ui.cfgPoblacion.value = state.config.poblacion || "";
  onPoblacionChange();
}

function onPoblacionChange(){
  const provincia = ui.cfgProvincia.value || "";
  const poblacion = ui.cfgPoblacion.value || "";
  state.config.poblacion = poblacion;
  const estacionesList = Object.values(state.estaciones).filter((e)=>Boolean(e?.cercanias));
  const filteredProvincia = provincia ? estacionesList.filter((e)=>Dom.safeText(e.provincia)===provincia) : estacionesList;
  const filtered = poblacion ? filteredProvincia.filter((e)=>Dom.safeText(e.poblacion)===poblacion) : filteredProvincia;
  const options = filtered.map((e)=>({value:e.codigo, label:`${Dom.safeText(e.nombre)} (${e.codigo})`})).sort((a,b)=>a.label.localeCompare(b.label,"es"));
  Dom.fillSelectFromObjects(ui.cfgOrigen, options, "— Selecciona estación origen —");
  Dom.fillSelectFromObjects(ui.cfgDestino, options, "— Selecciona estación destino —");
  Dom.setSelectValueIfExists(ui.cfgOrigen, state.config.origen);
  Dom.setSelectValueIfExists(ui.cfgDestino, state.config.destino);
  ui.cfgStyle.value = state.config.style;
  ui.cfgRefresh.value = String(state.config.refreshSeconds);
  ui.cfgWorkerUrl.value = state.config.workerUrl || "";
  ui.cfgDebug.checked = Boolean(state.config.debug);
}

function applyConfigToUi(){
  const origen = state.estaciones?.[state.config.origen]?.nombre || state.config.origen;
  const destino = state.estaciones?.[state.config.destino]?.nombre || state.config.destino;
  ui.stationTitle.textContent = `Estación: ${origen}`;
  ui.subtitle.textContent = `Estos son los próximos trenes (${origen} → ${destino}).`;
  ui.debugWrap.classList.toggle("d-none", !state.config.debug);
  ui.incBanner.classList.add("d-none");
}

async function onSaveConfig(){
  const next={
    provincia: ui.cfgProvincia.value||"",
    poblacion: ui.cfgPoblacion.value||"",
    origen: ui.cfgOrigen.value || state.config.origen,
    destino: ui.cfgDestino.value || state.config.destino,
    style: ui.cfgStyle.value || "normal",
    refreshSeconds: Number(ui.cfgRefresh.value||60),
    debug: Boolean(ui.cfgDebug.checked),
    workerUrl: ui.cfgWorkerUrl.value || DEFAULT_WORKER_URL
  };
  saveConfig(next);
  state.config=next;
  applyConfigToUi();
  closeConfigDrawer();
  scheduleRefresh();
  await refreshRealtime();
}

async function onResetConfig(){
  saveConfig({...DEFAULT_CONFIG});
  state.config={...DEFAULT_CONFIG};
  initConfigSelects();
  applyConfigToUi();
  scheduleRefresh();
  await refreshRealtime();
}

function openConfigDrawer(){
  ui.configDrawer.classList.add("is-open");
  ui.configDrawer.setAttribute("aria-hidden","false");
}

function closeConfigDrawer(){
  ui.configDrawer.classList.remove("is-open");
  ui.configDrawer.setAttribute("aria-hidden","true");
}

function setAlert(message){
  if(!message){
    ui.alert.classList.add("d-none");
    ui.alertText.textContent="";
    return;
  }
  ui.alertText.textContent=message;
  ui.alert.classList.remove("d-none");
}

function debugLog(line){
  if(!state.config.debug) return;
  const msg = `[${Time.nowHHMMSS()}] ${line}`;
  ui.debugBox.textContent = ui.debugBox.textContent==="—" ? msg : `${ui.debugBox.textContent}\n${msg}`;
}

function scheduleRefresh(){
  if(state.refreshTimer) clearInterval(state.refreshTimer);
  ui.refreshInfo.textContent = `Refresco: ${state.config.refreshSeconds}s`;
  state.refreshTimer=setInterval(()=>refreshRealtime().catch(()=>{}), state.config.refreshSeconds*1000);
}

function buildWorkerUrl(workerBase, target){
  const base=String(workerBase||"").replace(/\/$/,"");
  return `${base}/?target=${encodeURIComponent(target)}`;
}

async function fetchViaWorkerJson(targetUrl, timeoutMs){
  const url = buildWorkerUrl(state.config.workerUrl, targetUrl);
  return await loadJson(url, timeoutMs);
}

function computeRoute(origen, destino){
  if(origen===destino) return [origen];
  const q=[origen];
  const prev=new Map();
  prev.set(origen,null);
  while(q.length){
    const node=q.shift();
    const edges=state.red?.[node]?.conexiones || [];
    for(const e of edges){
      const next=e?.destino;
      if(!next) continue;
      if(prev.has(next)) continue;
      prev.set(next,node);
      if(next===destino){
        const out=[];
        let cur=destino;
        while(cur!==null){out.unshift(cur); cur=prev.get(cur);}
        return out;
      }
      q.push(next);
    }
  }
  return null;
}

function buildVehicleMap(vehicleJson){
  const map=new Map();
  const entities=Array.isArray(vehicleJson?.entity)? vehicleJson.entity : [];
  for(const ent of entities){
    const v=ent?.vehicle;
    const tripId=v?.trip?.trip_id || v?.trip?.tripId || "";
    if(!tripId) continue;
    const label=v?.vehicle?.label || "";
    const platform=Dom.extractPlatformFromLabel(label);
    const line=(Dom.extractLineFromLabel(label) || Dom.extractLineFromTripId(tripId) || "").toUpperCase();
    map.set(tripId,{line, platform: platform || "—", label});
  }
  return map;
}

function selectNextTrains(tripUpdatesJson, vehicleMap, origenCode, destinoCode, limit){
  const nowEpoch=Time.nowEpochSeconds();
  const candidates=[];
  const entities=Array.isArray(tripUpdatesJson?.entity)? tripUpdatesJson.entity : [];
  for(const ent of entities){
    const tu=ent?.tripUpdate || ent?.trip_update;
    if(!tu) continue;
    const tripId=tu?.trip?.tripId || tu?.trip?.trip_id || "";
    if(!tripId) continue;
    const stus=tu?.stopTimeUpdate || tu?.stop_time_update || [];
    if(!Array.isArray(stus) || !stus.length) continue;
    const stopsInTrip=new Set(stus.map(s=>String(s?.stopId || s?.stop_id || "")));
    if(!stopsInTrip.has(String(origenCode))) continue;
    if(!stopsInTrip.has(String(destinoCode))) continue;
    const originUpdate=stus.find(s=>String(s?.stopId || s?.stop_id || "")===String(origenCode));
    if(!originUpdate) continue;
    const t=Number(originUpdate?.departure?.time || originUpdate?.arrival?.time || 0);
    if(!t || t<=nowEpoch) continue;
    const v=vehicleMap.get(tripId) || {line:"",platform:"—"};
    candidates.push({
      tripId,
      timeEpoch:t,
      timeText:Time.toLocalHHMM(t),
      departureText:Time.toLocalHHMM(originUpdate?.departure?.time || originUpdate?.arrival?.time),
      line:(v.line || Dom.extractLineFromTripId(tripId) || "").toUpperCase(),
      platform:v.platform || "—",
      alerts:[]
    });
  }
  candidates.sort((a,b)=>a.timeEpoch-b.timeEpoch);
  return candidates.slice(0,limit);
}

function extractTranslation(field){
  const arr=field?.translation;
  if(!Array.isArray(arr)) return "";
  const es=arr.find(t=>String(t?.language||t?.lang||"").toLowerCase().startsWith("es"));
  if(es?.text) return String(es.text);
  return arr[0]?.text ? String(arr[0].text) : "";
}

function classifyAlertType(text){
  const t=String(text||"").toLowerCase();
  if(t.includes("retras") || t.includes("demora") || t.includes("minut")) return "delay";
  if(t.includes("autob") || t.includes("bus") || t.includes("carretera")) return "bus";
  if(t.includes("ascensor") || t.includes("escalera") || t.includes("acces")) return "access";
  if(t.includes("obra") || t.includes("infraestructura") || t.includes("manten")) return "works";
  return "general";
}

function normalizeAlert(alert){
  if(!alert) return null;
  const id=String(alert?.id||"") || String(Date.now());
  const desc=extractTranslation(alert?.descriptionText || alert?.description_text) || "";
  const header=extractTranslation(alert?.headerText || alert?.header_text) || "";
  const informed=Array.isArray(alert?.informedEntity || alert?.informed_entity) ? (alert?.informedEntity || alert?.informed_entity) : [];
  const stopIds=informed.map(x=>String(x?.stopId || x?.stop_id || "")).filter(v=>v);
  const routeIds=informed.map(x=>String(x?.routeId || x?.route_id || "")).filter(v=>v);
  const fullText=`${header}\n${desc}`.trim();
  const type=classifyAlertType(fullText);
  return {id, header, desc, fullText, type, stopIds, routeIds};
}

function isAlertRelevant(alert, train, stopIdsTramo){
  if(alert.stopIds.some(s=>stopIdsTramo.includes(String(s)))) return true;
  if(alert.routeIds.some(r=>String(r).toUpperCase().includes(String(train.line||"").toUpperCase()))) return true;
  const txt=String(alert.fullText||"").toUpperCase();
  if(train.line && txt.includes(train.line.toUpperCase())) return true;
  return false;
}

function attachAlertsToTrains(trains, alertsJson, origenCode, destinoCode){
  const entities=Array.isArray(alertsJson?.entity)? alertsJson.entity : [];
  const alerts=entities.map(e=>normalizeAlert(e?.alert || e?.Alert)).filter(Boolean);
  if(!alerts.length) return trains;
  for(const t of trains){
    const stopIds=[String(origenCode), String(destinoCode)];
    const relevant=alerts.filter(a=>isAlertRelevant(a,t,stopIds));
    t.alerts=relevant;
    for(const a of relevant){
      if(!state.lastRelevantAlerts.some(x=>x.id===a.id)) state.lastRelevantAlerts.push(a);
    }
  }
  return trains;
}

function iconForAlertType(type){
  if(type==="delay") return "⏱️🚆";
  if(type==="bus") return "🚌";
  if(type==="access") return "♿";
  if(type==="works") return "🛠️";
  return "⚠️";
}

function buildIncIconsHtml(alerts){
  if(!alerts?.length) return "";
  const limited=alerts.slice(0,2);
  const buttons=limited.map(a=>{
    const icon=iconForAlertType(a.type);
    const label=a.header || "Incidencia";
    return `<button type="button" class="inc-btn" data-inc-id="${Dom.escapeHtml(a.id)}" aria-label="${Dom.escapeHtml(label)}">${Dom.escapeHtml(icon)}</button>`;
  }).join("");
  return `<div class="train-inc-icons">${buttons}</div>`;
}

function wireIncButtons(){
  const btns=ui.trains.querySelectorAll(".inc-btn");
  for(const b of btns){
    b.addEventListener("click", ()=>{
      const id=b.getAttribute("data-inc-id")||"";
      const a=state.lastRelevantAlerts.find(x=>x.id===id);
      openModal(a ? `<div class="fw-bold mb-2">${Dom.escapeHtml(iconForAlertType(a.type))} ${Dom.escapeHtml(a.header||"Incidencia")}</div><div>${Dom.escapeHtml(a.desc||a.fullText||"")}</div>` : "No se encontró el detalle de esta incidencia.");
    });
  }
}

function renderIncidenciasBanner(){
  if(!state.lastRelevantAlerts.length){
    ui.incBanner.classList.add("d-none");
    return;
  }
  ui.incBannerText.textContent = state.lastRelevantAlerts.length===1 ? "Hay 1 incidencia relevante para tu ruta." : `Hay ${state.lastRelevantAlerts.length} incidencias relevantes para tu ruta.`;
  ui.incBanner.classList.remove("d-none");
}

function openIncidenciasModal(){
  if(!state.lastRelevantAlerts.length){
    openModal("No hay incidencias relevantes en este momento.");
    return;
  }
  const html=state.lastRelevantAlerts.map(a=>`<div class="mb-3"><div class="fw-bold">${Dom.escapeHtml(iconForAlertType(a.type))} ${Dom.escapeHtml(a.header||"Incidencia")}</div><div class="text-secondary small">${Dom.escapeHtml(a.desc||a.fullText||"")}</div></div>`).join("");
  openModal(html);
}

function openModal(contentHtml){
  ui.modalBody.innerHTML=contentHtml;
  ui.modalOverlay.classList.remove("d-none");
  ui.modalOverlay.setAttribute("aria-hidden","false");
}

function closeModal(){
  ui.modalOverlay.classList.add("d-none");
  ui.modalOverlay.setAttribute("aria-hidden","true");
}

async function openQrOverlay(){
  setQrDebug("—");
  const json=JSON.stringify(state.config);
  await renderQrToCanvas(ui.qrCanvas, json);
  ui.qrOverlay.classList.remove("d-none");
  ui.qrOverlay.setAttribute("aria-hidden","false");
}

function closeQrOverlay(){
  ui.qrOverlay.classList.add("d-none");
  ui.qrOverlay.setAttribute("aria-hidden","true");
}

function setQrDebug(text){
  ui.qrDebug.textContent=String(text||"—");
}

async function importQrConfig(){
  const file=ui.qrImportFile.files?.[0];
  if(!file) throw new Error("Selecciona una imagen con un QR primero.");
  const raw=await readQrFromImageFile(file);
  const parsed=Storage.safeJsonParse(raw);
  if(!parsed || typeof parsed!=="object") throw new Error("El QR no contiene un JSON de configuración válido.");
  const next={...DEFAULT_CONFIG, ...parsed};
  saveConfig(next);
  state.config=next;
  initConfigSelects();
  applyConfigToUi();
  scheduleRefresh();
  await refreshRealtime();
  setQrDebug("Configuración importada y aplicada correctamente.");
}

async function copyConfigJson(){
  const json=JSON.stringify(state.config, null, 2);
  if(!navigator.clipboard?.writeText) throw new Error("Tu navegador no permite copiar al portapapeles.");
  await navigator.clipboard.writeText(json);
  setQrDebug("JSON copiado al portapapeles.");
}

function renderTrains(trains, style){
  if(!trains.length){
    ui.trains.innerHTML=Dom.infoBox("No hay trenes próximos encontrados.");
    return;
  }
  ui.trains.innerHTML=trains.map((t,idx)=>{
    const incIcons=buildIncIconsHtml(t.alerts||[]);
    return `
      <article class="train-tile" data-trip="${Dom.escapeHtml(t.tripId)}">
        <div class="train-row">
          <div class="train-time">
            <div class="small mono">Tren ${idx+1} ${Dom.escapeHtml(t.tripId)}</div>
            <div class="big" data-field="time">${Dom.escapeHtml(t.timeText)}</div>
            <div class="small">Salida prevista: <strong data-field="dep">${Dom.escapeHtml(t.departureText)}</strong></div>
          </div>
          <div class="train-tags">
            <div class="tag"><span>Andén</span> <strong data-field="platform">${Dom.escapeHtml(t.platform)}</strong></div>
            <div class="small mt-2">Línea: <strong data-field="line">${Dom.escapeHtml(t.line)}</strong></div>
            ${incIcons}
          </div>
        </div>
      </article>`;
  }).join("");
  wireIncButtons();
  if(style!=="splitflap") return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for(const tile of ui.trains.querySelectorAll(".train-tile")){
    SplitFlap.apply(tile.querySelector('[data-field="time"]'));
    SplitFlap.apply(tile.querySelector('[data-field="dep"]'));
    SplitFlap.apply(tile.querySelector('[data-field="platform"]'));
    SplitFlap.apply(tile.querySelector('[data-field="line"]'));
  }
}

async function refreshRealtime(){
  if(state.isUpdating) return;
  state.isUpdating=true;
  setAlert("");
  ui.status.textContent="Actualizando…";
  if(state.config.debug) ui.debugBox.textContent="—";
  state.lastRelevantAlerts=[];

  try{
    const route=computeRoute(state.config.origen, state.config.destino);
    if(!route || route.length<2){
      setAlert("No se encontró ruta entre origen y destino con el grafo actual.");
      ui.trains.innerHTML=Dom.infoBox("No hay trenes próximos encontrados.");
      ui.status.textContent="Actualizado.";
      return;
    }
    debugLog(`Ruta calculada: ${route.join(" → ")}`);
    const tramoOrigen=route[0];
    const tramoDestino=route[1];
    const origenName=state.estaciones?.[tramoOrigen]?.nombre || tramoOrigen;
    const destinoName=state.estaciones?.[tramoDestino]?.nombre || tramoDestino;
    ui.stationTitle.textContent=`Estación: ${origenName}`;
    ui.subtitle.textContent=`Estos son los próximos trenes (${origenName} → ${destinoName}).`;

    const tripUpdates=await fetchViaWorkerJson(GTFS_TRIP_UPDATES, 25000);
    const vehicles=await fetchViaWorkerJson(GTFS_VEHICLE_POSITIONS, 25000);
    const alerts=await fetchViaWorkerJson(GTFS_ALERTS, 25000);

    const vehicleMap=buildVehicleMap(vehicles);
    debugLog(`vehicle_positions: tripId mapeados = ${vehicleMap.size}`);

    const trains=selectNextTrains(tripUpdates, vehicleMap, tramoOrigen, tramoDestino, TRAINS_TO_SHOW);
    const enriched=attachAlertsToTrains(trains, alerts, tramoOrigen, tramoDestino);
    renderTrains(enriched, state.config.style);
    renderIncidenciasBanner();
    ui.status.textContent="Actualizado.";
  }catch(err){
    ui.status.textContent="Error al actualizar.";
    setAlert(`Fallo: ${String(err?.message||err)}`);
    ui.trains.innerHTML=Dom.infoBox("No hay trenes próximos encontrados.");
    debugLog(`ERROR: ${String(err?.stack||err)}`);
  }finally{
    state.isUpdating=false;
  }
}
