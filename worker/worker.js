// Definimos el único origen remoto autorizado para el proxy de datos públicos.
const ORIGEN_RENFE = "https://gtfsrt.renfe.com";

// Restringimos las consultas a los tres documentos GTFS-RT utilizados por la aplicación.
const RUTAS_PERMITIDAS = new Set([
  "/trip_updates.json",
  "/vehicle_positions.json",
  "/alerts.json"
]);

// Declaramos las cabeceras CORS para permitir la lectura pública de estos datos no sensibles.
const CABECERAS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

// Validamos de forma estricta el destino antes de establecer ninguna conexión saliente.
function validarDestino(valor) {
  // Rechazamos valores vacíos o excesivamente largos para acotar la superficie de entrada.
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 256) return null;

  // Intentamos interpretar la dirección con el parser estándar, sin expresiones regulares permisivas.
  let destino;
  // Interceptamos URL malformadas antes de acceder a sus propiedades.
  try {
    // Construimos una URL absoluta, sin aceptar bases relativas.
    destino = new URL(valor);
  // Evitamos que un parámetro inválido provoque un error no controlado.
  } catch {
    // Señalamos que el destino no está autorizado.
    return null;
  }

  // Exigimos HTTPS y coincidencia exacta del origen para bloquear hosts internos y dominios parecidos.
  if (destino.origin !== ORIGEN_RENFE) return null;
  // Comprobamos que la ruta sea exactamente una de las tres listas autorizadas.
  if (!RUTAS_PERMITIDAS.has(destino.pathname)) return null;
  // Evitamos parámetros, fragmentos y credenciales que alteren el comportamiento previsto.
  if (destino.search || destino.hash || destino.username || destino.password) return null;

  // Devolvemos exclusivamente la URL normalizada cuando supera todas las comprobaciones.
  return destino.toString();
}

// Publicamos el manejador HTTP compatible con Cloudflare Workers.
export default {
  // Respondemos a las peticiones de navegador sin permitir accesos a destinos arbitrarios.
  async fetch(solicitud) {
    // Contestamos el preflight CORS sin realizar ninguna petición externa.
    if (solicitud.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECERAS_CORS });
    // Limitamos los métodos HTTP para evitar usos distintos de la consulta de datos.
    if (solicitud.method !== "GET" && solicitud.method !== "HEAD") {
      // Informamos del método no permitido mediante una respuesta controlada.
      return new Response("Método no permitido.", { status: 405, headers: CABECERAS_CORS });
    }

    // Leemos la URL de la petición recibida por el Worker.
    const url = new URL(solicitud.url);
    // Validamos el destino especificado por el parámetro de consulta.
    const destino = validarDestino(url.searchParams.get("target"));
    // Impedimos una consulta externa cuando el destino no figura en la lista blanca.
    if (!destino) return new Response("Destino no permitido.", { status: 400, headers: CABECERAS_CORS });

    // Aislamos los errores de red del servicio aguas arriba.
    try {
      // Consultamos Renfe sin seguir redirecciones que puedan apuntar a otro dominio.
      const respuesta = await fetch(destino, {
        // Conservamos el método permitido solicitado.
        method: solicitud.method,
        // Bloqueamos redirecciones automáticas por seguridad.
        redirect: "manual",
        // Solicitamos expresamente una representación JSON.
        headers: { Accept: "application/json" },
        // Desactivamos la caché de borde para priorizar la información actualizada.
        cf: { cacheTtl: 0, cacheEverything: false }
      });

      // Evitamos propagar respuestas de error o redirecciones como si fueran datos reales.
      if (!respuesta.ok) return new Response("Fuente de datos temporalmente no disponible.", { status: 502, headers: CABECERAS_CORS });

      // Creamos cabeceras de salida independientes de las cabeceras del servicio remoto.
      const cabeceras = new Headers(CABECERAS_CORS);
      // Declaramos el contenido como JSON para evitar interpretaciones inseguras del navegador.
      cabeceras.set("Content-Type", "application/json; charset=utf-8");
      // Eliminamos el cuerpo en las peticiones HEAD conforme al estándar HTTP.
      const cuerpo = solicitud.method === "HEAD" ? null : respuesta.body;
      // Entregamos únicamente el contenido permitido y su cabecera controlada.
      return new Response(cuerpo, { status: 200, headers: cabeceras });
    // Gestionamos sin filtrar datos internos los fallos de conexión.
    } catch {
      // Respondemos con un error de pasarela que la aplicación podrá gestionar.
      return new Response("No se pudo consultar la fuente de datos.", { status: 502, headers: CABECERAS_CORS });
    }
  }
};
