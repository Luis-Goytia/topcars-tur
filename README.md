# Top Cars Reviews API

Prototipo de API y mini backoffice para asociar reviews externas a productos (autos) de un concesionario utilizando un LLM.

## Requisitos

- Node.js 20+ y npm
- Clave de API de OpenAI u otro proveedor compatible con el SDK `openai`

## Configuración

1. Copia el archivo `.env` (o crea uno nuevo si no existe) y define:

   ```bash
   OPENAI_API_KEY=tu_clave_aqui
   PORT=3000
   LLM_MODEL=gpt-4.1-mini
   MAX_LLM_CONCURRENCY=10
   LLM_BATCH_SIZE=20
   ```

2. Los datos de ejemplo viven en `db/`:
   - `db/internal_products.json`
   - `db/internal_dealers.json`
   - `db/external_reviews.json`

   No los modifiques a menos que quieras cambiar los casos de prueba.

## Instalación

```bash
npm install
```

## Ejecución en desarrollo

```bash
npm run dev
```

Se levantará el servidor en `http://localhost:3000` (o el puerto definido en `PORT`).

## Build y ejecución en producción

```bash
npm run build
npm start
```

## Endpoints principales

- `GET /products`
  - Devuelve la lista de productos internos (autos).
- `GET /products/{productId}/reviews`
  - Devuelve las reviews actualmente asociadas a ese producto.
- `POST /products/{productId}/reviews/sync`
  - Sincroniza reviews externas para **un** producto: prefiltra por dealer, llama al LLM en lotes y guarda el resultado. Devuelve `product`, `newReviews`, `allReviews` y `summary`.
- `POST /products/reviews/sync-all`
  - Sincroniza reviews externas para **todos** los productos. No requiere `productId`. Devuelve `durationMs`, `totalProducts`, `processedProducts`, `summaries` por producto y `errors` si los hubo.
- `POST /products/reviews/prune-external`
  - Elimina del pool externo (`external_reviews.json`) las reviews ya asociadas a algún producto. Devuelve `removed`, `remaining` y `totalAssociations`.

## Documentación OpenAPI / Swagger

- UI: `GET /api-docs`
- Spec: `openapi.yaml` en la raíz del proyecto

Desde Swagger UI puedes probar los endpoints directamente.

## Front de backoffice

El front mínimo vive en `public/` y se sirve desde la misma API:

- Abre `http://localhost:3000/` en el navegador.
- Flujo:
  1. Se listan los productos (`GET /products`).
  2. Selecciona un producto.
  3. Pulsa **“Cargar reviews externas”** para llamar a `POST /products/{productId}/reviews/sync`.
  4. Se muestran el resumen de sincronización y las reviews asociadas.

## Notas sobre concurrencia y rate limits

- Las llamadas al LLM se ejecutan con:
  - **Pool de concurrencia** limitado por `MAX_LLM_CONCURRENCY`.
  - **Reintentos con backoff exponencial + jitter** para errores 429 y 5xx.
  - **Ajuste dinámico de concurrencia** cuando se detectan varios 429 en una ventana corta.

