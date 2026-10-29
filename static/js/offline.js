(() => {
  const E=window.Ercyon,info=window.__PAGE__||{};
  if(!E)return;
  const button=document.getElementById('saveOffline'),status=document.getElementById('offlineStatus'),list=document.getElementById('offlineList');
  const date=value=>{const d=new Date(value);return isNaN(d)?'не указана':d.toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  if(!('serviceWorker' in navigator) || !window.isSecureContext){if(button){button.disabled=true;button.title='Офлайн-сохранение недоступно в этом браузере';}if(list)list.textContent='Офлайн-сохранение недоступно. Откройте сайт в Safari, Chrome или другом браузере с поддержкой офлайн-страниц.';return;}
  let workerPromise;
  const worker=()=>workerPromise ||= navigator.serviceWorker.register(E.base+'/sw.js',{scope:E.base+'/',updateViaCache:'none'}).then(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Офлайн-режим пока не готов. Попробуйте ещё раз.')),20000))])).catch(error=>{workerPromise=null;throw error;});
  const request=async data=>{
    const registration=await worker();
    return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(new Error('Не удалось завершить сохранение. Попробуйте ещё раз.'));},20000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data.ok?resolve(event.data):reject(new Error(event.data.error));};registration.active.postMessage(data,[channel.port2]);});
  };
  let savedRecords=[];
  const refresh=async()=>{
    const result=await request({type:'LIST'});savedRecords=result.records;
    const saved=savedRecords.find(r=>r.url===info.url);
    if(button)button.innerHTML=saved?'↻ <span>Обновить копию</span>':'↓ <span>Офлайн</span>';
    if(status){status.hidden=!saved && navigator.onLine;if(saved){status.textContent=`${navigator.onLine?'Копия для чтения без интернета':'Вы читаете офлайн-копию'}. Сохранена ${date(saved.savedAt)}. Данные обновлены ${date(saved.updated)}.`;}else if(!navigator.onLine)status.textContent='Нет соединения. Эта страница не сохранена для чтения офлайн.';}
    if(list){list.replaceChildren();if(!savedRecords.length){list.textContent='Пока нет копий. На нужной странице нажмите «Офлайн».';}for(const record of savedRecords){const row=document.createElement('div');row.className='library-row';const a=document.createElement('a');a.href=E.href(record.url);const title=document.createElement('strong');title.textContent=record.title;const detail=document.createElement('small');detail.textContent=`Сохранена ${date(record.savedAt)} · Данные от ${date(record.updated)}`;a.append(title,detail);const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить';remove.setAttribute('aria-label','Удалить офлайн-копию: '+record.title);remove.onclick=async()=>{try{remove.disabled=true;await request({type:'REMOVE',url:E.href(record.url)});await refresh();}catch(error){E.toast(error.message);remove.disabled=false;}};row.append(a,remove);list.append(row);}}
  };
  button?.addEventListener('click',async()=>{button.disabled=true;try{E.toast('Сохраняем текст и оформление…');await request({type:'SAVE',url:E.href(info.url),title:info.title});await refresh();E.toast('Страница сохранена. Она доступна в «Моём справочнике».');}catch(error){E.toast(error.message);}finally{button.disabled=false;}});
  refresh().catch(error=>{if(list)list.textContent=error.message;});
  window.addEventListener('online',()=>refresh().catch(()=>{}));window.addEventListener('offline',()=>refresh().catch(()=>{}));
  let installPrompt;const install=document.getElementById('installApp');
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(install)install.hidden=false;});
  install?.addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;install.hidden=true;});
})();
