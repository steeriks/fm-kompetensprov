// Servicearbetare — appen ska fungera på en skjutbana utan täckning.
//
// Hela appen ligger i index.html efter bygget, så cachen är kort: sidan,
// manifestet och ikonerna. Versionsnumret byts av bygg.py vid varje bygge,
// vilket gör att en ny version verkligen slår igenom i stället för att den
// gamla ligger kvar i cachen.

const CACHE = 'fm-kompetensprov-08d477e5fb87';   // byts av bygg.py till appens fingeravtryck
const FILER = ['./', './index.html', './manifest.webmanifest', './ikon-180.png', './ikon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namn) => Promise.all(namn.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Nätet först när det finns, cachen annars: du ska få senaste versionen
  // hemma på wifi, men appen ska starta även utan täckning.
  e.respondWith(
    fetch(e.request)
      .then((svar) => {
        const kopia = svar.clone();
        caches.open(CACHE).then((c) => c.put(e.request, kopia)).catch(() => {});
        return svar;
      })
      .catch(() => caches.match(e.request).then((traff) => traff || caches.match('./index.html'))),
  );
});
