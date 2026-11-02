import { esc } from '../build.mjs';
import { illustration } from './media.mjs';

export function countryInfobox(front, title, rows) {
  const symbols = [['flag', 'Флаг'], ['coat_of_arms', 'Герб']].map(([key, label]) =>
    illustration({ image: front[key], image_caption: label }, {
      alt: `${label}: ${title}`, className: 'country-symbol', sizes: '(min-width: 46rem) 160px, 40vw',
    })).join('');
  const map = illustration({ image: front.map, image_caption: front.map_caption || 'Карта державы' }, {
    alt: front.map_caption || `Карта: ${title}`, className: 'country-map', sizes: '(min-width: 46rem) 340px, calc(100vw - 3rem)',
  });
  return `<section class="country-infobox" aria-label="Краткие сведения о державе">
    <h3 class="country-infobox__title">Краткие сведения</h3>
    <div class="country-infobox__body${symbols || map ? ' country-infobox__body--illustrated' : ''}">
      ${symbols || map ? `<div class="country-infobox__visuals">${symbols ? `<div class="country-symbols">${symbols}</div>` : ''}${map}</div>` : ''}
      <table class="country-infobox__facts"><tbody>${rows.map(([key, value]) =>
        `<tr><th scope="row">${esc(key)}</th><td>${esc(value)}</td></tr>`).join('')}</tbody></table>
    </div>
  </section>`;
}
