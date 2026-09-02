// Servicearbetare — appen ska fungera på en skjutbana utan täckning.
//
// Hela appen ligger i index.html efter bygget, så cachen är kort: sidan,
// manifestet och ikonerna. Versionsnumret byts av bygg.py vid varje bygge,
// vilket gör att en ny version verkligen slår igenom i stället för att den
// gamla ligger kvar i cachen.

const CACHE = 'fm-kompetensprov-89993c62a887';   // byts av bygg.py till appens fingeravtryck
const FILER = ['./', './index.html', './manifest.webmanifest', './ikon-180.png', './ikon-512.png'];

// cache: 'reload' förbi HTTP-cachen. GitHub Pages skickar max-age=600 på allt,
// och webbläsaren hämtar visserligen SJÄLVA sw.js färskt vid uppdateringskollen
// — men filerna nedan går annars via HTTP-cachen. Den nya arbetaren kunde
// därmed cacha en upp till tio minuter gammal index.html under sitt nya
// cachenamn, och uppdateringen syntes först en start senare än den skulle.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILER.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
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

  // Bara appens egna filer. En begäran till någon annan värd har appen ingen
  // anledning att göra — går den ändå iväg ska den inte passera här och bli
  // cachad som om den hörde hemma.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Cachen först, nätet bara när filen inte finns där. Det omvända (nätet
  // först) innebar att varje start med täckning hörde av sig till GitHub
  // Pages — ingen användardata, men en utgående förbindelse per start som
  // avslöjar IP, tidpunkt och telefonmodell för den som serverar filen. En
  // app som ska kunna användas utan att lämna spår ska inte göra det.
  //
  // Uppdateringar tappas inte: webbläsaren jämför sw.js mot serverns kopia på
  // egen hand, och eftersom bygg.py stämplar CACHE med appens fingeravtryck
  // hämtar en ny version sina filer i install-steget.
  e.respondWith(
    caches.match(e.request).then((traff) => traff || fetch(e.request)
      .then((svar) => {
        const kopia = svar.clone();
        caches.open(CACHE).then((c) => c.put(e.request, kopia)).catch(() => {});
        return svar;
      })
      .catch(() => caches.match('./index.html'))),
  );
});
