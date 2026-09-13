const CACHE='berryhaven-beta-1-0-1';
const CORE=[
  './','./index.html',
  './berry-base.css','./berry-ui.css','./berry-themes.css','./berry-games.css','./berry-safe-space.css',
  './berry-brand.js','./berry-emojis.js','./berry-adult-emojis.js','./berry-profiles.js',
  './berry-animated-profiles.js','./berry-feelings.js','./berry-animated-themes.js',
  './berry-theme-controller.js','./berry-icons.js','./berry-games.js','./berry-arcade.js'
];
const EXTERNAL_CACHE_HOSTS=new Set(['cdn.jsdelivr.net']);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('berryhaven-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;
  const allowedExternal=EXTERNAL_CACHE_HOSTS.has(url.hostname);
  if(!sameOrigin&&!allowedExternal)return;

  if(allowedExternal){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      if(cached)return cached;
      try{
        const res=await fetch(req);
        if(res){const cache=await caches.open(CACHE);cache.put(req,res.clone()).catch(()=>{});}
        return res;
      }catch(_){return new Response('',{status:504,statusText:'Offline dependency unavailable'});}
    })());
    return;
  }

  const isAppCode=req.mode==='navigate'||/\.(?:html|js|css)$/.test(url.pathname);
  event.respondWith((async()=>{
    if(isAppCode){
      try{
        const res=await fetch(req,{cache:'no-store'});
        if(res&&res.ok){const cache=await caches.open(CACHE);cache.put(req,res.clone()).catch(()=>{});}
        return res;
      }catch(_){
        return await caches.match(req)||await caches.match('./index.html')||new Response('Offline',{status:503});
      }
    }
    const cached=await caches.match(req);
    if(cached)return cached;
    try{
      const res=await fetch(req);
      if(res&&res.ok){const cache=await caches.open(CACHE);cache.put(req,res.clone()).catch(()=>{});}
      return res;
    }catch(_){return new Response('Offline',{status:503});}
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification.data||{};
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    let target=windows.find(c=>c.visibilityState==='visible')||windows[0];
    if(target){await target.focus();target.postMessage({type:'berry-notification-click',data});return;}
    target=await self.clients.openWindow('./');
    if(target)setTimeout(()=>target.postMessage({type:'berry-notification-click',data}),500);
  })());
});
