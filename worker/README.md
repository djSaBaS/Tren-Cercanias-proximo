# Proxy GTFS-RT de Renfe para GitHub Pages

Este Cloudflare Worker consulta únicamente tres feeds públicos oficiales de Renfe, porque GitHub Pages es un alojamiento estático.

## Endpoints autorizados

- `https://gtfsrt.renfe.com/trip_updates.json`
- `https://gtfsrt.renfe.com/vehicle_positions.json`
- `https://gtfsrt.renfe.com/alerts.json`

El proxy utiliza el parámetro `target`, pero ahora **rechaza cualquier otro dominio, ruta, protocolo, redirección o parámetro adicional**. No es un proxy web general; esto evita que terceros lo empleen para explorar servicios internos o servidores arbitrarios.

## Despliegue

1. En Cloudflare, abre **Workers & Pages** y selecciona el Worker existente.
2. Sustituye el código publicado por el contenido completo de `worker/worker.js` y despliega.
3. Comprueba que el Worker responde con HTTP 200 para los feeds permitidos y HTTP 400 para destinos no autorizados.
4. Confirma que el dominio publicado sigue siendo el definido en `assets/js/app.js` como `DEFAULT_WORKER_URL`.

**Importante:** fusionar un PR de GitHub no actualiza automáticamente el Worker desplegado en Cloudflare. Hay que publicarlo por separado, salvo que se configure expresamente un despliegue automatizado.

## Pruebas locales

Con Node.js 20 o posterior:

```bash
node --test tests/worker.test.mjs
```

Las pruebas usan un proveedor simulado y no necesitan conectarse a Renfe.

## Limitaciones

Los horarios GTFS-RT pueden omitir paradas futuras; una circulación sin recorrido completo verificado no constituye una ruta recomendada. Las etiquetas `PLATF` asociadas al vehículo no garantizan la vía de salida de una estación futura. El futuro planificador deberá usar GTFS estático, estimaciones de paso, tiempos de transbordo y las vías oficiales cuando estén disponibles.
