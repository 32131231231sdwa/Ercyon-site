(() => {
  const E=window.Ercyon,maps=window.__MAPS__||[],dialog=document.getElementById('mapViewer');
  if(!E||!dialog)return;
  const stage=document.getElementById('mapStage'),canvas=document.getElementById('mapCanvas'),image=document.getElementById('mapImage');
  const selector=document.getElementById('mapSelect'),message=document.getElementById('mapMessage'),points=document.getElementById('mapPoints');
  const original=document.getElementById('mapOriginal'),zoomLabel=document.getElementById('mapZoom');
  let scale=1,fitScale=1,x=0,y=0,loaded=false,opener;
  const pointers=new Map();let gesture=null;
  const bound=(value,min,max)=>Math.max(min,Math.min(max,value));
  const paint=()=>{
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    x=w<=stage.clientWidth?(stage.clientWidth-w)/2:bound(x,stage.clientWidth-w,0);
    y=h<=stage.clientHeight?(stage.clientHeight-h)/2:bound(y,stage.clientHeight-h,0);
    canvas.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
    zoomLabel.value=Math.round(scale/fitScale*100)+'%';
    points.style.setProperty('--marker-scale',1/scale);
  };
  const fit=()=>{if(!loaded||!dialog.open)return;fitScale=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight);scale=fitScale;x=0;y=0;paint();};
  const zoom=(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2)=>{if(!loaded)return;const next=bound(scale*factor,fitScale,Math.max(1,fitScale*12));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;paint();};
  const load=()=>{
    const map=maps.find(m=>m.url===selector.value);loaded=false;pointers.clear();gesture=null;points.replaceChildren();image.removeAttribute('src');canvas.hidden=true;
    original.hidden=!map?.image;
    if(!map?.image){message.textContent='Эта карта пока не опубликована. Выберите другую карту.';message.hidden=false;return;}
    message.hidden=false;message.textContent='Загружаем карту…';original.href=E.href(map.image);image.alt=map.title;
    image.onload=()=>{loaded=true;canvas.hidden=false;canvas.style.width=image.naturalWidth+'px';canvas.style.height=image.naturalHeight+'px';message.hidden=true;fit();};
    image.onerror=()=>{message.hidden=false;message.textContent='Карта не загрузилась. Проверьте соединение и выберите её ещё раз.';};
    image.src=E.href(map.image);
    for(const point of map.points || []){const a=document.createElement('a');a.href=E.href(point.url);a.className='map-point';a.style.left=point.x+'%';a.style.top=point.y+'%';a.textContent=point.title;a.title='Открыть досье: '+point.title;points.append(a);}
  };
  const open=button=>{opener=button;dialog.showModal();load();};
  const action=document.createElement('button');action.type='button';action.className='btn btn--gold map-open';action.textContent='Открыть атлас на весь экран';action.onclick=()=>open(action);
  document.querySelector('.map-links')?.after(action);
  document.querySelectorAll('.prose .fig__link,.prose .map-actions a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();open(a);}));
  selector.addEventListener('change',load);
  document.getElementById('mapZoomIn').onclick=()=>zoom(1.5);
  document.getElementById('mapZoomOut').onclick=()=>zoom(1/1.5);
  document.getElementById('mapReset').onclick=fit;
  const gestureStart=()=>{const p=[...pointers.values()];if(p.length===2){const cx=(p[0].x+p[1].x)/2,cy=(p[0].y+p[1].y)/2;gesture={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),scale,worldX:(cx-x)/scale,worldY:(cy-y)/scale};}else gesture=null;};
  const point=e=>{const r=stage.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  stage.addEventListener('pointerdown',e=>{if(!loaded||e.target.closest('a'))return;e.preventDefault();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));gestureStart();});
  stage.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const p=point(e);pointers.set(e.pointerId,p);if(pointers.size===2&&gesture){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);scale=bound(gesture.scale*distance/Math.max(1,gesture.distance),fitScale,Math.max(1,fitScale*12));x=(a.x+b.x)/2-gesture.worldX*scale;y=(a.y+b.y)/2-gesture.worldY*scale;}else if(pointers.size===1){x+=p.x-old.x;y+=p.y-old.y;}paint();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,e=>{pointers.delete(e.pointerId);gestureStart();});
  stage.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(e.deltaY<0?1.15:1/1.15,p.x,p.y);},{passive:false});
  stage.addEventListener('dblclick',e=>{const p=point(e);zoom(2,p.x,p.y);});
  stage.addEventListener('keydown',e=>{if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();if(['+','='].includes(e.key))zoom(1.5);else if(e.key==='-')zoom(1/1.5);else if(e.key==='Home')fit();else{x+=e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0;y+=e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0;paint();}}});
  new ResizeObserver(()=>fit()).observe(stage);
  dialog.addEventListener('close',()=>{pointers.clear();opener?.focus({preventScroll:true});});
})();
