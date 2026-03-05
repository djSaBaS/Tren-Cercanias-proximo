# Cloudflare Worker (Proxy anti-CORS)

Este Worker permite que GitHub Pages consulte endpoints con restricciones CORS, usando:
`?target=https://...`

## Crear desde el panel (sin herramientas)
1) Cloudflare → Workers & Pages → Workers → Create application
2) Start with Hello World!
3) Pega `worker.js`
4) Deploy
5) Copia la URL `https://TU-WORKER.workers.dev/`

## Configurar la web
En la web puedes:
- Pegar la URL en ⚙ → “Cloudflare Worker (proxy)”
- O editar `assets/js/app.js` en `DEFAULT_WORKER_URL` (marcado con [cambiar_por_url_woker])

## Seguridad básica
- Solo GET/HEAD
- Target debe ser http(s)
- Responde OPTIONS
- Cache-Control: no-store
