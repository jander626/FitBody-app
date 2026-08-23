/**
 * Service worker mínimo: solo lo necesario para que la app sea instalable y
 * no muestre el dinosaurio cuando el metro se mete en un túnel.
 *
 * Reglas deliberadas:
 *  - Nunca se cachea /api/ ni /auth/: son datos vivos y sesiones.
 *  - Las navegaciones son network-first; el caché es solo el plan B.
 *  - Solo se cachean GET del mismo origen y respuestas 200 básicas.
 * El modo offline de verdad (cola de registros diferidos) está fuera de la v1.
 */
const VERSION = "fitfood-v1";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // addAll falla entero si un recurso falla; en la instalación preferimos
      // best-effort antes que dejar la app sin service worker.
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((clave) => !clave.startsWith(VERSION))
            .map((clave) => caches.delete(clave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function esCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/auth/")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!esCacheable(url)) return;

  // Navegaciones: red primero, caché como red de seguridad, /offline al final.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copia));
          return respuesta;
        })
        .catch(async () => {
          const cacheada = await caches.match(request);
          return cacheada ?? (await caches.match("/offline"));
        }),
    );
    return;
  }

  // Estáticos versionados por Next y nuestros iconos: caché primero.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cacheada) =>
          cacheada ??
          fetch(request).then((respuesta) => {
            if (respuesta.ok && respuesta.type === "basic") {
              const copia = respuesta.clone();
              caches.open(SHELL).then((cache) => cache.put(request, copia));
            }
            return respuesta;
          }),
      ),
    );
  }
});
