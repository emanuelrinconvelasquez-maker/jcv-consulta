// Guarda la página para que abra aunque no haya internet (los datos se guardan aparte, cifrados).
const CACHE = "jcv-consulta-v11";
const ARCHIVOS = ["./", "index.html", "manifest.webmanifest", "logo.png", "icon-192.png", "apple-touch-icon.png",
                  "dibujos.js", "logo_estado.png", "logo_remision.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;               // los datos (GitHub) siempre van a la red
  e.respondWith(fetch(e.request).then(r => {               // red primero; si falla, lo guardado
    const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
