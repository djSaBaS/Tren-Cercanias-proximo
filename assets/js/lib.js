// Definimos una utilidad para seleccionar un elemento por selector
const $ = (selector) => document.querySelector(selector);

// Definimos una utilidad para crear elementos con clase
const el = (tag, className) => {
  // Creamos el elemento
  const node = document.createElement(tag);
  // Aplicamos clase si se proporciona
  if (className) node.className = className;
  // Devolvemos el nodo
  return node;
};

// Definimos una utilidad para formatear un timestamp epoch a HH:MM
const formatHHMM = (epochSeconds) => {
  // Creamos un Date a partir de segundos
  const d = new Date(epochSeconds * 1000);
  // Extraemos horas con 2 dígitos
  const hh = String(d.getHours()).padStart(2, "0");
  // Extraemos minutos con 2 dígitos
  const mm = String(d.getMinutes()).padStart(2, "0");
  // Devolvemos formato
  return `${hh}:${mm}`;
};

// Definimos una utilidad para loguear en debug y consola
const makeLogger = () => {
  // Creamos un array de líneas
  const lines = [];
  // Devolvemos un objeto logger
  return {
    // Añadimos una línea al log
    push: (msg) => {
      // Obtenemos hora local
      const now = new Date();
      // Formateamos HH:MM:SS
      const hh = String(now.getHours()).padStart(2, "0");
      // Formateamos minutos
      const mm = String(now.getMinutes()).padStart(2, "0");
      // Formateamos segundos
      const ss = String(now.getSeconds()).padStart(2, "0");
      // Construimos línea
      const line = `[${hh}:${mm}:${ss}] ${msg}`;
      // Guardamos línea
      lines.push(line);
      // Log a consola
      console.log(line);
    },
    // Obtenemos todas las líneas juntas
    dump: () => lines.join("\n"),
    // Limpiamos el log
    clear: () => {
      // Vaciamos el array
      lines.length = 0;
    }
  };
};

// Definimos un helper para normalizar URL de worker
const normalizeWorkerUrl = (url) => {
  // Si no hay URL devolvemos vacío
  if (!url) return "";
  // Quitamos espacios
  const trimmed = String(url).trim();
  // Si queda vacío devolvemos vacío
  if (!trimmed) return "";
  // Quitamos barra final si existe
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

// Definimos una función para construir URL de proxy con target
const buildWorkerUrl = (workerBase, targetUrl) => {
  // Normalizamos base
  const base = normalizeWorkerUrl(workerBase);
  // Si no hay base devolvemos target directo
  if (!base) return targetUrl;
  // Construimos query target encodeada
  const q = encodeURIComponent(targetUrl);
  // Devolvemos URL completa del worker
  return `${base}/?target=${q}`;
};

// Definimos una función para cargar JSON con timeout
const loadJson = async (url, timeoutMs) => {
  // Creamos un AbortController
  const controller = new AbortController();
  // Creamos un timeout para abortar
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Hacemos fetch con abort
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    // Si no es OK lanzamos error
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Parseamos JSON
    return await res.json();
  } finally {
    // Limpiamos timeout
    clearTimeout(timer);
  }
};

// Definimos un extractor de línea desde tripId (C2, C4A, etc.)
const extractLine = (tripId) => {
  // Si no hay tripId devolvemos vacío
  if (!tripId) return "";
  // Normalizamos a string
  const s = String(tripId);
  // Buscamos sufijo tipo C4a o C4b o C10
  const m = s.match(/(C\d{1,2}[ab]?)/i);
  // Si hay match devolvemos en mayúsculas con A/B
  if (m && m[1]) return m[1].toUpperCase();
  // Si no hay match devolvemos vacío
  return "";
};

// Definimos un extractor de número comercial (si aparece dentro del tripId)
const extractTrainNumber = (tripId) => {
  // Si no hay tripId devolvemos vacío
  if (!tripId) return "";
  // Normalizamos a string
  const s = String(tripId);
  // Buscamos bloque de 5 dígitos típico
  const m = s.match(/(\d{5})/);
  // Devolvemos el número si existe
  return m ? m[1] : "";
};

// Definimos un extractor de andén desde un label del vehicle (PLATF.(X))
const extractPlatformFromLabel = (label) => {
  // Si no hay label devolvemos vacío
  if (!label) return "";
  // Normalizamos
  const s = String(label);
  // Buscamos patrón PLATF.(3) o similar
  const m = s.match(/PLATF\.\((\d{1,2})\)/i);
  // Devolvemos el número si existe
  return m ? m[1] : "";
};
