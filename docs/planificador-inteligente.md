# Evolución: planificador inteligente de Cercanías Madrid

## Estado real

El código actual de `main` es un **panel de próximas salidas entre dos estaciones**, no un navegador de rutas.
No detecta la estación por GPS, no calcula transbordos y no dispone de una tabla completa
de horarios estáticos GTFS para reconstruir recorridos que el feed GTFS-RT no incluya.

Este documento define el objetivo sin atribuir al panel capacidades que aún no tiene.

## Objetivo inicial

- Detectar la estación cercana al dispositivo, ofreciendo confirmación manual.
- Permitir destinos favoritos, empezando por **La Serna (35010)**.
- Comparar alternativas desde **Chamartín (17000)**, **Atocha Cercanías (18000)**,
  **Villaverde Alto (37001)** y las estaciones intermedias relevantes.
- Incluir al menos las líneas **C-3, C-4 y C-5**, también cuando una combinación
  requiera cambiar de línea más de una vez.
- Recomendar el recorrido con llegada estimada más temprana, siempre que sea
  factible realizar los transbordos.
- Informar de vía conocida, vía pendiente de confirmar y datos atrasados sin confundirlos.

## Arquitectura propuesta

1. **Topología GTFS estática:** estaciones, trayectos, servicios, paradas ordenadas,
   calendarios y tiempos programados. No inventar paradas a partir de etiquetas.
2. **GTFS-RT de Renfe:** fusionar `trip_updates`, `vehicle_positions` y `alerts`
   usando identificadores de circulación y parada. Mantener la hora de captura.
3. **Paneles oficiales o RadarDeTrenes:** complementar información de vías cuando
   exista y registrar su origen y momento de validez.
4. **Motor de rutas dependiente del tiempo:** emplear RAPTOR o Connection Scan
   Algorithm con tiempos mínimos de cambio específicos por estación o par de andenes,
   intervalos de seguridad, accesibilidad y máximo configurable de transbordos.
5. **Cliente GitHub Pages:** geolocalización bajo consentimiento, comparación de
   rutas, selección manual de estación y replanificación durante el viaje.
6. **Proxy seguro:** Cloudflare Worker para feeds con CORS limitado, normalización
   opcional y caché con duración corta; nunca un proxy de URL libre.

## Reglas de decisión

- No recomendar un servicio cuando no esté demostrado que pasa por la parada elegida.
- No asumir que el andén del vehículo en su posición actual será el de una estación futura.
- No dar por válido un transbordo si el margen es menor que el tiempo mínimo necesario.
- Diferenciar siempre horarios programados, estimaciones en vivo y predicciones propias.
- Evitar recomendar un cambio por ventajas de pocos segundos: incluir un umbral de mejora
  y penalización por transbordos para estabilizar sugerencias.
- Detectar la caducidad de los datos y degradar a horario programado con aviso explícito.
- Recalcular cuando cambie el estado del tren o el usuario confirme su posición.

## Primera batería de pruebas de aceptación

- Chamartín → La Serna: comparar C-4 → C-5 por Villaverde Alto con C-3 → C-5 por Atocha.
- Con retraso en C-4, comprobar si gana una alternativa por Atocha.
- Con dos transbordos, comprobar que el algoritmo no seleccione cambios imposibles.
- Con GPS denegado o impreciso, permitir origen manual sin bloquear la aplicación.
- Sin información de vías, mostrar «Por confirmar» y no una cifra deducida de otra estación.
- Sin GTFS-RT disponible, mostrar que se usan horarios programados sin presentarlos como reales.
- Con datos de días anteriores, bloquear recomendaciones obsoletas.
- En caso de conexiones equivalentes, preferir menos transbordos y mayor margen de seguridad.

## Orden de implementación

**PR 1 (este):** seguridad del Worker, errores de red, corrección de recomendaciones
confusas y pruebas básicas; mantener el panel existente.

**PR 2:** descargar y validar GTFS estático de Madrid; identificar todas las
circulaciones relevantes y sus paradas, con pruebas y fixtures reproducibles.

**PR 3:** motor de itinerarios con transbordos y tiempos mínimos de cambio.

**PR 4:** geolocalización consentida, interfaz móvil, destinos favoritos,
notificaciones y replanificación.

> El PR 1 no implementa todavía el planificador de rutas. No fusionar ni desplegar
> a producción sin revisar el comportamiento de los datos reales.
