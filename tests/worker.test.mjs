// Importamos las aserciones estrictas para verificar comportamiento y seguridad.
import assert from "node:assert/strict";
// Incorporamos el ejecutor de pruebas disponible en Node.js.
import { afterEach, test } from "node:test";
// Cargamos el Worker real, sin copiar ni simular su lógica interna.
import worker from "../worker/worker.js";

// Conservamos la función fetch original para impedir interferencias entre pruebas.
const fetchOriginal = globalThis.fetch;

// Restauramos fetch después de cada prueba para mantener el entorno aislado.
afterEach(() => { globalThis.fetch = fetchOriginal; });

// Construimos peticiones al Worker con un destino opcional y un método explícito.
function solicitud(destino, metodo = "GET") {
  // Formamos la URL local sin interpolar el destino en una consulta sin codificar.
  const url = new URL("https://ejemplo.workers.dev/");
  // Incorporamos el parámetro únicamente cuando la prueba proporciona un destino.
  if (destino !== null) url.searchParams.set("target", destino);
  // Devolvemos un Request estándar compatible con el entorno de pruebas.
  return new Request(url, { method: metodo });
}

// Verificamos que un destino ausente no desencadene conexiones externas.
test("rechaza peticiones sin destino", async () => {
  // Ejecutamos la consulta sin parámetro de destino.
  const respuesta = await worker.fetch(solicitud(null));
  // Confirmamos que se devuelve un rechazo HTTP controlado.
  assert.equal(respuesta.status, 400);
});

// Comprobamos diversos intentos de utilizar el Worker como proxy abierto.
test("bloquea hosts ajenos, HTTP, rutas desconocidas y consultas adicionales", async () => {
  // Definimos entradas adversarias y equivalentes no autorizadas.
  const destinos = [
    "http://gtfsrt.renfe.com/trip_updates.json",
    "https://gtfsrt.renfe.com.ejemplo.org/trip_updates.json",
    "https://127.0.0.1/trip_updates.json",
    "https://gtfsrt.renfe.com/admin",
    "https://gtfsrt.renfe.com/trip_updates.json?url=https://ejemplo.org",
    "https://usuario:clave@gtfsrt.renfe.com/trip_updates.json",
    "no-es-una-url"
  ];
  // Recorremos cada destino que nunca debe generar tráfico externo.
  for (const destino of destinos) {
    // Consultamos el Worker con la dirección adversaria.
    const respuesta = await worker.fetch(solicitud(destino));
    // Verificamos la denegación de forma uniforme para todos los casos.
    assert.equal(respuesta.status, 400, destino);
  }
});

// Comprobamos que los métodos de escritura no estén disponibles.
test("rechaza métodos no permitidos", async () => {
  // Enviamos una petición POST contra un destino técnicamente válido.
  const respuesta = await worker.fetch(solicitud("https://gtfsrt.renfe.com/alerts.json", "POST"));
  // Verificamos que no se permita el método.
  assert.equal(respuesta.status, 405);
});

// Comprobamos que CORS responda antes de iniciar cualquier petición remota.
test("atiende preflight CORS sin consultar Renfe", async () => {
  // Enviamos un preflight sin incluir un destino externo.
  const respuesta = await worker.fetch(solicitud(null, "OPTIONS"));
  // Comprobamos el código de preflight correcto.
  assert.equal(respuesta.status, 204);
  // Verificamos que el navegador pueda leer la respuesta.
  assert.equal(respuesta.headers.get("access-control-allow-origin"), "*");
});

// Probamos una consulta válida con un servicio remoto simulado.
test("consulta únicamente un endpoint autorizado y conserva JSON", async () => {
  // Conservamos el destino realmente solicitado para verificar que no se reescriba.
  let solicitado;
  // Simulamos la respuesta permitida sin realizar llamadas externas reales.
  globalThis.fetch = async (url, options) => {
    // Registramos el destino del acceso saliente.
    solicitado = url;
    // Impedimos que las redirecciones se sigan automáticamente.
    assert.equal(options.redirect, "manual");
    // Respondemos con un JSON de prueba.
    return new Response('{"entity":[]}', { status: 200, headers: { "Content-Type": "application/json" } });
  };
  // Consultamos la fuente oficial de posiciones permitida.
  const respuesta = await worker.fetch(solicitud("https://gtfsrt.renfe.com/vehicle_positions.json"));
  // Confirmamos que solo se llama al dominio oficial configurado.
  assert.equal(solicitado, "https://gtfsrt.renfe.com/vehicle_positions.json");
  // Verificamos que el cliente recibe respuesta satisfactoria.
  assert.equal(respuesta.status, 200);
  // Verificamos la disponibilidad de CORS en la respuesta definitiva.
  assert.equal(respuesta.headers.get("access-control-allow-origin"), "*");
  // Comprobamos que el contenido JSON no haya sido alterado.
  assert.deepEqual(await respuesta.json(), { entity: [] });
});

// Verificamos que una redirección externa jamás se transforme en éxito.
test("no sigue ni devuelve redirecciones del proveedor", async () => {
  // Simulamos una respuesta HTTP de redirección sin descarga adicional.
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: "https://ejemplo.org/" } });
  // Solicitamos un endpoint permitido que responde con redirección.
  const respuesta = await worker.fetch(solicitud("https://gtfsrt.renfe.com/alerts.json"));
  // Confirmamos que el Worker devuelve un error y no redirige al cliente.
  assert.equal(respuesta.status, 502);
});
