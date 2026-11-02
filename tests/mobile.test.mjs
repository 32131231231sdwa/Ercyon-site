import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');

test('манифест приложения содержит доступные иконки 192 и 512 пикселей',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
  for(const size of ['192x192','512x512'])assert.ok(manifest.icons.some(i=>i.sizes===size));
  const base=(process.env.BASE_PATH||'').replace(/\/$/,'');
  for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(dist,icon.src.slice(base.length))),icon.src);
});

test('все ресурсы офлайн-оболочки существуют в сборке',()=>{
  const sw=fs.readFileSync(path.join(dist,'sw.js'),'utf8');
  assert.ok(!sw.includes('__CACHE_VERSION__'));
  const match=sw.match(/const CORE = (\[[\s\S]*?\]);/);
  assert.ok(match);
  const core=vm.runInNewContext(match[1]);
  for(const url of core){const file=path.join(dist,url,url.endsWith('/')?'index.html':'');assert.ok(fs.existsSync(file),url);}
});

test('личные настройки не ломают страницы при запрете и повреждении хранилища',()=>{
  const script=fs.readFileSync(path.join(dist,'js/storage.js'),'utf8');
  for(const localStorage of [
    {getItem(){throw new Error('Blocked');},setItem(){throw new Error('Blocked');}},
    {getItem(){return '{broken';},setItem(){}},
  ]){
    const window={__BASE__:'/Ercyon-site'};vm.runInNewContext(script,{window,localStorage,document:{getElementById(){return null;}},setTimeout,clearTimeout});
    assert.equal(window.Ercyon.read('test',42),42);assert.equal(window.Ercyon.list('favorites').length,0);
    assert.equal(window.Ercyon.href('//other.example'),'/Ercyon-site/');assert.equal(window.Ercyon.href('/rules/'),'/Ercyon-site/rules/');
    assert.equal(window.Ercyon.isReadable('/countries/aitia/'),false);
  }
});

test('обновление очищает личные ссылки на удалённый лор и сохраняет технические записи и настройки',()=>{
  const prefix='ercyon:/Ercyon-site:';
  const records=new Map();
  const seed=(key,value)=>records.set(prefix+key,JSON.stringify(value));
  seed('favorites',[{url:'/countries/aitia/',title:'Аития'},{url:'/rules/',title:'Правила'}]);
  seed('positions',{'/countries/aitia/':{url:'/countries/aitia/',y:600},'/mechanics/war/':{url:'/mechanics/war/',y:900}});
  seed('lastReading',{url:'/news/old/',title:'Старый сюжет'});
  seed('myCountry','/countries/aitia/');seed('countryTabs',{'/countries/aitia/':'country-army'});
  seed('reading',{size:22,quiet:true});
  const localStorage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
  const window={__BASE__:'/Ercyon-site'};
  vm.runInNewContext(fs.readFileSync(path.join(dist,'js/storage.js'),'utf8'),{window,localStorage,document:{getElementById(){return null;}},setTimeout,clearTimeout});
  assert.deepEqual(JSON.parse(JSON.stringify(window.Ercyon.list('favorites'))),[{url:'/rules/',title:'Правила'}]);
  assert.deepEqual(Object.keys(window.Ercyon.read('positions',{})),['/mechanics/war/']);
  assert.equal(window.Ercyon.read('lastReading',null),null);
  assert.equal(window.Ercyon.read('myCountry',null),null);
  assert.equal(window.Ercyon.read('countryTabs',null),null);
  assert.deepEqual(JSON.parse(JSON.stringify(window.Ercyon.read('reading',{}))),{size:22,quiet:true});
  assert.equal(window.Ercyon.isReadable('/mechanics/war/'),true);
});
