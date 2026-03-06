// Definimos la URL fija del Worker para evitar inputs innecesarios al usuario.
const DEFAULT_WORKER_URL = "https://bitter-meadow-5628.juanantoniosanchezplaza.workers.dev";

// Definimos la clave de localStorage donde persistimos la configuración del usuario.
const LS_KEY = "cercanias_config_v2";

// Definimos el tiempo de refresco de la aplicación en segundos.
const REFRESH_SECONDS = 60;

// Definimos el timeout máximo de red en milisegundos.
const TIMEOUT_MS = 12000;

// Definimos el endpoint GTFS-RT de actualizaciones de viaje.
const URL_TRIP_UPDATES = "https://gtfsrt.renfe.com/trip_updates.json";

// Definimos el endpoint GTFS-RT de posiciones de vehículo.
const URL_VEHICLE_POSITIONS = "https://gtfsrt.renfe.com/vehicle_positions.json";

// Definimos el endpoint GTFS-RT de incidencias y alertas.
const URL_ALERTS = "https://gtfsrt.renfe.com/alerts.json";

// Definimos el endpoint del dataset de estaciones normalizadas.
const URL_STATIONS = "./assets/data/estaciones_normalizadas.json";

// Referenciamos los nodos clave del DOM.
const statusLine = document.getElementById("statusLine");
const stationName = document.getElementById("stationName");
const stationSubtitle = document.getElementById("stationSubtitle");
const refreshLabel = document.getElementById("refreshLabel");
const trainsBox = document.getElementById("trains");
const incidenceBanner = document.getElementById("incidenceBanner");
const openConfigBtn = document.getElementById("openConfigBtn");
const configOverlay = document.getElementById("configOverlay");
const configBackdrop = document.getElementById("configBackdrop");
const closeConfigBtn = document.getElementById("closeConfigBtn");
const coreSelect = document.getElementById("coreSelect");
const localitySelect = document.getElementById("localitySelect");
const originSelect = document.getElementById("originSelect");
const destinationSelect = document.getElementById("destinationSelect");
const effectSelect = document.getElementById("effectSelect");
const useScheduleCheck = document.getElementById("useScheduleCheck");
const scheduleFields = document.getElementById("scheduleFields");
const outboundStartInput = document.getElementById("outboundStartInput");
const outboundEndInput = document.getElementById("outboundEndInput");
const returnStartInput = document.getElementById("returnStartInput");
const returnEndInput = document.getElementById("returnEndInput");
const debugCheck = document.getElementById("debugCheck");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const showQrBtn = document.getElementById("showQrBtn");
const debugToggle = document.getElementById("debugToggle");
const debugBox = document.getElementById("debugBox");
const qrOverlay = document.getElementById("qrOverlay");
const qrBackdrop = document.getElementById("qrBackdrop");
const closeQrBtn = document.getElementById("closeQrBtn");
const qrCanvas = document.getElementById("qrCanvas");
const qrUrlText = document.getElementById("qrUrlText");
const sharedConfigBanner = document.getElementById("sharedConfigBanner");
const applySharedConfigBtn = document.getElementById("applySharedConfigBtn");

// Definimos el estado global mínimo de la aplicación.
const state = {
  estaciones: [],
  config: null,
  debugOpen: false,
  pendingSharedConfig: null,
  refreshTimer: null
};

// Definimos una utilidad corta para crear elementos HTML.
function createNode(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

// Definimos una utilidad para normalizar textos.
function safeText(value) {
  return String(value ?? "").trim();
}

// Definimos una utilidad para escapar HTML antes de pintar texto dinámico.
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Definimos un logger simple para debug.
function createLogger() {
  const lines = [];
  return {
    push(message) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const line = `[${hh}:${mm}:${ss}] ${message}`;
      lines.push(line);
      if (state.config?.debug) {
        console.log(line);
      }
    },
    dump() {
      return lines.join("\n");
    },
    clear() {
      lines.length = 0;
    }
  };
}

// Creamos una instancia única del logger.
const logger = createLogger();

// Definimos la configuración por defecto de la aplicación.
function defaultConfig() {
  return {
    coreProvince: "Madrid",
    locality: "Madrid",
    originCode: "18000",
    destinationCode: "17000",
    useSchedule: true,
    outboundStart: "00:00",
    outboundEnd: "12:00",
    returnStart: "12:01",
    returnEnd: "23:59",
    effect: "splitflap",
    debug: false
  };
}

// Cargamos configuración desde localStorage o devolvemos defaults.
function loadConfig() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return defaultConfig();
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultConfig(), ...parsed };
  } catch {
    return defaultConfig();
  }
}

// Persistimos configuración en localStorage.
function saveConfig(config) {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

// Convertimos HH:MM a minutos desde medianoche.
function timeToMinutes(timeText) {
  const parts = String(timeText || "").split(":");
  const hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  return hh * 60 + mm;
}

// Determinamos si la hora actual cae dentro de un rango simple sin cruce de medianoche.
function isInsideSimpleRange(nowMinutes, startMinutes, endMinutes) {
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

// Calculamos si toca ida o vuelta en función de la configuración horaria.
function computeDirection(config) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const outboundStart = timeToMinutes(config.outboundStart);
  const outboundEnd = timeToMinutes(config.outboundEnd);
  const returnStart = timeToMinutes(config.returnStart);
  const returnEnd = timeToMinutes(config.returnEnd);

  if (!config.useSchedule) {
    return nowMinutes <= 12 * 60 ? "outbound" : "return";
  }

  if (isInsideSimpleRange(nowMinutes, outboundStart, outboundEnd)) return "outbound";
  if (isInsideSimpleRange(nowMinutes, returnStart, returnEnd)) return "return";
  return nowMinutes <= 12 * 60 ? "outbound" : "return";
}

// Cargamos el JSON de estaciones normalizadas.
async function loadStations() {
  const response = await fetch(URL_STATIONS, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudieron cargar las estaciones (${response.status}).`);
  const json = await response.json();
  const rawStations = Object.values(json?.estaciones || {});
  state.estaciones = rawStations.filter((item) => Boolean(item?.cercanias));
}

// Generamos el texto visual del núcleo según provincia.
function coreLabelByProvince(province) {
  if (province === "Barcelona") return "Rodalies Barcelona";
  if (province === "Valencia") return "Rodalies Valencia";
  return `Cercanías ${province}`;
}

// Obtenemos la lista de provincias con estaciones de cercanías.
function getCoreOptions() {
  const provinces = [...new Set(state.estaciones.map((item) => safeText(item.provincia)).filter(Boolean))];
  provinces.sort((a, b) => a.localeCompare(b, "es"));
  return provinces.map((province) => ({ value: province, label: coreLabelByProvince(province) }));
}

// Obtenemos localidades del núcleo actual.
function getLocalityOptions(coreProvince) {
  const options = state.estaciones
    .filter((item) => safeText(item.provincia) === safeText(coreProvince))
    .map((item) => safeText(item.poblacion))
    .filter(Boolean);
  return [...new Set(options)].sort((a, b) => a.localeCompare(b, "es"));
}

// Obtenemos estaciones filtradas por núcleo y localidad.
function getStationOptions(coreProvince, locality) {
  return state.estaciones
    .filter((item) => safeText(item.provincia) === safeText(coreProvince))
    .filter((item) => !locality || safeText(item.poblacion) === safeText(locality))
    .sort((a, b) => safeText(a.nombre).localeCompare(safeText(b.nombre), "es"));
}

// Rellenamos un select a partir de una lista simple.
function fillSelectSimple(select, values, selectedValue, getLabel) {
  select.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = getLabel ? getLabel(value) : String(value);
    if (String(value) === String(selectedValue)) option.selected = true;
    select.appendChild(option);
  }
}

// Rellenamos un select de estaciones sin mostrar códigos en el desplegable.
function fillStationSelect(select, stations, selectedCode) {
  select.innerHTML = "";
  for (const station of stations) {
    const option = document.createElement("option");
    option.value = String(station.codigo);
    option.textContent = safeText(station.nombre);
    if (String(station.codigo) === String(selectedCode)) option.selected = true;
    select.appendChild(option);
  }
}

// Sincronizamos todos los controles del drawer con la configuración.
function syncConfigUi() {
  const config = state.config;
  const cores = getCoreOptions();

  fillSelectSimple(coreSelect, cores.map((item) => item.value), config.coreProvince, (value) => {
    const found = cores.find((item) => item.value === value);
    return found ? found.label : value;
  });

  const localities = getLocalityOptions(config.coreProvince);
  const safeLocality = localities.includes(config.locality) ? config.locality : (localities[0] || "");
  config.locality = safeLocality;
  fillSelectSimple(localitySelect, localities, safeLocality);

  const stations = getStationOptions(config.coreProvince, config.locality);
  const stationCodes = stations.map((item) => String(item.codigo));

  if (!stationCodes.includes(String(config.originCode)) && stations[0]) {
    const fallbackAtocha = stations.find((item) => safeText(item.nombre).toLowerCase().includes("atocha"));
    config.originCode = String((fallbackAtocha || stations[0]).codigo);
  }

  if (!stationCodes.includes(String(config.destinationCode)) && stations[0]) {
    const fallbackChamartin = stations.find((item) => safeText(item.nombre).toLowerCase().includes("chamart"));
    const fallback = fallbackChamartin || stations[Math.min(1, stations.length - 1)] || stations[0];
    config.destinationCode = String(fallback.codigo);
  }

  fillStationSelect(originSelect, stations, config.originCode);
  fillStationSelect(destinationSelect, stations, config.destinationCode);

  effectSelect.value = config.effect;
  useScheduleCheck.checked = Boolean(config.useSchedule);
  scheduleFields.classList.toggle("hidden", !config.useSchedule);
  outboundStartInput.value = config.outboundStart;
  outboundEndInput.value = config.outboundEnd;
  returnStartInput.value = config.returnStart;
  returnEndInput.value = config.returnEnd;
  debugCheck.checked = Boolean(config.debug);
}

// Extraemos los prefijos candidatos de una estación para soportar 1700X / 1800X.
function buildStopPrefixes(stationCode) {
  const code = String(stationCode || "");
  const prefixes = [];
  if (code.length >= 4) prefixes.push(code.slice(0, 4));
  if (code.length >= 3) prefixes.push(code.slice(0, 3));
  if (code.length >= 2) prefixes.push(code.slice(0, 2));
  return [...new Set(prefixes.filter(Boolean))];
}

// Formateamos epoch a HH:MM.
function formatHHMM(epochSeconds) {
  const date = new Date(Number(epochSeconds) * 1000);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Extraemos la línea a partir del tripId.
function extractLine(tripId) {
  const match = String(tripId || "").match(/(C\d{1,2}[ab]?)/i);
  return match ? match[1].toUpperCase() : "";
}

// Extraemos número comercial del tren a partir del tripId.
function extractTrainNumber(tripId) {
  const match = String(tripId || "").match(/(\d{5})/);
  return match ? match[1] : "";
}

// Extraemos el andén si viene embebido en la etiqueta del vehículo.
function extractPlatformFromLabel(label) {
  const match = String(label || "").match(/PLATF\.?\((\d{1,2})\)/i);
  return match ? match[1] : "";
}

// Construimos la URL del Worker con el target encodeado.
function buildWorkerUrl(targetUrl) {
  return `${DEFAULT_WORKER_URL}/?target=${encodeURIComponent(targetUrl)}`;
}

// Descargamos JSON por el Worker con timeout.
async function loadJsonViaWorker(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(buildWorkerUrl(targetUrl), {
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Construimos el mapa tripId -> andén a partir de vehicle_positions.
function buildPlatformMap(vehiclePositionsJson) {
  const map = new Map();
  const entities = Array.isArray(vehiclePositionsJson?.entity) ? vehiclePositionsJson.entity : [];
  for (const entity of entities) {
    const vehicle = entity?.vehicle;
    const tripId = vehicle?.trip?.tripId || vehicle?.trip?.trip_id || "";
    const label = vehicle?.vehicle?.label || "";
    if (!tripId) continue;
    const platform = extractPlatformFromLabel(label);
    if (platform) map.set(tripId, platform);
  }
  return map;
}

// Normalizamos alertas GTFS-RT a una estructura simple.
function normalizeAlerts(alertsJson) {
  const entities = Array.isArray(alertsJson?.entity) ? alertsJson.entity : [];
  return entities
    .map((entity) => {
      const alert = entity?.alert || null;
      if (!alert) return null;
      const translations = alert?.descriptionText?.translation || alert?.description_text?.translation || [];
      const text = translations[0]?.text || "";
      const informed = Array.isArray(alert?.informedEntity || alert?.informed_entity) ? (alert?.informedEntity || alert?.informed_entity) : [];
      const routeIds = informed.map((item) => String(item?.routeId || item?.route_id || "")).filter(Boolean);
      const stopIds = informed.map((item) => String(item?.stopId || item?.stop_id || "")).filter(Boolean);
      return { text: String(text), routeIds, stopIds };
    })
    .filter(Boolean);
}

// Clasificamos el tipo de incidencia para pintar un icono distintivo.
function classifyAlertType(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("retras") || normalized.includes("demora") || normalized.includes("minut")) return "delay";
  if (normalized.includes("autob") || normalized.includes("bus") || normalized.includes("carretera")) return "bus";
  if (normalized.includes("ascensor") || normalized.includes("acceso") || normalized.includes("escalera")) return "access";
  return "warn";
}

// Obtenemos el icono visual de la incidencia.
function alertIcon(type) {
  if (type === "delay") return "⏱️🚆";
  if (type === "bus") return "🚌";
  if (type === "access") return "♿";
  return "⚠️";
}

// Filtramos incidencias relevantes por línea o prefijo de parada.
function getRelevantAlerts(alerts, line, prefixes) {
  const normalizedLine = String(line || "").toUpperCase();
  return alerts.filter((alert) => {
    const byRoute = alert.routeIds.some((item) => String(item).toUpperCase().includes(normalizedLine));
    const byStop = alert.stopIds.some((stopId) => prefixes.some((prefix) => String(stopId).startsWith(prefix)));
    const byText = String(alert.text).toUpperCase().includes(normalizedLine);
    return byRoute || byStop || byText;
  });
}

// Extraemos candidatos por prefijos del stopId.
function extractCandidatesByPrefixes(tripUpdatesJson, prefixes, platformMap, roleLabel, loggerInstance) {
  const candidates = [];
  const entities = Array.isArray(tripUpdatesJson?.entity) ? tripUpdatesJson.entity : [];

  for (const entity of entities) {
    const tripUpdate = entity?.tripUpdate;
    const tripId = tripUpdate?.trip?.tripId || "";
    if (!tripId) continue;

    const line = extractLine(tripId);
    if (!line) continue;

    const stopTimeUpdates = Array.isArray(tripUpdate?.stopTimeUpdate) ? tripUpdate.stopTimeUpdate : [];
    if (!stopTimeUpdates.length) continue;

    const firstUpdate = stopTimeUpdates[0];
    const stopId = String(firstUpdate?.stopId || "");
    if (!stopId) continue;
    if (!prefixes.some((prefix) => stopId.startsWith(prefix))) continue;

    const rawTime = firstUpdate?.arrival?.time ?? firstUpdate?.departure?.time ?? null;
    const timeEpoch = Number(rawTime);
    if (!timeEpoch || Number.isNaN(timeEpoch)) continue;

    candidates.push({
      tripId,
      trainNo: extractTrainNumber(tripId),
      line,
      stopId,
      timeEpoch,
      timeHHMM: formatHHMM(timeEpoch),
      platform: platformMap.get(tripId) || "—",
      role: roleLabel
    });
  }

  candidates.sort((a, b) => a.timeEpoch - b.timeEpoch);
  loggerInstance.push(`Candidatos ${roleLabel} (${prefixes.join(", ")}): ${candidates.length}`);
  return candidates;
}

// Aplicamos el efecto de cartel mecánico al texto de un nodo.
function applySplitFlapEffect(targetNode) {
  if (!targetNode) return;
  if (targetNode.dataset.flapDone === "1") return;
  const originalText = targetNode.textContent || "";
  targetNode.dataset.flapDone = "1";
  const wrapper = createNode("span", "splitflap");

  for (const char of originalText) {
    const flap = createNode("span", "flap");
    const inner = document.createElement("span");
    inner.textContent = char;
    flap.appendChild(inner);
    wrapper.appendChild(flap);
    flap.animate(
      [
        { transform: "rotateX(0deg)", opacity: 0.25 },
        { transform: "rotateX(65deg)", opacity: 0.55 },
        { transform: "rotateX(0deg)", opacity: 1 }
      ],
      {
        duration: 280 + Math.floor(Math.random() * 180),
        iterations: 1,
        easing: "cubic-bezier(.2,.7,.1,1)"
      }
    );
  }

  targetNode.textContent = "";
  targetNode.appendChild(wrapper);
}

// Renderizamos el banner general de incidencias.
function renderIncidenceBanner(linesWithAlerts) {
  if (!linesWithAlerts.length) {
    incidenceBanner.classList.add("hidden");
    incidenceBanner.innerHTML = "";
    return;
  }
  const labels = linesWithAlerts.slice(0, 3).join(", ");
  incidenceBanner.classList.remove("hidden");
  incidenceBanner.textContent = `Hay incidencias relevantes para tu ruta (${labels}). Pulsa los iconos de los trenes para ver el detalle.`;
}

// Renderizamos el listado de trenes.
function renderTrains(route, trains, effect) {
  trainsBox.innerHTML = "";

  if (!trains.length) {
    const empty = createNode("p", "muted");
    empty.textContent = "No hay trenes próximos encontrados.";
    trainsBox.appendChild(empty);
    return;
  }

  for (const [index, train] of trains.entries()) {
    const card = createNode("article", "train");
    if (effect === "glow") card.classList.add("effect-glow");

    const left = createNode("div", "train-left");
    const right = createNode("div", "train-right");

    const label = createNode("div", "train-label");
    label.textContent = `Tren ${index + 1} ${train.tripId}`;

    const time = createNode("div", "train-time");
    time.textContent = train.timeHHMM;

    const sub = createNode("div", "train-sub");
    sub.textContent = train.role === "ORIGIN" ? `Salida prevista: ${train.timeHHMM}` : `Hora estimada en destino: ${train.timeHHMM}`;

    const badge = createNode("div", "badge");
    badge.textContent = `Andén/Vía ${train.platform}`;

    const line = createNode("div", "line");
    line.textContent = `Línea ${train.line}`;

    left.appendChild(label);
    left.appendChild(time);
    left.appendChild(sub);

    right.appendChild(badge);
    right.appendChild(line);

    if (train.alerts?.length) {
      const incList = createNode("div", "inc-list");
      for (const alert of train.alerts.slice(0, 2)) {
        const btn = createNode("button", "inc-btn");
        btn.type = "button";
        btn.textContent = alertIcon(alert.type);
        btn.title = alert.text;
        btn.addEventListener("click", () => window.alert(alert.text));
        incList.appendChild(btn);
      }
      right.appendChild(incList);
    }

    card.appendChild(left);
    card.appendChild(right);
    trainsBox.appendChild(card);

    if (effect === "splitflap") {
      applySplitFlapEffect(time);
      applySplitFlapEffect(badge);
      applySplitFlapEffect(line);
    }
  }
}

// Renderizamos el debug si está abierto.
function renderDebug() {
  if (!state.debugOpen) return;
  debugBox.textContent = logger.dump() || "—";
}

// Mostramos u ocultamos el debug.
function toggleDebug() {
  state.debugOpen = !state.debugOpen;
  debugToggle.setAttribute("aria-expanded", state.debugOpen ? "true" : "false");
  debugBox.classList.toggle("hidden", !state.debugOpen);
  renderDebug();
}

// Abrimos el drawer de configuración.
function openConfig() {
  configOverlay.classList.remove("hidden");
}

// Cerramos el drawer de configuración.
function closeConfig() {
  configOverlay.classList.add("hidden");
}

// Abrimos el modal del QR.
function openQr() {
  qrOverlay.classList.remove("hidden");
}

// Cerramos el modal del QR.
function closeQr() {
  qrOverlay.classList.add("hidden");
}

// Construimos una URL compartible que incorpora la configuración en query string.
function buildShareUrl(config) {
  const json = JSON.stringify(config);
  const encoded = btoa(unescape(encodeURIComponent(json)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `${window.location.origin}${window.location.pathname}?cfg=${encoded}`;
}

// Decodificamos una configuración compartida desde la URL.
function parseSharedConfigFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("cfg");
  if (!raw) return null;

  try {
    const padded = raw.replaceAll("-", "+").replaceAll("_", "/");
    const base64 = padded + "=".repeat((4 - padded.length % 4) % 4);
    const json = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    return { ...defaultConfig(), ...parsed };
  } catch {
    return null;
  }
}

// Aplicamos y persistimos la configuración compartida pendiente.
function applyPendingSharedConfig() {
  if (!state.pendingSharedConfig) return;
  state.config = { ...defaultConfig(), ...state.pendingSharedConfig };
  saveConfig(state.config);
  syncConfigUi();
  sharedConfigBanner.classList.add("hidden");
  state.pendingSharedConfig = null;
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, "", cleanUrl);
  refreshRealtime().catch((error) => {
    logger.push(`ERROR al aplicar configuración compartida: ${String(error)}`);
    renderDebug();
  });
}

// Leemos la configuración actual desde la UI.
function readConfigFromUi() {
  return {
    coreProvince: coreSelect.value,
    locality: localitySelect.value,
    originCode: originSelect.value,
    destinationCode: destinationSelect.value,
    useSchedule: Boolean(useScheduleCheck.checked),
    outboundStart: outboundStartInput.value || "00:00",
    outboundEnd: outboundEndInput.value || "12:00",
    returnStart: returnStartInput.value || "12:01",
    returnEnd: returnEndInput.value || "23:59",
    effect: effectSelect.value || "splitflap",
    debug: Boolean(debugCheck.checked)
  };
}

// Renderizamos el QR de la configuración actual cargando la librería si hace falta.
async function renderQrForCurrentConfig() {
  const shareUrl = buildShareUrl(readConfigFromUi());
  qrUrlText.value = shareUrl;

  if (!window.QRCode || !window.QRCode.toCanvas) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  await window.QRCode.toCanvas(qrCanvas, shareUrl, { width: 260, margin: 1 });
}

// Refrescamos el panel de trenes usando la configuración activa.
async function refreshRealtime() {
  logger.clear();

  const config = state.config;
  const direction = computeDirection(config);
  const originCode = direction === "outbound" ? config.originCode : config.destinationCode;
  const destinationCode = direction === "outbound" ? config.destinationCode : config.originCode;
  const originStation = state.estaciones.find((item) => String(item.codigo) === String(originCode));
  const destinationStation = state.estaciones.find((item) => String(item.codigo) === String(destinationCode));

  const route = {
    originName: originStation ? safeText(originStation.nombre) : "—",
    destinationName: destinationStation ? safeText(destinationStation.nombre) : "—",
    originPrefixes: buildStopPrefixes(originCode),
    destinationPrefixes: buildStopPrefixes(destinationCode)
  };

  stationName.textContent = `Estación: ${route.originName}`;
  stationSubtitle.textContent = `Estos son los próximos trenes (${route.originName} → ${route.destinationName}).`;
  refreshLabel.textContent = `${REFRESH_SECONDS}s`;

  const now = new Date();
  statusLine.textContent = `${now.toLocaleTimeString("es-ES", { hour12: false })} · Actualizando…`;

  logger.push(`Ruta calculada: ${originCode} → ${destinationCode}`);
  logger.push(`Prefijos origen: [${route.originPrefixes.join(", ")}]`);
  logger.push(`Prefijos destino: [${route.destinationPrefixes.join(", ")}]`);

  const tripUpdates = await loadJsonViaWorker(URL_TRIP_UPDATES);
  const vehiclePositions = await loadJsonViaWorker(URL_VEHICLE_POSITIONS);

  let alerts = [];
  try {
    const alertsJson = await loadJsonViaWorker(URL_ALERTS);
    alerts = normalizeAlerts(alertsJson);
    logger.push(`Alertas cargadas: ${alerts.length}`);
  } catch {
    logger.push("Aviso: alerts.json no disponible (no bloquea la lista).");
  }

  const platformMap = buildPlatformMap(vehiclePositions);
  logger.push(`vehicle_positions: tripId mapeados = ${platformMap.size}`);

  const originCandidates = extractCandidatesByPrefixes(tripUpdates, route.originPrefixes, platformMap, "ORIGIN", logger);
  const destinationCandidates = extractCandidatesByPrefixes(tripUpdates, route.destinationPrefixes, platformMap, "DESTINATION", logger);

  let finalTrains = [];
  if (originCandidates.length >= 2) {
    finalTrains = originCandidates.slice(0, 2);
  } else if (originCandidates.length === 1) {
    finalTrains = [originCandidates[0]];
    const extra = destinationCandidates.find((candidate) => candidate.tripId !== originCandidates[0].tripId);
    if (extra) finalTrains.push(extra);
  } else {
    finalTrains = destinationCandidates.slice(0, 2);
  }

  const linesWithAlerts = [];
  for (const train of finalTrains) {
    const prefixes = train.role === "ORIGIN" ? route.originPrefixes : route.destinationPrefixes;
    train.alerts = getRelevantAlerts(alerts, train.line, prefixes).map((alert) => ({
      ...alert,
      type: classifyAlertType(alert.text)
    }));
    if (train.alerts.length && !linesWithAlerts.includes(train.line)) linesWithAlerts.push(train.line);
  }

  renderIncidenceBanner(linesWithAlerts);
  renderTrains(route, finalTrains, config.effect);

  statusLine.textContent = `${new Date().toLocaleTimeString("es-ES", { hour12: false })} · Actualizado.`;
  renderDebug();
}

// Programamos el refresco periódico del panel.
function scheduleRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    refreshRealtime().catch((error) => {
      logger.push(`ERROR: ${String(error)}`);
      renderDebug();
    });
  }, REFRESH_SECONDS * 1000);
}

// Inicializamos eventos del panel de configuración.
function bindEvents() {
  openConfigBtn.addEventListener("click", openConfig);
  closeConfigBtn.addEventListener("click", closeConfig);
  configBackdrop.addEventListener("click", closeConfig);
  qrBackdrop.addEventListener("click", closeQr);
  closeQrBtn.addEventListener("click", closeQr);
  debugToggle.addEventListener("click", toggleDebug);

  coreSelect.addEventListener("change", () => {
    state.config.coreProvince = coreSelect.value;
    const localities = getLocalityOptions(state.config.coreProvince);
    state.config.locality = localities[0] || "";
    syncConfigUi();
  });

  localitySelect.addEventListener("change", () => {
    state.config.locality = localitySelect.value;
    syncConfigUi();
  });

  useScheduleCheck.addEventListener("change", () => {
    scheduleFields.classList.toggle("hidden", !useScheduleCheck.checked);
  });

  saveConfigBtn.addEventListener("click", () => {
    state.config = readConfigFromUi();
    saveConfig(state.config);
    syncConfigUi();
    closeConfig();
    refreshRealtime().catch((error) => {
      logger.push(`ERROR al refrescar tras guardar: ${String(error)}`);
      renderDebug();
    });
  });

  showQrBtn.addEventListener("click", async () => {
    try {
      await renderQrForCurrentConfig();
      openQr();
    } catch (error) {
      window.alert(`No se pudo generar el QR: ${String(error)}`);
    }
  });

  applySharedConfigBtn.addEventListener("click", applyPendingSharedConfig);
}

// Arrancamos la aplicación cuando el DOM está listo.
window.addEventListener("DOMContentLoaded", async () => {
  try {
    state.pendingSharedConfig = parseSharedConfigFromUrl();
    if (state.pendingSharedConfig) sharedConfigBanner.classList.remove("hidden");

    state.config = loadConfig();
    await loadStations();
    syncConfigUi();
    bindEvents();
    await refreshRealtime();
    scheduleRefresh();
  } catch (error) {
    statusLine.textContent = `${new Date().toLocaleTimeString("es-ES", { hour12: false })} · Error al iniciar.`;
    trainsBox.innerHTML = `<p class="muted">No se pudo iniciar la aplicación.</p>`;
    console.error(error);
  }
});
