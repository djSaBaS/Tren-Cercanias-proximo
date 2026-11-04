# Cercanías · Próximos trenes (Panel configurable)

Proyecto 100% frontend (HTML/CSS/JS) pensado para GitHub Pages.

## Características
- Configuración por usuario con localStorage.
- Provincia → Localidad → Estaciones.
- Estilo “cartel mecánico” (split-flap).
- Incidencias con iconos y detalle.
- QR opcional para mover configuración entre dispositivos.
- Manual accesible desde “?”.

## CORS
Para GitHub Pages necesitas un Cloudflare Worker. Ver `worker/README.md`.

## Estructura
Revisa los `info.md` dentro de cada carpeta para entender qué contiene cada cosa.

## Evolución prevista: planificador de rutas

La aplicación actual es un **panel de salidas**. Todavía no optimiza transbordos ni detecta automáticamente la estación con GPS. El diseño técnico de la evolución hacia un navegador de Cercanías está documentado en [`docs/planificador-inteligente.md`](docs/planificador-inteligente.md).

## Seguridad y pruebas

El Worker actualizado solo permite los tres endpoints GTFS-RT de Renfe. Para probar su validación, ejecutar `npm run test:worker`. **La publicación del Worker en Cloudflare es independiente de fusionar cambios en GitHub Pages.**
