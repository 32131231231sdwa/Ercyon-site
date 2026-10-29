/* Дополнительная проверка в Chromium: PLAYWRIGHT_MODULE может указывать на локальный Playwright. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../dist'),prefix=(process.env.BASE_PATH||'').replace(/\/$/,'');
const shots=process.env.SCREENSHOT_DIR;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg'};
(async()=>{
  let networkEnabled=true;
  const server=http.createServer((req,res)=>{
    if(!networkEnabled){req.socket.destroy();return;}
    let pathname;try{pathname=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end();return;}
    if(!pathname.startsWith(prefix+'/')){res.writeHead(404).end();return;}
    let file=path.resolve(root,'.'+pathname.slice(prefix.length));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const failures=[],errors=[];
  const check=async(name,fn)=>{try{await fn();console.log('PASS',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL',name,e.message);}};
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
    const goto=route=>page.goto(base+route,{waitUntil:'load'});
    const capture=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png')});}};
    await check('главная: быстрые ссылки в первом экране и нижняя навигация',async()=>{
      await goto('/');assert.equal(await page.locator('.mobile-dock a').count(),5);
      assert.ok(await page.locator('.quick-grid').first().evaluate(e=>e.getBoundingClientRect().bottom<innerHeight-65));
      await page.locator('#myCountrySelect').selectOption('/countries/aitia/');
      await page.reload();assert.equal(await page.locator('#myCountrySelect').inputValue(),'/countries/aitia/');
      await capture('home-mobile');
    });
    await check('меню Ещё и возврат фокуса',async()=>{
      await page.locator('#moreNav').click();assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('nav-open')));
      assert.ok(await page.locator(`.sidebar a[href="${prefix}/library/"]`).isVisible());
      await page.locator('#navClose').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'moreNav');
    });
    await check('вкладки страны, прямые ссылки и история браузера',async()=>{
      await goto('/countries/aitia/');assert.equal(await page.locator('[data-country-panel]:visible').count(),1);
      await page.locator('.dossier-nav a[href="#country-army"]').click();
      assert.ok(await page.locator('[data-country-panel="country-army"]').isVisible());
      await page.locator('.dossier-nav a[href="#country-resources"]').click();
      await page.goBack();assert.ok(await page.locator('[data-country-panel="country-army"]').isVisible());
      await goto('/countries/aitia/#country-resources');assert.ok(await page.locator('.dossier-legacy').isVisible());
      await capture('country-mobile');
    });
    await check('оглавление открывает скрытое описание страны',async()=>{
      await page.locator('.reader-tools [data-open-reader]').click();
      await page.locator('.reader-contents a').filter({hasText:'ИСТОРИЯ'}).first().click();
      assert.ok(await page.locator('.country-history').evaluate(e=>e.open));
      assert.ok(await page.locator('[data-country-panel="country-overview"]').isVisible());
      assert.ok(await page.locator('#readerSheet').evaluate(e=>!e.open));
    });
    await check('крупный текст, спокойный фон, избранное',async()=>{
      await page.locator('.reader-tools [data-open-reader]').click();await page.locator('#readingSize').selectOption('22');await page.locator('#quietReading').check();
      await page.locator('#readerSheet [data-close-dialog]').click();
      await page.locator('#favoritePage').click();
      await goto('/library/');assert.match(await page.locator('#favoritesList').innerText(),/Аития/);
      assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('quiet-reading')));
      await goto('/mechanics/war/');assert.equal(await page.locator('.prose').evaluate(e=>getComputedStyle(e).fontSize),'22px');
      await page.locator('.reader-tools [data-open-reader]').click();await page.locator('#readingSize').selectOption('18');await page.locator('#quietReading').uncheck();await page.locator('#readerSheet [data-close-dialog]').click();
    });
    await check('текстовые таблицы и сохранение позиции чтения',async()=>{
      assert.equal(await page.locator('.prose table').count(),4);assert.equal(await page.locator('.prose img').count(),0);
      await page.evaluate(()=>scrollTo(0,1700));await page.waitForTimeout(500);await goto('/');
      await page.locator('#continueReading').click();await page.waitForFunction(()=>scrollY>1200);
    });
    await check('поиск: сокращения и фильтры',async()=>{
      await goto('/search/?q='+encodeURIComponent('ТП'));
      await page.waitForSelector('#pageSearchResults .fres');
      await page.locator('.searchpage [data-search-filter="rules"]').click();
      await page.waitForFunction(()=>[...document.querySelectorAll('#pageSearchResults .fres')].some(a=>a.pathname.endsWith('/mechanics/war/')));
      const hrefs=await page.locator('#pageSearchResults .fres').evaluateAll(links=>links.map(a=>a.pathname));assert.ok(hrefs.every(u=>/\/(rules|mechanics)\//.test(u)));
      await page.locator('#pageSearchResults .fres').first().click();await goto('/search/');
      assert.match(await page.locator('.searchpage .search-recent').innerText(),/ТП/);
      await capture('search-mobile');
    });
    await check('атлас: масштаб, перетаскивание, переключение и отсутствие карты',async()=>{
      await goto('/maps/political/');await page.locator('.map-open').click();
      await page.waitForFunction(()=>document.querySelector('#mapImage').naturalWidth>0 && !document.querySelector('#mapCanvas').hidden);
      assert.match(await page.locator('#mapOriginal').getAttribute('href'),/20261025131426/);
      await page.locator('#mapZoomIn').click();assert.equal(await page.locator('#mapZoom').innerText(),'150%');
      const stage=page.locator('#mapStage');const b=await stage.boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+20,b.y+40,{steps:4});await page.mouse.up();
      await page.locator('#mapReset').click();assert.equal(await page.locator('#mapZoom').innerText(),'100%');
      const client=await context.newCDPSession(page);
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:300},{x:240,y:300}]});
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:300},{x:290,y:300}]});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.ok(parseInt(await page.locator('#mapZoom').innerText())>150);
      await capture('map-mobile');
      await page.locator('#mapSelect').selectOption('/maps/resources/');assert.match(await page.locator('#mapMessage').innerText(),/пока не опубликована/);
      await page.locator('#mapSelect').selectOption('/maps/physical/');await page.waitForFunction(()=>document.querySelector('#mapImage').naturalWidth>0);
      await page.evaluate(()=>{window.__MAPS__.find(m=>m.url==='/maps/political/').points=[{x:50,y:50,title:'Проверочная метка',url:'/countries/aitia/'}];});
      await page.locator('#mapSelect').selectOption('/maps/political/');
      await page.locator('.map-point').click();await page.waitForURL(base+'/countries/aitia/');
    });
    await check('офлайн: сохранение, перезагрузка, библиотека, удаление',async()=>{
      await goto('/mechanics/war/');await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      await page.locator('#saveOffline').click();await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('Сохранена'));
      networkEnabled=false;
      try {
      await context.setOffline(true);await page.reload();assert.match(await page.locator('h1').innerText(),/Ведение Войн/);
      await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('офлайн-копию'));
      await goto('/library/');await page.waitForFunction(()=>document.getElementById('offlineList').textContent.includes('Ведение Войн'));
      await capture('offline-library');
      await page.locator('#offlineList button').click();await page.waitForFunction(()=>document.getElementById('offlineList').textContent.includes('Пока нет копий'));
      await goto('/mechanics/research/');assert.match(await page.locator('h1').innerText(),/без интернета/);
      } finally {networkEnabled=true;await context.setOffline(false);}
    });
    await check('320–1440px: нет горизонтального переполнения',async()=>{
      for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});for(const route of ['/','/countries/aitia/','/mechanics/war/']){await goto(route);const excess=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(excess<=2,`${width} ${route}: ${excess}`);}if(width===1440)await capture('desktop');}
    });
    await check('без JavaScript доступны все разделы и исходные карты',async()=>{
      const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const p=await nojs.newPage();
      await p.goto(base+'/countries/aitia/');assert.equal(await p.locator('[data-country-panel]:visible').count(),5);
      await p.locator('.dossier-nav a[href="#country-resources"]').click();assert.match(p.url(),/#country-resources$/);
      await p.goto(base+'/maps/political/');assert.match(await p.locator('.map-actions a').getAttribute('href'),/20261025131426/);await nojs.close();
    });
    await check('нет ошибок JavaScript',()=>assert.deepEqual(errors,[]));
  }finally{await browser.close();server.close();server.closeAllConnections();}
  if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
