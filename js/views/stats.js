// stats.js — آمار: پیش‌بینی مرور، نقشه‌ی فعالیت، وضعیت کارت‌ها، دقت و زمان.
import * as store from '../store.js';
import { forecast } from '../srs.js';
import { h, icon, mount, n, pct, fmtDuration, dayWeekday, dayDateFull, dayNum, dayCol } from '../util.js';

const WEEKS = 16;
const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // شنبه … جمعه

/** بالای محور را به عددی «گرد» با نیمه‌ی صحیح می‌رساند. */
function niceMax(v) {
  if (v <= 10) return Math.max(2, Math.ceil(v / 2) * 2);
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1.2, 1.6, 2, 3, 4, 5, 6, 8, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

export function render(root) {
  const S = store.state();
  const t = store.today();
  const tot = store.totals();
  const counts = store.counts();
  const ret = store.retention(30);
  const today = store.daily(t);

  const tip = h('div', { class: 'tip', role: 'tooltip', hidden: true });
  const page = h('div', { class: 'page stats' },
    h('header', { class: 'page-head' }, h('div', {}, h('h1', {}, 'آمار'), h('p', { class: 'muted' }, tot.n ? `${n(tot.n)} مرور در ${n(tot.days)} روز` : 'هنوز مروری ثبت نشده است.'))),

    h('section', { class: 'tiles t5' },
      tile('امروز', n(today.n), today.ms ? fmtDuration(today.ms) : 'مرور'),
      tile('روز پیاپی', n(store.streak()), 'بهترین: ' + n(store.bestStreak())),
      tile('دقت ۳۰ روز', ret ? pct(ret.rate) : '—', ret ? `از ${n(ret.n)} پاسخ` : 'داده‌ای نیست'),
      tile('زمان کل', tot.ms ? fmtDuration(tot.ms) : '—', 'مطالعه'),
      tile('تمرین واقعی', n(store.practiceTotal()), 'روز انجام‌شده')),

    forecastCard(S, t),
    heatCard(t),
    statusCard(counts),
    tip);

  mount(root, page);
  wireTips(page, tip);

  // ── پیش‌بینی ───────────────────────────────────────────────────────────────
  function forecastCard(S, t) {
    const N = 14;
    const f = forecast(S.cards, S.prog, Date.now(), S.settings, N);
    const max = niceMax(Math.max(1, ...f));
    const label = (i) => (i === 0 ? 'امروز' : i === 1 ? 'فردا' : dayNum(t + i));
    const tipText = (i) => `${i === 0 ? 'امروز' : dayWeekday(t + i) + '، ' + dayDateFull(t + i)}: ${n(f[i])} کارت`;
    const total = f.reduce((a, b) => a + b, 0);
    return h('section', { class: 'card chart-card' },
      h('div', { class: 'card-head' }, h('span', { class: 'kicker' }, 'پیش‌بینی مرور ۱۴ روز آینده'), h('span', { class: 'muted' }, `${n(total)} کارت`)),
      h('div', { class: 'bars', role: 'img', 'aria-label': 'نمودار میله‌ای پیش‌بینی مرور' },
        h('div', { class: 'yaxis' }, ...[max, max / 2, 0].map((v) => h('span', {}, n(Math.round(v))))),
        h('div', { class: 'plot' },
          h('div', { class: 'grid' }, h('i', {}), h('i', {}), h('i', {})),
          h('div', { class: 'cols' }, ...f.map((v, i) =>
            h('div', { class: 'col', tabindex: 0, 'data-tip': tipText(i), 'aria-label': tipText(i) },
              h('div', { class: 'slot' }, v > 0 && h('div', { class: 'bar' + (i === 0 ? ' now' : ''), style: { height: (v / max * 100).toFixed(1) + '%' } })),
              h('span', { class: 'xl' }, label(i))))))),
      table('جدول مقادیر', ['روز', 'کارت'], f.map((v, i) => [i === 0 ? 'امروز' : dayDateFull(t + i), n(v)])));
  }

  // ── نقشه‌ی فعالیت ──────────────────────────────────────────────────────────
  function heatCard(t) {
    // ستون آخر = هفته‌ی جاری؛ ردیف‌ها شنبه تا جمعه
    const lastCol = dayCol(t);
    const start = t - lastCol - (WEEKS - 1) * 7;
    const level = (v) => (v <= 0 ? 0 : v < 5 ? 1 : v < 10 ? 2 : v < 20 ? 3 : 4);
    const cols = [];
    for (let w = 0; w < WEEKS; w++) {
      const cells = [];
      for (let r = 0; r < 7; r++) {
        const d = start + w * 7 + r;
        if (d > t) { cells.push(h('i', { class: 'cell future' })); continue; }
        const v = store.daily(d).n;
        const txt = `${dayWeekday(d)}، ${dayDateFull(d)}: ${n(v)} مرور`;
        cells.push(h('i', { class: 'cell l' + level(v) + (d === t ? ' now' : ''), tabindex: 0, 'data-tip': txt, 'aria-label': txt }));
      }
      cols.push(h('div', { class: 'hcol' }, ...cells));
    }
    return h('section', { class: 'card chart-card' },
      h('div', { class: 'card-head' }, h('span', { class: 'kicker' }, `فعالیت ${n(WEEKS)} هفته‌ی اخیر`)),
      h('div', { class: 'heat', role: 'img', 'aria-label': 'نقشه‌ی فعالیت مرور' },
        h('div', { class: 'hdays' }, ...WD.map((d) => h('span', {}, d))),
        h('div', { class: 'hgrid' }, ...cols)),
      h('div', { class: 'heat-legend' }, h('span', { class: 'muted' }, 'کمتر'), ...[0, 1, 2, 3, 4].map((l) => h('i', { class: 'cell l' + l })), h('span', { class: 'muted' }, 'بیشتر')));
  }

  // ── وضعیت کارت‌ها ──────────────────────────────────────────────────────────
  function statusCard(c) {
    const parts = [
      ['new', 'جدید', c.new], ['learning', 'در حال یادگیری', c.learning], ['young', 'مرور', c.young], ['mature', 'مسلط', c.mature], ['susp', 'معلق', c.susp],
    ];
    const total = Math.max(1, c.total);
    return h('section', { class: 'card chart-card' },
      h('div', { class: 'card-head' }, h('span', { class: 'kicker' }, 'وضعیت کارت‌ها'), h('span', { class: 'muted' }, `${n(c.total)} کارت`)),
      h('div', { class: 'stack', role: 'img', 'aria-label': 'نمودار وضعیت کارت‌ها' },
        ...parts.filter((p) => p[2] > 0).map(([k, l, v]) => h('div', { class: 'seg s-' + k, style: { flexGrow: v }, tabindex: 0, 'data-tip': `${l}: ${n(v)} کارت (${pct(v / total)})`, 'aria-label': `${l}: ${n(v)}` }))),
      h('ul', { class: 'legend' }, ...parts.map(([k, l, v]) =>
        h('li', {}, h('i', { class: 'sw s-' + k }), h('span', {}, l), h('b', {}, n(v))))));
  }
}

function tile(label, value, sub) {
  return h('div', { class: 'tile flat' }, h('span', { class: 'tile-lb' }, label), h('b', {}, value), h('small', {}, sub));
}

function table(summary, heads, rows) {
  return h('details', { class: 'tbl' },
    h('summary', {}, summary),
    h('table', {}, h('thead', {}, h('tr', {}, ...heads.map((x) => h('th', {}, x)))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((x) => h('td', {}, x)))))));
}

/** یک tooltip مشترک برای همه‌ی عناصر دارای data-tip (موس، لمس و صفحه‌کلید). */
function wireTips(scope, tip) {
  let cur = null;
  const show = (el) => {
    cur = el; tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect(), b = scope.getBoundingClientRect();
    const w = tip.offsetWidth;
    let x = r.left + r.width / 2 - b.left - w / 2;
    x = Math.max(4, Math.min(b.width - w - 4, x));
    tip.style.left = x + 'px';
    tip.style.top = (r.top - b.top - tip.offsetHeight - 8) + 'px';
  };
  const hide = () => { cur = null; tip.hidden = true; };
  scope.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-tip]'); if (el && el !== cur) show(el); else if (!el) hide(); });
  scope.addEventListener('pointerleave', hide);
  scope.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  scope.addEventListener('focusout', hide);
  scope.addEventListener('click', (e) => { const el = e.target.closest('[data-tip]'); if (el) show(el); else hide(); });
  scope.style.position = 'relative';
}
