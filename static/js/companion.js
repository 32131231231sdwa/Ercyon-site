(() => {
  const E = window.Ercyon, info = window.__PAGE__ || {};
  if (!E) return;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  $$('[data-enhance]').forEach(el=>{el.hidden=false;});
  const options = E.read('reading', {});
  const size = [18,20,22].includes(options?.size) ? options.size : 18;
  document.documentElement.style.setProperty('--reading-size', size+'px');
  document.body.classList.toggle('quiet-reading', options?.quiet === true);

  const sheet = $('#readerSheet');
  let returnFocus;
  $$('[data-open-reader]').forEach(button=>button.addEventListener('click',()=>{returnFocus=button;sheet?.showModal();}));
  const readerBar=$('.reader-tools'),fab=$('.reader-fab');
  if(readerBar && fab && 'IntersectionObserver' in window)new IntersectionObserver(entries=>{fab.hidden=entries[0].isIntersecting || readerBar.getBoundingClientRect().top>0;}).observe(readerBar);
  $$('dialog').forEach(dialog=>{
    dialog.querySelector('[data-close-dialog]')?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog && dialog===sheet)dialog.close();});
    dialog.addEventListener('close',()=>{if(dialog===sheet)returnFocus?.focus({preventScroll:true});});
  });
  if ($('#readingSize')) {
    $('#readingSize').value=String(size); $('#quietReading').checked=options?.quiet===true;
    const change=()=>{const settings={size:Number($('#readingSize').value),quiet:$('#quietReading').checked};E.write('reading',settings);document.documentElement.style.setProperty('--reading-size',settings.size+'px');document.body.classList.toggle('quiet-reading',settings.quiet);};
    $('#readingSize').addEventListener('change',change);$('#quietReading').addEventListener('change',change);
  }

  // Настоящие ссылки остаются рабочими без JS. С JS открывается только выбранная вкладка.
  const nav=$('.dossier-nav'), panels=$$('[data-country-panel]');
  const historyBlock=$('.country-history');
  if(historyBlock)historyBlock.open=false;
  let printHistoryOpen;
  window.addEventListener('beforeprint',()=>{if(historyBlock){printHistoryOpen=historyBlock.open;historyBlock.open=true;}});
  window.addEventListener('afterprint',()=>{if(historyBlock)historyBlock.open=printHistoryOpen;});
  const openTarget=target=>{
    let node=target?.parentElement;
    while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}
  };
  const tabState=E.read('countryTabs',{});
  const activate=(id,scroll=false)=>{
    if(!nav)return;
    const target=document.getElementById(id);
    const active=target?.closest('[data-country-panel]') || panels.find(p=>p.dataset.countryPanel===id) || panels[0];
    panels.forEach(p=>{p.hidden=p!==active;});
    nav.querySelectorAll('a').forEach(a=>{const selected=a.hash==='#'+active.dataset.countryPanel;a.setAttribute('aria-selected',String(selected));a.tabIndex=selected?0:-1;});
    if(target)openTarget(target);
    const state=tabState && typeof tabState==='object' && !Array.isArray(tabState)?tabState:{};
    state[info.url]=active.dataset.countryPanel;E.write('countryTabs',state);
    if(scroll)(target || active).scrollIntoView({block:'start',behavior:'auto'});
  };
  if(nav){
    nav.setAttribute('role','tablist');nav.classList.add('is-tabs');
    nav.querySelectorAll('a').forEach((a,i)=>{a.setAttribute('role','tab');a.id='country-tab-'+i;const p=panels.find(p=>p.dataset.countryPanel===a.hash.slice(1));if(p){p.id='panel-'+i;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby',a.id);a.setAttribute('aria-controls',p.id);}});
    activate(decodeURIComponent(location.hash.slice(1)) || tabState?.[info.url] || 'country-overview');
    nav.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();history.pushState(null,'',a.hash);activate(a.hash.slice(1),true);});
    nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const links=[...nav.querySelectorAll('a')];let i=links.indexOf(document.activeElement);i=e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowRight'?1:-1)+links.length)%links.length;links[i].focus();links[i].click();});
  }
  const revealHash=()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!id)return;const target=document.getElementById(id);if(!target)return;activate(id);openTarget(target);requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'auto'}));};
  window.addEventListener('hashchange',revealHash);window.addEventListener('popstate',revealHash);
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a || a.closest('.dossier-nav'))return;const id=a.hash.slice(1),target=document.getElementById(decodeURIComponent(id));if(!target)return;sheet?.close();activate(id);openTarget(target);});
  if(location.hash)revealHash();

  const pageLink=(record,detail='')=>{
    const a=document.createElement('a');a.href=E.href(record.url);const span=document.createElement('span'),strong=document.createElement('strong');strong.textContent=record.title;span.append(strong);if(detail){const small=document.createElement('small');small.textContent=detail;span.append(small);}a.append(span);return a;
  };
  const favoriteButton=$('#favoritePage');
  const renderFavorites=()=>{
    const favorites=E.list('favorites');
    const selected=favorites.some(x=>x.url===info.url);
    if(favoriteButton){favoriteButton.setAttribute('aria-pressed',String(selected));favoriteButton.textContent=selected?'★ В избранном':'☆ В избранное';}
    for(const [id,limit] of [['#homeFavorites',3],['#favoritesList',50]]){const box=$(id);if(!box)continue;box.replaceChildren();if(!favorites.length){const p=document.createElement('p');p.className='muted';p.textContent='Отмечайте страницы звёздочкой — они появятся здесь.';box.append(p);}favorites.slice(0,limit).forEach(record=>{const row=document.createElement('div');row.className='library-row';row.append(pageLink(record));if(id==='#favoritesList'){const remove=document.createElement('button');remove.type='button';remove.textContent='Убрать';remove.setAttribute('aria-label','Убрать из избранного: '+record.title);remove.onclick=()=>{E.write('favorites',E.list('favorites').filter(x=>x.url!==record.url));renderFavorites();};row.append(remove);}box.append(row);});}
  };
  favoriteButton?.addEventListener('click',()=>{let records=E.list('favorites');records=records.some(r=>r.url===info.url)?records.filter(r=>r.url!==info.url):[{url:info.url,title:info.title},...records].slice(0,50);if(!E.write('favorites',records))E.toast('Браузер не разрешил сохранение на устройстве.');renderFavorites();});renderFavorites();
  const selector=$('#myCountrySelect'),countryLink=$('#myCountryLink');
  if(selector){const stored=E.read('myCountry','');if([...selector.options].some(o=>o.value===stored))selector.value=stored;const update=()=>{countryLink.href=E.href(selector.value || '/countries/');countryLink.textContent=selector.value?'Открыть мою страну':'Выбрать из каталога';};selector.addEventListener('change',()=>{if(!E.write('myCountry',selector.value))E.toast('Не удалось запомнить страну на этом устройстве.');update();});update();}

  const last=E.read('lastReading',null),resume=$('#continueReading');
  if(resume && last && E.localPath(last.url) && typeof last.title==='string'){resume.href=E.href(last.url)+(last.url.includes('?')?'&':'?')+'resume=1'+(last.hash || '');resume.querySelector('strong').textContent=last.title;resume.querySelector('.continue-detail').textContent=last.progress>0?`Прочитано ${last.progress}%`:'Открыть страницу';resume.hidden=false;}
  const readable=['page','country','news','war','treaty'].includes(info.kind);
  if(readable){
    const positions=E.read('positions',{});const saved=positions?.[info.url];
    let didScroll=false;
    const restore=()=>{if(!saved)return;if(saved.hash && !location.hash){history.replaceState(null,'',saved.hash);revealHash();}if(historyBlock)historyBlock.open=saved.historyOpen===true;requestAnimationFrame(()=>{window.scrollTo({top:Number(saved.y)||0,behavior:'auto'});didScroll=true;});$('#resumeNotice').hidden=true;};
    if(saved?.y>150){$('#resumeNotice').hidden=false;$('#resumeReading').addEventListener('click',restore);if(new URLSearchParams(location.search).has('resume'))restore();}
    const persist=()=>{if(!didScroll && saved?.y>150)return;const y=Math.round(scrollY);const record={url:info.url,title:info.title,y,hash:location.hash,historyOpen:historyBlock?.open===true,progress:Math.round(y/Math.max(1,document.documentElement.scrollHeight-innerHeight)*100),time:Date.now()};const records=E.read('positions',{});const safe=records && typeof records==='object' && !Array.isArray(records)?records:{};safe[info.url]=record;const entries=Object.entries(safe).sort((a,b)=>(b[1]?.time||0)-(a[1]?.time||0)).slice(0,40);E.write('positions',Object.fromEntries(entries));E.write('lastReading',record);};
    let timer;window.addEventListener('scroll',()=>{didScroll=true;clearTimeout(timer);timer=setTimeout(persist,350);},{passive:true});window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});if(!saved)persist();
  }
  $('#sharePage')?.addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.delete('resume');try{if(navigator.share)await navigator.share({title:info.title,url:url.href});else if(navigator.clipboard){await navigator.clipboard.writeText(url.href);E.toast('Ссылка скопирована.');}else{E.toast('Скопируйте адрес страницы из строки браузера.');}}catch(error){if(error.name!=='AbortError')E.toast('Скопируйте ссылку из адресной строки.');}});
  if(info.kind==='home'){
    const previous=E.read('lastHomeVisit',0);$$('[data-updated]').forEach(a=>{if(previous && new Date(a.dataset.updated).getTime()>previous){const badge=document.createElement('small');badge.className='new-badge';badge.textContent='Обновлено';a.append(badge);}});E.write('lastHomeVisit',Date.now());
  }
  $$('.table-wrap').forEach(w=>{w.tabIndex=0;w.setAttribute('role','region');w.setAttribute('aria-label','Таблица. Прокрутите в сторону, чтобы увидеть все столбцы.');});
  const viewport=window.visualViewport;
  const keyboard=()=>document.body.classList.toggle('keyboard-open',!!viewport && window.innerHeight-viewport.height>150 && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName));
  viewport?.addEventListener('resize',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,100));
})();
