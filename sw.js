const CACHE='orario-docente-v16.10.5';
const CORE=['/','/index.html','/identity-client.js','/account-storage.js','/schedule-file-type.js','/school-upload-dispatcher.js','/school-update.js','/school-permissions.js','/pdf-layout-parser.js','/scuole.html','/area-scuola.html','/admin.html','/grazie-scuola.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  event.respondWith(fetch(event.request).then(resp=>{const clone=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));return resp}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/index.html','/scuole.html','/area-scuola.html','/admin.html'))));
});
