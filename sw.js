const CACHE_NAME = "buddy-shell-v23";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/js/modules/ui.js",
  "./assets/images/logo.svg",
  "./assets/images/icons/icon-192x192.png",
  "./assets/images/icons/icon-512x512.png",
  "./pages/offline.html",
  "./pages/check-in.html",
  "./pages/create-account.html",
  "./pages/exercises.html",
  "./pages/login.html",
  "./pages/sobre.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("Não foi possível preparar a aplicação para utilização offline.", error);
        throw error;
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("buddy-shell-") && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (
    request.method !== "GET"
    || requestUrl.origin !== self.location.origin
    || !requestUrl.href.startsWith(self.registration.scope)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
            );
          }
          return response;
        } catch {
          const cachedPage = await caches.match(request, { ignoreSearch: true });
          const appShell = await caches.match("./index.html");
          const offlinePage = await caches.match("./pages/offline.html");
          return cachedPage || appShell || offlinePage || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await fetch(request);
      if (response.ok) {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        );
      }
      return response;
    })()
  );
});
