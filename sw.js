/* Conversor Concept — link da lavagem J-3901 atualizado para Conteúdo Integral V3.1.
   Sem remoção dos módulos anteriores. Cache separado por versão. */
const CACHE_NAME = 'conversor-concept-v31-lavagem-j3901-integral';
const CORE_ASSETS = [
  './index.html',
  './partida-j3901.html',
  './parada-j3901-manutencao.html',
  './parada-gv3901-manutencao.html?v=10',
  './trip-total-conversor-u39.html?v=13',
  './trip-parcial-conversor-u39.html?v=151',
  './Lavagem-J-3901-Concept-Interativo.html?v=31',
  './manifest.json',
  './cloud-sync.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const LAVAGEM_QUICK = `
  <a id="lavagem-j3901-quick" class="quick quick-link" href="./Lavagem-J-3901-Concept-Interativo.html?v=31"><strong>🧼 Lavagem J-3901 • V3.1</strong><small>HBF • Conteúdo integral • simulações CIC</small></a>`;

const LAVAGEM_CARD = `
    <article id="lavagem-j3901-integrada" class="integrated-item" style="border-color:#3c7087;background:linear-gradient(180deg,#0d2938,#081722)">
      <div class="kind">LAVAGEM DA TURBINA • J-3901 • CONTEÚDO INTEGRAL V3.1</div>
      <h3>🧼 Lavagem da Turbina J-3901</h3>
      <p>HBF, termodinâmica, conversão de energia, pressão da primeira roda, palhetamento, simuladores e avaliação CIC.</p>
      <div class="integrated-actions"><a class="btn primary" href="./Lavagem-J-3901-Concept-Interativo.html?v=31">▶ Treinar lavagem V3.1</a></div>
    </article>`;

function injectLavagemShortcut(html) {
  const newLink = './Lavagem-J-3901-Concept-Interativo.html?v=31';
  const oldLink = './Lavagem-J3901-CIC-V2-Refinada.html?v=2';
  // Compatibilidade com páginas em que um atalho antigo foi gravado no index.html.
  if (html.includes('id="lavagem-j3901-quick"') || html.includes('id="lavagem-j3901-integrada"')) {
    return html.replaceAll(oldLink, newLink);
  }
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
      .then(keys => Promise.all(keys.filter(k => k.startsWith('conversor-concept-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = req.mode === 'navigate' || req.destination === 'document';
  if (isNavigation) {
    event.respondWith((async () => {
      const isHome = url.pathname.endsWith('/Conversor-Concept/') || url.pathname.endsWith('/Conversor-Concept/index.html');
      try {
        const response = await fetch(req, { cache: 'no-store' });
        if (!response.ok) return response;
        if (isHome) {
          const html = await response.text();
          const modified = new Response(injectLavagemShortcut(html), {status: response.status, statusText: response.statusText, headers: response.headers});
          const copy = modified.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return modified;
        }
        caches.open(CACHE_NAME).then(c => c.put(req, response.clone())).catch(() => {});
        return response;
      } catch (e) {
        const cached = await caches.match(req);
        if (!cached) return isNavigation ? caches.match('./index.html') : Response.error();
        if (!isHome) return cached;
        const html = await cached.text();
        return new Response(injectLavagemShortcut(html), {status:cached.status,statusText:cached.statusText,headers:cached.headers});
      }
    })());
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        if (response && response.ok) caches.open(CACHE_NAME).then(c => c.put(req, response.clone())).catch(() => {});
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
