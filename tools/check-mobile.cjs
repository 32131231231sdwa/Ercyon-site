/* Браузерная проверка справочника, миграции сохранений и офлайн-режима. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../dist'),prefix=(process.env.BASE_PATH||'').replace(/\/$/,'');
const shots=process.env.SCREENSHOT_DIR;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg'};
(async()=>{
  let networkEnabled=true,legacyWorker=false;
  const server=http.createServer((req,res)=>{
    if(!networkEnabled){req.socket.destroy();return;}
    let pathname;try{pathname=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end();return;}
    if(!pathname.startsWith(prefix+'/')){res.writeHead(404).end();return;}
    if(legacyWorker && pathname===prefix+'/sw.js'){
      res.setHeader('Content-Type',MIME['.js']);
      res.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>e.ports[0]?.postMessage({ok:true,records:[]}));");
      return;
    }
    let file=path.resolve(root,'.'+pathname.slice(prefix.length));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const base='http://127.0.0.1:'+server.address().port+prefix;
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const failures=[],errors=[];
  const check=async(name,fn)=>{try{await fn();console.log('PASS',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL',name,e.message);}};
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
    const goto=route=>page.goto(base+route,{waitUntil:'load'});
    const capture=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(shots,name+'.png')});}};
    await check('главная и нижнее меню содержат все разделы и карты',async()=>{
      await goto('/');
      assert.equal(await page.locator('.mobile-dock a').count(),5);
      assert.deepEqual(await page.locator('.quick-grid a').allTextContents(),['Правила','Механики','Сеттинг и Лор','Государства','Картография','Новостные Свитки','Сезоны']);
      assert.equal(await page.locator('.season-brief').count(),1);
      assert.equal(await page.locator('#myCountrySelect,.home-news').count(),0);
      assert.equal(await page.locator('.mobile-dock a').nth(1).getAttribute('href'),prefix+'/rules/');
      assert.equal(await page.locator('.mobile-dock a').nth(2).getAttribute('href'),prefix+'/maps/');
      await capture('home-mobile');
    });
    await check('меню Ещё открывается и возвращает фокус',async()=>{
      await page.locator('#moreNav').click();assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('nav-open')));
      assert.ok(await page.locator('.sidebar a[href="'+prefix+'/library/"]').isVisible());
      await page.locator('#navClose').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'moreNav');
    });
    await check('оглавление и прямые ссылки технической страницы',async()=>{
      await goto('/mechanics/war/');
      await page.locator('.reader-tools [data-open-reader]').click();
      const anchor=page.locator('.reader-contents a').first(),href=await anchor.getAttribute('href');
      await anchor.click();assert.ok(page.url().endsWith(href));
      assert.ok(await page.locator('#readerSheet').evaluate(e=>!e.open));
      await capture('mechanics-mobile');
    });
    await check('размер текста, спокойный фон и избранное сохраняются',async()=>{
      await page.locator('.reader-tools [data-open-reader]').click();
      await page.locator('#readingSize').selectOption('22');await page.locator('#quietReading').check();
      await page.locator('#readerSheet [data-close-dialog]').click();await page.locator('#favoritePage').click();
      await goto('/library/');assert.match(await page.locator('#favoritesList').innerText(),/Ведение Войн/);
      assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('quiet-reading')));
      await goto('/mechanics/war/');assert.equal(await page.locator('.prose').evaluate(e=>getComputedStyle(e).fontSize),'22px');
      await page.locator('.reader-tools [data-open-reader]').click();
      await page.locator('#readingSize').selectOption('18');await page.locator('#quietReading').uncheck();await page.locator('#readerSheet [data-close-dialog]').click();
    });
    await check('таблицы и продолжение чтения сохраняют позицию',async()=>{
      assert.equal(await page.locator('.prose table').count(),4);
      await page.evaluate(()=>scrollTo(0,1700));await page.waitForTimeout(500);await goto('/');
      await page.locator('#continueReading').click();await page.waitForFunction(()=>scrollY>1200);
    });
    await check('поиск различает правила и механики и понимает сокращения',async()=>{
      await goto('/search/?q='+encodeURIComponent('ТП'));
      await page.locator('.searchpage [data-search-filter="mechanics"]').click();
      await page.waitForFunction(()=>[...document.querySelectorAll('#pageSearchResults .fres')].some(a=>a.pathname.endsWith('/mechanics/war/')));
      assert.ok((await page.locator('#pageSearchResults .fres').evaluateAll(links=>links.map(a=>a.pathname))).every(u=>u.includes('/mechanics/')));
      await page.locator('#pageSearchResults .fres').first().click();await goto('/search/');
      assert.match(await page.locator('.searchpage .search-recent').innerText(),/ТП/);
      await page.locator('#pageSearchInput').fill('правила');
      await page.locator('.searchpage [data-search-filter="rules"]').click();
      await page.waitForSelector('#pageSearchResults .fres');
      assert.ok((await page.locator('#pageSearchResults .fres').evaluateAll(links=>links.map(a=>a.pathname))).every(u=>u.includes('/rules/')));
      assert.equal(await page.locator('.searchpage [data-search-filter="maps"],.searchpage [data-search-filter="news"]').count(),2);
      await capture('search-mobile');
    });
    await check('сюжетные страницы и исходники прошлого сезона отвечают 404',async()=>{
      for(const route of ['/countries/srebrno/','/lore/medrin-ii/','/season/lore/','/season/podv/','/season/location/','/other/medrin-ii/','/content/countries/srebrno.md','/img/season-cover.webp']){
        const response=await context.request.get(base+route);assert.equal(response.status(),404,route);
      }
    });
    await check('атлас открывает карты, увеличивает их и переключает изображения',async()=>{
      await goto('/maps/physical/');
      await page.locator('.map-open').click();
      await page.waitForFunction(()=>document.getElementById('mapImage').naturalWidth>0 && document.getElementById('mapViewer').open);
      assert.equal(await page.locator('#mapZoom').evaluate(e=>e.value),'100%');
      await page.locator('#mapZoomIn').click();assert.equal(await page.locator('#mapZoom').evaluate(e=>e.value),'150%');
      await page.locator('#mapReset').click();assert.equal(await page.locator('#mapZoom').evaluate(e=>e.value),'100%');
      await page.locator('#mapSelect').selectOption('/maps/political/');
      await page.waitForFunction(()=>document.getElementById('mapImage').naturalWidth>0 && document.getElementById('mapImage').alt==='Политическая карта');
      assert.equal(await page.locator('.map-point').count(),0);
      await capture('maps-mobile');
      await page.locator('#mapSelect').selectOption('/maps/resources/');assert.match(await page.locator('#mapMessage').innerText(),/пока не опубликована/);
      await page.locator('#mapViewer [data-close-dialog]').click();
    });
    await check('офлайн: сохранение, чтение, библиотека и удаление',async()=>{
      await goto('/mechanics/war/');await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      await page.locator('#saveOffline').click();await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('Сохранена'));
      networkEnabled=false;
      try{
        await context.setOffline(true);await page.reload();assert.match(await page.locator('h1').innerText(),/Ведение Войн/);
        await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('офлайн-копию'));
        await goto('/library/');await page.waitForFunction(()=>document.getElementById('offlineList').textContent.includes('Ведение Войн'));
        await capture('offline-library');
        await page.locator('#offlineList button').click();await page.waitForFunction(()=>document.getElementById('offlineList').textContent.includes('Пока нет копий'));
        await goto('/mechanics/research/');assert.match(await page.locator('h1').innerText(),/без интернета/);
        const missing=await goto('/countries/srebrno/');assert.equal(missing.status(),404);
        assert.doesNotMatch(await page.locator('body').innerText(),/Княжество Сребрно/);
      }finally{networkEnabled=true;await context.setOffline(false);}
    });
    await check('обновление удаляет старые офлайн-досье и сохраняет технические копии',async()=>{
      const old=await browser.newContext({viewport:{width:390,height:844}});
      const p=await old.newPage();p.setDefaultTimeout(15000);
      try{
        legacyWorker=true;
        await p.goto(base+'/');await p.evaluate(()=>navigator.serviceWorker.ready);
        await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
        await p.evaluate(async()=>{
          const E=window.Ercyon,prefix='ercyon-'+(E.base+'/').replace(/[^a-z0-9]/gi,'_');
          const cache=await caches.open(prefix+'-saved-v1');
          await cache.put(E.href('/countries/aitia/'),new Response('<h1>Удалённый лор</h1>',{headers:{'Content-Type':'text/html','X-Ercyon-Title':encodeURIComponent('Аития')}}));
          const response=await fetch(E.href('/mechanics/war/'));
          const headers=new Headers(response.headers);headers.set('X-Ercyon-Title',encodeURIComponent('Ведение Войн'));
          headers.set('X-Ercyon-Saved','2026-10-31T00:00:00Z');
          await cache.put(E.href('/mechanics/war/'),new Response(await response.text(),{headers}));
          const shell=await caches.open(prefix+'-shell-old');await shell.put(E.href('/countries/aitia/'),new Response('Старая оболочка'));
          E.write('favorites',[{url:'/countries/aitia/',title:'Аития'},{url:'/rules/',title:'Правила'}]);
          E.write('positions',{'/countries/aitia/':{url:'/countries/aitia/',y:800},'/mechanics/war/':{url:'/mechanics/war/',y:1000}});
          E.write('lastReading',{url:'/news/old/',title:'Сюжет'});
          E.write('myCountry','/countries/aitia/');E.write('reading',{size:22,quiet:true});
        });
        legacyWorker=false;
        await p.evaluate(async()=>{
          const registration=await navigator.serviceWorker.getRegistration();
          const changed=new Promise((resolve,reject)=>{
            navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});
            setTimeout(()=>reject(new Error('Обновление service worker не завершилось')),20000);
          });
          await registration.update();await changed;
        });
        await p.reload();
        const state=await p.evaluate(async()=>{
          const E=window.Ercyon,prefix='ercyon-'+(E.base+'/').replace(/[^a-z0-9]/gi,'_');
          const cache=await caches.open(prefix+'-saved-v1');
          return{favorites:E.list('favorites'),positions:Object.keys(E.read('positions',{})),last:E.read('lastReading',null),country:E.read('myCountry',null),reading:E.read('reading',{}),
            urls:(await cache.keys()).map(r=>new URL(r.url).pathname),keys:await caches.keys()};
        });
        assert.deepEqual(state.favorites,[{url:'/rules/',title:'Правила'}]);
        assert.deepEqual(state.positions,['/mechanics/war/']);assert.equal(state.last,null);assert.equal(state.country,null);
        assert.deepEqual(state.reading,{size:22,quiet:true});assert.deepEqual(state.urls,[prefix+'/mechanics/war/']);
        assert.ok(!state.keys.some(k=>k.endsWith('-shell-old')));
        networkEnabled=false;await old.setOffline(true);await p.goto(base+'/mechanics/war/');
        assert.match(await p.locator('h1').innerText(),/Ведение Войн/);
        const missing=await p.goto(base+'/countries/aitia/');assert.equal(missing.status(),404);
        assert.doesNotMatch(await p.locator('body').innerText(),/Удалённый лор/);
      }finally{legacyWorker=false;networkEnabled=true;await old.close();}
    });
    await check('320–1440px: страницы не выходят за ширину экрана',async()=>{
      for(const width of [320,390,768,1440]){
        await page.setViewportSize({width,height:900});
        for(const route of ['/','/rules/','/mechanics/','/mechanics/posts/','/mechanics/metal/','/mechanics/war/']){
          await goto(route);const excess=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(excess<=2,width+' '+route+': '+excess);
        }
        if(width===1440){await goto('/');await capture('desktop');}
      }
    });
    await check('правила, механики и ссылки доступны без JavaScript',async()=>{
      const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),p=await nojs.newPage();
      try{
        await p.goto(base+'/');assert.equal(await p.locator('.quick-grid a').count(),7);
        await p.locator('.quick-grid').scrollIntoViewIfNeeded();
        await p.locator('.quick-grid a').first().click();assert.match(p.url(),/\/rules\/$/);
        await p.goto(base+'/mechanics/war/');assert.equal(await p.locator('.prose table').count(),4);
        assert.equal(await p.locator('.prose img').count(),0);
      }finally{await nojs.close();}
    });
    await check('нет ошибок JavaScript',()=>assert.deepEqual(errors,[]));
  }finally{await browser.close();server.close();server.closeAllConnections();}
  if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
