// Creamos un logger para debug
const debugLog = makeLogger();

// Definimos IDs base para Atocha (prefijo 18xxx)
const PREFIX_ATOCHA = "18";

// Definimos IDs base para Chamartín (prefijo 17xxx)
const PREFIX_CHAMARTIN = "17";

// Definimos el nombre amigable de Atocha
const NAME_ATOCHA = "Madrid-Puerta de Atocha";

// Definimos el nombre amigable de Chamartín
const NAME_CHAMARTIN = "Madrid-Chamartín";

// Definimos el refresh en segundos
const REFRESH_SECONDS = 60;

// Definimos timeout para red
const TIMEOUT_MS = 12000;

// Definimos claves de localStorage
const LS_KEY = "cercanias_config_v1";

// Definimos endpoints GTFS-RT
const URL_TRIP_UPDATES = "https://gtfsrt.renfe.com/trip_updates.json";

// Definimos endpoint de posiciones
const URL_VEHICLE_POSITIONS = "https://gtfsrt.renfe.com/vehicle_positions.json";

// Definimos endpoint de alertas
const URL_ALERTS = "https://gtfsrt.renfe.com/alerts.json";

// Definimos un worker por defecto (vacío para que el usuario lo configure)
//const DEFAULT_WORKER_URL = ""; // [cambiar_por_url_woker]
const DEFAULT_WORKER_URL = "https://bitter-meadow-5628.juanantoniosanchezplaza.workers.dev";

// Definimos líneas permitidas para el caso Atocha ↔ Chamartín (ajusta si quieres)
const ALLOWED_LINES = new Set(["C2", "C3", "C4A", "C4B", "C7", "C8", "C10", "C1"]);

// Referenciamos el contenedor de trenes
const trainsBox = $("#trains");

// Referenciamos el nombre de estación
const stationName = $("#stationName");

// Referenciamos el subtítulo
const stationSubtitle = $("#stationSubtitle");

// Referenciamos línea de estado
const statusLine = $("#statusLine");

// Referenciamos etiqueta refresh
const refreshLabel = $("#refreshLabel");

// Referenciamos toggle de debug
const debugToggle = $("#debugToggle");

// Referenciamos caja debug
const debugBox = $("#debugBox");

// Definimos un estado global de UI
const state = {
  // Guardamos si debug está abierto
  debugOpen: false,
  // Guardamos config activa
  config: null
};

// Cargamos configuración desde localStorage o defaults
const loadConfig = () => {
  // Intentamos leer raw
  const raw = localStorage.getItem(LS_KEY);
  // Si existe intentamos parsear
  if (raw) {
    // Intentamos parsear con try/catch
    try {
      // Parseamos
      const parsed = JSON.parse(raw);
      // Devolvemos config saneada
      return {
        // Worker definido por usuario o default
        workerUrl: normalizeWorkerUrl(parsed.workerUrl || DEFAULT_WORKER_URL),
        // Permitimos override manual de modo si existe
        modeOverride: parsed.modeOverride || "",
        // Permitimos override manual de origen/destino por prefijo
        originPrefix: parsed.originPrefix || "",
        // Permitimos override manual de destino por prefijo
        destPrefix: parsed.destPrefix || ""
      };
    } catch {
      // Si falla devolvemos defaults
      return {
        workerUrl: normalizeWorkerUrl(DEFAULT_WORKER_URL),
        modeOverride: "",
        originPrefix: "",
        destPrefix: ""
      };
    }
  }
  // Si no hay nada devolvemos defaults
  return {
    workerUrl: normalizeWorkerUrl(DEFAULT_WORKER_URL),
    modeOverride: "",
    originPrefix: "",
    destPrefix: ""
  };
};

// Guardamos configuración en localStorage
const saveConfig = (cfg) => {
  // Guardamos como JSON
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
};

// Calculamos el modo según la hora local
const computeModeByTime = () => {
  // Creamos fecha actual
  const now = new Date();
  // Extraemos horas
  const h = now.getHours();
  // Extraemos minutos
  const m = now.getMinutes();
  // Convertimos a minutos totales
  const total = h * 60 + m;
  // Si es antes de 12:00 usamos Atocha -> Chamartín
  if (total <= 12 * 60) return "ATOCHA_TO_CHAMARTIN";
  // Si es después usamos Chamartín -> Atocha
  return "CHAMARTIN_TO_ATOCHA";
};

// Obtenemos origen/destino en función del modo
const getRouteForMode = (mode) => {
  // Si es mañana devolvemos Atocha->Chamartín
  if (mode === "ATOCHA_TO_CHAMARTIN") {
    // Devolvemos datos de ruta
    return {
      originName: NAME_ATOCHA,
      destName: NAME_CHAMARTIN,
      originPrefix: PREFIX_ATOCHA,
      destPrefix: PREFIX_CHAMARTIN
    };
  }
  // Devolvemos Chamartín->Atocha
  return {
    originName: NAME_CHAMARTIN,
    destName: NAME_ATOCHA,
    originPrefix: PREFIX_CHAMARTIN,
    destPrefix: PREFIX_ATOCHA
  };
};

// Actualizamos la UI de cabecera para el modo
const renderHeader = (route) => {
  // Pintamos estación principal (origen “en función de la hora”)
  stationName.textContent = `Estación: ${route.originName}`;
  // Pintamos subtítulo con dirección
  stationSubtitle.textContent = `Estos son los próximos trenes (${route.originName} → ${route.destName}).`;
};

// Construimos un mapa tripId -> andén si existe en vehicle_positions
const buildPlatformMap = (vehiclePositionsJson) => {
  // Creamos mapa
  const map = new Map();
  // Si no hay entidades devolvemos vacío
  if (!vehiclePositionsJson || !Array.isArray(vehiclePositionsJson.entity)) return map;
  // Recorremos entidades
  for (const ent of vehiclePositionsJson.entity) {
    // Extraemos vehicle
    const vehicle = ent && ent.vehicle ? ent.vehicle : null;
    // Saltamos si no hay vehicle
    if (!vehicle) continue;
    // Extraemos tripId
    const tripId = vehicle.trip && vehicle.trip.tripId ? vehicle.trip.tripId : "";
    // Saltamos si no hay tripId
    if (!tripId) continue;
    // Extraemos label si existe
    const label = vehicle.vehicle && vehicle.vehicle.label ? vehicle.vehicle.label : "";
    // Extraemos andén del label
    const platform = extractPlatformFromLabel(label);
    // Si hay andén lo guardamos
    if (platform) map.set(tripId, platform);
  }
  // Devolvemos mapa
  return map;
};

// Extraemos candidatos desde trip_updates filtrando por prefijo
const extractCandidatesByPrefix = (tripUpdatesJson, prefix, platformMap, roleLabel) => {
  // Creamos array de candidatos
  const candidates = [];
  // Si no hay entidades devolvemos vacío
  if (!tripUpdatesJson || !Array.isArray(tripUpdatesJson.entity)) return candidates;
  // Recorremos entidades
  for (const ent of tripUpdatesJson.entity) {
    // Extraemos tripUpdate
    const tu = ent && ent.tripUpdate ? ent.tripUpdate : null;
    // Saltamos si no hay tripUpdate
    if (!tu) continue;
    // Extraemos tripId
    const tripId = tu.trip && tu.trip.tripId ? tu.trip.tripId : "";
    // Saltamos si no hay tripId
    if (!tripId) continue;
    // Extraemos línea
    const line = extractLine(tripId);
    // Saltamos si no hay línea
    if (!line) continue;
    // Filtramos por líneas permitidas
    if (!ALLOWED_LINES.has(line)) continue;
    // Extraemos número tren
    const trainNo = extractTrainNumber(tripId);
    // Extraemos stopTimeUpdate
    const stus = Array.isArray(tu.stopTimeUpdate) ? tu.stopTimeUpdate : [];
    // Saltamos si no hay updates
    if (stus.length === 0) continue;
    // Tomamos el primer stopTimeUpdate (feed a veces trae uno solo)
    const stu0 = stus[0];
    // Extraemos stopId
    const stopId = stu0 && stu0.stopId ? String(stu0.stopId) : "";
    // Saltamos si no hay stopId
    if (!stopId) continue;
    // Filtramos por prefijo requerido
    if (!stopId.startsWith(prefix)) continue;
    // Extraemos hora (arrival o departure)
    const t =
      (stu0.arrival && typeof stu0.arrival.time === "string" ? parseInt(stu0.arrival.time, 10) : null) ??
      (stu0.arrival && typeof stu0.arrival.time === "number" ? stu0.arrival.time : null) ??
      (stu0.departure && typeof stu0.departure.time === "string" ? parseInt(stu0.departure.time, 10) : null) ??
      (stu0.departure && typeof stu0.departure.time === "number" ? stu0.departure.time : null);
    // Saltamos si no hay tiempo
    if (!t || Number.isNaN(t)) continue;
    // Extraemos andén del mapa si existe
    const platform = platformMap.get(tripId) || "—";
    // Guardamos candidato
    candidates.push({
      tripId,
      trainNo,
      line,
      stopId,
      timeEpoch: t,
      timeHHMM: formatHHMM(t),
      platform,
      role: roleLabel
    });
  }
  // Ordenamos por hora ascendente
  candidates.sort((a, b) => a.timeEpoch - b.timeEpoch);
  // Devolvemos
  return candidates;
};

// Renderizamos una lista de trenes (máximo 2)
const renderTrains = (route, trains) => {
  // Limpiamos contenedor
  trainsBox.innerHTML = "";
  // Si no hay trenes mostramos mensaje
  if (!trains || trains.length === 0) {
    // Creamos un párrafo
    const p = el("p", "muted");
    // Escribimos texto
    p.textContent = "No hay trenes próximos encontrados.";
    // Añadimos
    trainsBox.appendChild(p);
    // Salimos
    return;
  }
  // Iteramos trenes
  trains.forEach((t, idx) => {
    // Creamos tarjeta de tren
    const card = el("div", "train");
    // Creamos columna izquierda
    const left = el("div", "train-left");
    // Creamos etiqueta superior
    const label = el("div", "train-label");
    // Definimos texto de etiqueta
    label.textContent = `Tren ${idx + 1} ${t.tripId}`;
    // Creamos hora grande
    const time = el("div", "train-time");
    // Pintamos hora
    time.textContent = t.timeHHMM;
    // Creamos subtexto
    const sub = el("div", "train-sub");
    // Elegimos texto según si es origen o fallback destino
    sub.textContent = t.role === "ORIGEN"
      ? `Salida prevista: ${t.timeHHMM}`
      : `Hora estimada en destino: ${t.timeHHMM}`;
    // Añadimos label
    left.appendChild(label);
    // Añadimos hora
    left.appendChild(time);
    // Añadimos sub
    left.appendChild(sub);

    // Creamos columna derecha
    const right = el("div", "train-right");
    // Creamos badge andén
    const badge = el("div", "badge");
    // Pintamos andén
    badge.textContent = `Andén/Vía ${t.platform}`;
    // Creamos línea
    const line = el("div", "line");
    // Pintamos línea
    line.textContent = `Línea ${t.line}`;
    // Añadimos badge
    right.appendChild(badge);
    // Añadimos línea
    right.appendChild(line);

    // Montamos columnas
    card.appendChild(left);
    // Montamos columnas
    card.appendChild(right);
    // Añadimos tarjeta
    trainsBox.appendChild(card);
  });
};

// Renderizamos debug en caja
const renderDebug = (text) => {
  // Si debug está cerrado no pintamos nada visualmente
  if (!state.debugOpen) return;
  // Pintamos texto
  debugBox.textContent = text || "—";
};

// Alternamos debug abierto/cerrado
const toggleDebug = () => {
  // Cambiamos estado
  state.debugOpen = !state.debugOpen;
  // Ajustamos aria
  debugToggle.setAttribute("aria-expanded", state.debugOpen ? "true" : "false");
  // Mostramos u ocultamos
  debugBox.classList.toggle("hidden", !state.debugOpen);
  // Si abrimos, volcamos log actual
  if (state.debugOpen) renderDebug(debugLog.dump());
};

// Cargamos JSON vía worker (si está configurado)
const fetchViaWorkerJson = async (workerUrl, targetUrl) => {
  // Construimos URL final
  const url = buildWorkerUrl(workerUrl, targetUrl);
  // Cargamos JSON con timeout
  return await loadJson(url, TIMEOUT_MS);
};

// Refrescamos datos en tiempo real
const refreshRealtime = async () => {
  // Limpiamos log en cada ciclo
  debugLog.clear();

  // Cargamos config actual
  state.config = loadConfig();

  // Calculamos modo por hora o override
  const mode = state.config.modeOverride ? state.config.modeOverride : computeModeByTime();

  // Obtenemos ruta según modo
  const baseRoute = getRouteForMode(mode);

  // Aplicamos overrides de prefijos si el usuario lo puso
  const route = {
    ...baseRoute,
    originPrefix: state.config.originPrefix || baseRoute.originPrefix,
    destPrefix: state.config.destPrefix || baseRoute.destPrefix
  };

  // Renderizamos cabecera
  renderHeader(route);

  // Log de ruta
  debugLog.push(`Ruta calculada: ${route.originPrefix}000 → ${route.destPrefix}000`);

  // Pintamos estado “cargando”
  statusLine.textContent = `${new Date().toLocaleTimeString("es-ES", { hour12: false })} · Cargando…`;

  // Pintamos etiqueta refresh
  refreshLabel.textContent = `${REFRESH_SECONDS}s`;

  // Descargamos trip_updates
  const tripUpdates = await fetchViaWorkerJson(state.config.workerUrl, URL_TRIP_UPDATES);

  // Descargamos vehicle_positions
  const vehiclePositions = await fetchViaWorkerJson(state.config.workerUrl, URL_VEHICLE_POSITIONS);

  // Intentamos cargar alertas (si falla, no debe bloquear trenes)
  let alertsOk = false;
  // Intentamos
  try {
    // Descargamos alertas
    await fetchViaWorkerJson(state.config.workerUrl, URL_ALERTS);
    // Marcamos ok
    alertsOk = true;
  } catch {
    // Logueamos fallo suave
    debugLog.push("Aviso: alerts.json no disponible (no bloquea la lista de trenes).");
  }

  // Construimos mapa de andenes
  const platformMap = buildPlatformMap(vehiclePositions);

  // Logueamos cuenta de tripId mapeados
  debugLog.push(`vehicle_positions: tripId mapeados = ${platformMap.size}`);

  // Extraemos candidatos por ORIGEN (prefijo origen)
  const originCandidates = extractCandidatesByPrefix(tripUpdates, route.originPrefix, platformMap, "ORIGEN");

  // Logueamos cuantos hay
  debugLog.push(`Candidatos ORIGEN (${route.originPrefix}xx): ${originCandidates.length}`);

  // Si no hay suficientes, extraemos fallback por DESTINO
  const destCandidates = extractCandidatesByPrefix(tripUpdates, route.destPrefix, platformMap, "DESTINO");

  // Logueamos cuantos hay
  debugLog.push(`Candidatos DESTINO (${route.destPrefix}xx): ${destCandidates.length}`);

  // Construimos lista final
  let final = [];

  // Si hay al menos 2 en origen, tomamos esos
  if (originCandidates.length >= 2) {
    // Tomamos dos primeros
    final = originCandidates.slice(0, 2);
  } else if (originCandidates.length === 1) {
    // Empezamos con el único
    final = [originCandidates[0]];
    // Añadimos el primero de destino que no duplique tripId
    const extra = destCandidates.find((d) => d.tripId !== originCandidates[0].tripId);
    // Si existe lo añadimos
    if (extra) final.push(extra);
  } else {
    // Si no hay ninguno en origen, usamos destino como fallback total
    final = destCandidates.slice(0, 2);
  }

  // Renderizamos trenes
  renderTrains(route, final);

  // Pintamos estado actualizado
  statusLine.textContent = `${new Date().toLocaleTimeString("es-ES", { hour12: false })} · Actualizado.`;

  // Logueamos resumen
  debugLog.push(`Alertas cargadas: ${alertsOk ? "sí" : "no"}`);

  // Volcamos debug si está abierto
  renderDebug(debugLog.dump());
};

// Arranque de la app
const boot = async () => {
  // Conectamos el toggle de debug
  debugToggle.addEventListener("click", toggleDebug);

  // Ejecutamos primer refresco con control de errores
  try {
    // Refrescamos
    await refreshRealtime();
  } catch (e) {
    // Pintamos estado error
    statusLine.textContent = `${new Date().toLocaleTimeString("es-ES", { hour12: false })} · Error al actualizar.`;
    // Logueamos error
    debugLog.push(`ERROR: ${String(e)}`);
    // Renderizamos mensaje
    trainsBox.innerHTML = `<p class="muted">No se pudieron cargar los datos. Revisa Worker/URL y vuelve a recargar.</p>`;
    // Volcamos debug si aplica
    renderDebug(debugLog.dump());
  }

  // Programamos refresco periódico
  setInterval(async () => {
    // Ejecutamos refresco protegido
    try {
      // Refrescamos
      await refreshRealtime();
    } catch (e) {
      // Pintamos estado error
      statusLine.textContent = `${new Date().toLocaleTimeString("es-ES", { hour12: false })} · Error al actualizar.`;
      // Logueamos error
      debugLog.push(`ERROR: ${String(e)}`);
      // Volcamos debug si aplica
      renderDebug(debugLog.dump());
    }
  }, REFRESH_SECONDS * 1000);
};

// Lanzamos boot cuando el DOM está listo
window.addEventListener("DOMContentLoaded", () => {
  // Arrancamos
  boot();
});
