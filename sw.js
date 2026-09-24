const CACHE_NAME = 'conversor-concept-v16-lavagem-j3901';
const CORE_ASSETS = [
  './index.html',
  './partida-j3901.html',
  './parada-j3901-manutencao.html',
  './parada-gv3901-manutencao.html?v=10',
  './trip-total-conversor-u39.html?v=13',
  './trip-parcial-conversor-u39.html?v=151',
  './Lavagem-J3901-CIC-V2-Refinada.html?v=2',
  './manifest.json',
  './cloud-sync.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const LAVAGEM_QUICK = `
  <a id="lavagem-j3901-quick" class="quick quick-link" href="./Lavagem-J3901-CIC-V2-Refinada.html?v=2"><strong>🧼 Lavagem J-3901</strong><small>HBF • patamares • condutividade • CIC</small></a>`;

const LAVAGEM_CARD = `
    <article id="lavagem-j3901-integrada" class="integrated-item" style="border-color:#3c7087;background:linear-gradient(180deg,#0d2938,#081722)">
      <div class="kind">LAVAGEM DE TURBINA • J-3901 • CIC</div>
      <h3>🧼 Lavagem da Turbina J-3901</h3>
      <p>7000 m³/d, condicionamento do conversor, HBF, PI-39062A, curva de 1 °C/min, patamares com gates técnicos, condutividade e retorno controlado.</p>
      <div class="integrated-actions"><a class="btn primary" href="./Lavagem-J3901-CIC-V2-Refinada.html?v=2">▶ Treinar lavagem</a></div>
    </article>`;

function injectLavagemShortcut(html) {
  if (html.includes('id="lavagem-j3901-quick"') || html.includes('id="lavagem-j3901-integrada"')) return html;

  const partidaQuick = '<a class="quick quick-link" href="./partida-j3901.html"><strong>Partida J-3901</strong><small>auxiliares + vácuo + turbina + CIC</small></a>';
  if (html.includes(partidaQuick)) {
    html = html.replace(partidaQuick, partidaQuick + LAVAGEM_QUICK);
  } else if (html.includes('<section class="quick-grid">')) {
    html = html.replace('<section class="quick-grid">', '<section class="quick-grid">' + LAVAGEM_QUICK);
  }

  if (html.includes('<div class="integrated-grid">')) {
    html = html.replace('<div class="integrated-grid">', '<div class="integrated-grid">' + LAVAGEM_CARD);
  }
  return html;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const response = await fetch(req, { cache: 'no-store' });
        const url = new URL(req.url);
        const isHome =
          url.pathname.endsWith('/Conversor-Concept/') ||
          url.pathname.endsWith('/Conversor-Concept/index.html');

        if (isHome && response.ok) {
          const text = await response.text();
          const injected = injectLavagemShortcut(text);
          const modified = new Response(injected, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
          const copy = modified.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
          return modified;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        return response;
      } catch (e) {
        const cached = await caches.match(req);
        if (!cached) return caches.match('./index.html');
        const url = new URL(req.url);
        const isHome =
          url.pathname.endsWith('/Conversor-Concept/') ||
          url.pathname.endsWith('/Conversor-Concept/index.html');
        if (!isHome) return cached;
        const text = await cached.text();
        return new Response(injectLavagemShortcut(text), {
          status: cached.status,
          statusText: cached.statusText,
          headers: cached.headers
        });
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
