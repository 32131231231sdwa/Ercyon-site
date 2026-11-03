import test from 'node:test';
import assert from 'node:assert/strict';
import { repairPageLinks } from '../lib/page-links.mjs';

const page = (slug, url, html = '') => ({ kind: 'page', slug, url, html });

test('перенесённые ссылки сохраняют запрос и якорь, старый адрес получает переадресацию', () => {
  const target = page('nominations', '/archive/nominations/');
  const source = page('finale', '/archive/finale/', '<a class="link" href="/season/nominations/?a=1&amp;b=2#vote">Награды</a>');
  const aliases = repairPageLinks([source, target]);
  assert.equal(source.html, '<a class="link" href="/archive/nominations/?a=1&amp;b=2#vote">Награды</a>');
  assert.equal(aliases.get('/season/nominations/'), target);
});

test('действующие адреса, внешние ссылки и файлы остаются прежними', () => {
  const target = page('guide', '/archive/guide/');
  const existing = page('other-guide', '/season/guide/');
  const html = '<a href="/season/guide/">Страница</a><a href="https://example.org/season/guide/">Сайт</a><a href="//example.org/guide/">Сайт</a><a href="/img/guide.png">Файл</a><a data-href="/old/guide/">Данные</a>';
  const source = page('source', '/source/', html);
  assert.equal(repairPageLinks([source, target, existing]).size, 0);
  assert.equal(source.html, html);
});

test('полные адреса своего сайта и ссылки с базовым путём обновляются после переноса', () => {
  const target = page('guide', '/archive/guide/');
  const source = page('source', '/source/', '<a href="https://site.example/project/old/guide/?q=1#section">Полная ссылка</a><a href="/project/old/guide/">С базой</a><a href="https://site.example/another/old/guide/">Другой сайт</a>');
  const aliases = repairPageLinks([source, target], 'https://site.example/project');
  assert.equal(aliases.get('/old/guide/'), target);
  assert.equal(source.html, '<a href="/archive/guide/?q=1#section">Полная ссылка</a><a href="/archive/guide/">С базой</a><a href="https://site.example/another/old/guide/">Другой сайт</a>');
});

test('неоднозначные и удалённые страницы не получают выдуманных адресов', () => {
  const html = '<a href="/old/guide/">Неоднозначно</a><a href="/old/deleted/">Удалено</a>';
  const source = page('source', '/source/', html);
  assert.equal(repairPageLinks([source, page('guide', '/one/guide/'), page('guide', '/two/guide/')]).size, 0);
  assert.equal(source.html, html);
});
