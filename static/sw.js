/* Офлайн только для публичного справочника. Панели редактора не кэшируются. */
const ROOT = new URL('./', self.location.href);
const PREFIX = 'ercyon-' + ROOT.pathname.replace(/[^a-z0-9]/gi, '_');
const SHELL = PREFIX + '-shell-__CACHE_VERSION__';
const SAVED = PREFIX + '-saved-v1';
const address = path => new URL(path.replace(/^\//, ''), ROOT).href;
const CORE = ['/', '/offline/', '/library/', '/search/', '/search-index.json',
  '/css/fonts.css', '/css/site.css', '/css/mobile.css', '/js/storage.js', '/js/app.js', '/js/companion.js', '/js/maps.js', '/js/offline.js',
  '/img/logo-96.webp','/img/logo-128.webp','/img/paper.webp','/img/grain.webp',
  '/fonts/cormorant-600-n-cyrillic.woff2','/fonts/cormorant-600-n-latin.woff2','/fonts/ptserif-400-n-cyrillic.woff2','/fonts/ptserif-400-n-latin.woff2'];
const publicURL = raw => {
  const u = new URL(raw, ROOT);
  if (u.origin !== ROOT.origin || !u.pathname.startsWith(ROOT.pathname)) throw new Error('Адрес вне сайта');
  const relative = u.pathname.slice(ROOT.pathname.length);
  if (/^(admin(?:-classic)?\/|content\/)/.test(relative)) throw new Error('Служебная страница');
  u.hash='';u.search='';return u;
};
self.addEventListener('install', event => {event.waitUntil((async()=>{const cache=await caches.open(SHELL);await cache.addAll(CORE.map(address));await self.skipWaiting();})());});
self.addEventListener('activate', event => {event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX+'-shell-') && key!==SHELL)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message', event => {
  const port=event.ports?.[0];if(!port)return;
  event.waitUntil((async()=>{
    try{
      if(!event.source?.url || new URL(event.source.url).origin!==ROOT.origin)throw new Error('Неизвестный источник');
      const data=event.data || {},cache=await caches.open(SAVED);
      if(data.type==='LIST'){
        const records=[];
        for(const request of await cache.keys()){const response=await cache.match(request);records.push({url:new URL(request.url).pathname.slice(ROOT.pathname.length-1),title:decodeURIComponent(response.headers.get('X-Ercyon-Title')||''),savedAt:response.headers.get('X-Ercyon-Saved'),updated:response.headers.get('X-Ercyon-Updated')});}
        port.postMessage({ok:true,records});return;
      }
      const u=publicURL(data.url);
      if(data.type==='REMOVE'){await cache.delete(u.href);port.postMessage({ok:true});return;}
      if(data.type!=='SAVE')throw new Error('Неизвестное действие');
      const keys=await cache.keys();if(keys.length>=30 && !(await cache.match(u.href)))throw new Error('Можно сохранить до 30 страниц. Удалите ненужные копии.');
      if(!u.pathname.endsWith('/'))throw new Error('Сохранять можно только страницы');
      const response=await fetch(u.href,{cache:'reload',signal:AbortSignal.timeout(15000)});
      if(!response.ok || !response.headers.get('Content-Type')?.includes('text/html'))throw new Error('Не удалось загрузить страницу');
      const html=await response.text();
      if(html.length>3000000)throw new Error('Страница слишком большая для сохранения');
      const metadata=html.match(/window\.__PAGE__ = (\{[^\n]*?\});/);
      let info={};if(metadata)info=JSON.parse(metadata[1]);
      if(!['page','country','news','war','treaty'].includes(info.kind))throw new Error('Эту страницу нельзя сохранить');
      const headers=new Headers(response.headers);headers.set('X-Ercyon-Title',encodeURIComponent(info.title || data.title || 'Страница'));headers.set('X-Ercyon-Saved',new Date().toISOString());headers.set('X-Ercyon-Updated',info.updated || '');headers.delete('Content-Encoding');headers.delete('Content-Length');
      await cache.put(u.href,new Response(html,{status:200,headers}));port.postMessage({ok:true});
    }catch(error){port.postMessage({ok:false,error:error.message || 'Не удалось сохранить страницу'});}
  })());
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET')return;
  let u;try{u=publicURL(event.request.url);}catch{return;}
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{const response=await fetch(event.request,{signal:AbortSignal.timeout(5000)});if(response.status>=500)throw new Error('Сайт недоступен');return response;}catch{
        const saved=await (await caches.open(SAVED)).match(u.href);if(saved)return saved;
        const shell=await caches.open(SHELL);return await shell.match(u.href) || await shell.match(address('/offline/'));
      }
    })());return;
  }
  // Прочие картинки не скачиваются заранее; большие карты требуют соединения.
  if(CORE.map(address).includes(u.href))event.respondWith((async()=>{
    const cache=await caches.open(SHELL);
    if(u.pathname.endsWith('search-index.json')){try{const r=await fetch(event.request,{signal:AbortSignal.timeout(4000)});if(r.ok){await cache.put(u.href,r.clone());return r;}}catch{}}
    return await cache.match(u.href) || fetch(event.request);
  })());
});
