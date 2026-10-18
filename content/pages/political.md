---
title: Политическая карта
category: maps
order: 10
slug: political
summary: Границы держав, города и пр.
---

## Интерактивная карта мира

<div class="map-viewer" id="politicalMapViewer">
  <div class="map-viewer__toolbar">
    <button type="button" class="map-viewer__btn map-viewer__btn--in" title="Приблизить (+)" aria-label="Приблизить">
      <svg class="ico" aria-hidden="true"><use href="#i-zoom-in"/></svg>
    </button>
    <button type="button" class="map-viewer__btn map-viewer__btn--out" title="Отдалить (−)" aria-label="Отдалить">
      <svg class="ico" aria-hidden="true"><use href="#i-zoom-out"/></svg>
    </button>
    <button type="button" class="map-viewer__btn map-viewer__btn--reset" title="Сбросить масштаб (100%)" aria-label="Сбросить масштаб">
      <svg class="ico" aria-hidden="true"><use href="#i-reset"/></svg>
    </button>
    <button type="button" class="map-viewer__btn map-viewer__btn--full" title="Во весь экран (⛶)" aria-label="Во весь экран">
      <svg class="ico" aria-hidden="true"><use href="#i-expand"/></svg>
    </button>
  </div>

  <div class="map-viewer__filter-bar">
    <button type="button" class="map-filter-btn is-active" data-type="all">Все метки</button>
    <button type="button" class="map-filter-btn" data-type="capital">👑 Столицы</button>
    <button type="button" class="map-filter-btn" data-type="battle">⚔️ Битвы и тайны</button>
  </div>

  <div class="map-viewer__viewport">
    <div class="map-viewer__stage">
      <img class="map-viewer__img" src="/img/uploads/Без названия60_20261007223639.webp" width="1255" height="1255" alt="Политическая карта Эрциона" loading="eager">

      <!-- Метки столиц и локаций -->
      <div class="map-pin map-pin--capital" data-type="capital" style="left: 28%; top: 35%; --pin-color: #4A6984;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Форьен"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Форьен</span>
          <span class="map-tooltip__desc">Столица Орсуса Великого. Северная твердыня Итрития Фарьярома.</span>
          <a class="map-tooltip__link" href="/countries/orsus/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 63%; top: 32%; --pin-color: #8C3838;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Аврелия"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Аврелия</span>
          <span class="map-tooltip__desc">Столица Империи Новус. Древний мраморный престол Маршала Медрина.</span>
          <a class="map-tooltip__link" href="/countries/novus/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 74%; top: 56%; --pin-color: #5C636E;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Айзенхейм"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Айзенхейм</span>
          <span class="map-tooltip__desc">Столица Горного Союза Остермарк. Базальтовая цитадель вождя Гуго фон Торна.</span>
          <a class="map-tooltip__link" href="/countries/ostermark/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 42%; top: 64%; --pin-color: #8C4334;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Тетрель"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Тетрель</span>
          <span class="map-tooltip__desc">Столица Республики Соединённых Советов (РСС). Сердце трёх Советов.</span>
          <a class="map-tooltip__link" href="/countries/rus/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 21%; top: 68%; --pin-color: #7E8B9B;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Среброград"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Среброград</span>
          <span class="map-tooltip__desc">Столица Княжества Сребрно. Выборный сейм князя Хенрика.</span>
          <a class="map-tooltip__link" href="/countries/srebrno/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 81%; top: 38%; --pin-color: #8A5D3B;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Бодужье"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Бодужье</span>
          <span class="map-tooltip__desc">Столица Тугусской Империи. Престол Урфия III Великого.</span>
          <a class="map-tooltip__link" href="/countries/tuguss/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 50%; top: 18%; --pin-color: #3A6351;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Эловен"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Эловен</span>
          <span class="map-tooltip__desc">Столица Валлийского царства. Трон Бледной Звезды государыни Аквилегии.</span>
          <a class="map-tooltip__link" href="/countries/valliankindom/">Открыть досье державы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--capital" data-type="capital" style="left: 36%; top: 48%; --pin-color: #4D6B53;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Варгантон"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">Варгантон</span>
          <span class="map-tooltip__desc">Столица Вильветской Республики. Торговые гильдии консула Бюкшина.</span>
          <a class="map-tooltip__link" href="/countries/vilvet/">Открыть досье державы →</a>
        </div>
      </div>

      <!-- Метки битв -->
      <div class="map-pin map-pin--battle" data-type="battle" style="left: 48%; top: 42%; --pin-color: #7C302B;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Долина Семи Ветров"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">⚔️ Долина Семи Ветров</span>
          <span class="map-tooltip__desc">Место Великой войны состояний и взрыва души царя Агреиля.</span>
          <a class="map-tooltip__link" href="/wars/velikaya-voyna-sostoyaniy/">Читать хронику битвы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--battle" data-type="battle" style="left: 59%; top: 25%; --pin-color: #7C302B;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Азерлийский мятеж"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">⚔️ Азерлийский хребет</span>
          <span class="map-tooltip__desc">Мятеж генерала Каллиста против Империи Новус. Оборона ущелья.</span>
          <a class="map-tooltip__link" href="/wars/azerliyskiy-myatezh/">Читать хронику битвы →</a>
        </div>
      </div>

      <div class="map-pin map-pin--battle" data-type="battle" style="left: 44%; top: 54%; --pin-color: #9C7A3C;">
        <span class="map-pin__pulse"></span>
        <span class="map-pin__marker" title="Первый Бастион"></span>
        <div class="map-tooltip" hidden>
          <span class="map-tooltip__title">🛡️ Первый Бастион</span>
          <span class="map-tooltip__desc">Вход в Подземелье спящих Итреидов под началом ведущего Йорья.</span>
          <a class="map-tooltip__link" href="/lore/location/">Спуститься в подземье →</a>
        </div>
      </div>

    </div>
  </div>
  <div class="map-viewer__hint">✦ Колёсико / щипок: приближение · Зажать: перемещение по карте</div>
</div>

Карта показывает мир на текущий игровой месяц — **1 Января 1502 года**.

## Обозначения:

- **Сплошная линия** — признанная граница державы, подтверждённая договором или давностью.
- **Пунктир** — спорная граница. Её оспаривают минимум двое, и она может измениться по итогам хода.
- **Штриховка** — уделы в процессе освоения. Станут полноценными в конце хода.
- **Большой Кружок с точкой** — столица.
- **Большой кружок** — большой город город: 
- **Скрещённые клинки** — идущая война или осада.
- **Светлая Штриховка** — претензии.
