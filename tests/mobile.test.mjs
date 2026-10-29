import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from '../vendor/js-yaml.mjs';
import { Marked } from '../vendor/marked.esm.js';
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
  const script=fs.readFileSync(path.join(root,'static/js/storage.js'),'utf8');
  for(const localStorage of [
    {getItem(){throw new Error('Blocked');},setItem(){throw new Error('Blocked');}},
    {getItem(){return '{broken';},setItem(){}},
  ]){
    const window={__BASE__:'/Ercyon-site'};vm.runInNewContext(script,{window,localStorage,document:{getElementById(){return null;}},setTimeout,clearTimeout});
    assert.equal(window.Ercyon.read('test',42),42);assert.equal(window.Ercyon.list('favorites').length,0);
    assert.equal(window.Ercyon.href('//other.example'),'/Ercyon-site/');assert.equal(window.Ercyon.href('/countries/aitia/'),'/Ercyon-site/countries/aitia/');
  }
});

test('просмотрщик использует первую картинку страницы и не выдумывает отсутствующую',()=>{
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  const match=html.match(/window\.__MAPS__ = (\[[^\n]*\]);<\/script>/);
  const maps=JSON.parse(match[1]);
  const marked=new Marked();
  for(const file of fs.readdirSync(path.join(root,'content/pages')).filter(f=>f.endsWith('.md'))){
    const raw=fs.readFileSync(path.join(root,'content/pages',file),'utf8');
    const parts=raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);if(!parts)continue;
    const front=yaml.load(parts[1]);if(front.category!=='maps'||front.draft)continue;
    const expected=(marked.parse(parts[2]).match(/<img[^>]+src="([^"]+)"/)||[])[1]||'';
    assert.equal(maps.find(m=>m.title===front.title)?.image,expected,front.title);
  }
});
