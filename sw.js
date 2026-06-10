// YR Finanças v31 - Service Worker temporariamente desativado.
// Este arquivo limpa caches antigos e se remove para evitar versões quebradas presas no navegador.

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))),
      self.registration.unregister(),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  // Não intercepta nada. Deixa o navegador buscar direto no GitHub Pages.
});
