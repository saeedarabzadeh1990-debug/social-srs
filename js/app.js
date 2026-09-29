// app.js — راه‌اندازی، مسیریابی (hash) و ناوبری.
import * as store from './store.js';
import * as P from './platform.js';
import { h, mount, icon, $, n, toast } from './util.js';
import * as home from './views/home.js';
import * as study from './views/study.js';
import * as browse from './views/browse.js';
import * as stats from './views/stats.js';
import * as settings from './views/settings.js';
import { openEditor } from './views/editor.js';

const ROUTES = { home, study, browse, stats, settings };
const NAV = [
  ['home', 'امروز', 'home'],
  ['study', 'مرور', 'play'],
  ['browse', 'کارت‌ها', 'cards'],
  ['stats', 'آمار', 'chart'],
  ['settings', 'تنظیمات', 'sliders'],
];

let cleanup = null;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const [name, ...rest] = path.split('/');
  return { name: ROUTES[name] ? name : 'home', rest, q: new URLSearchParams(qs || '') };
}

function buildNav() {
  mount($('#nav'), ...NAV.map(([id, label, ic]) =>
    h('a', { href: '#/' + id, class: 'nav-item', 'data-id': id },
      h('span', { class: 'nav-ic' }, icon(ic), h('i', { class: 'dot', hidden: true })),
      h('span', { class: 'nav-lb' }, label))));
}

export function refreshChrome() {
  const total = store.session().total;
  P.updateBadge(total);
  document.title = (total ? `(${n(total)}) ` : '') + 'Social SRS — فلش‌کارت معاشرت';
  const dot = $('.nav-item[data-id=study] .dot');
  if (dot) dot.hidden = total === 0;
}

function highlight(name) {
  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.dataset.id === name;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function draw() {
  const r = parse();
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  document.body.classList.toggle('focus', r.name === 'study');
  document.body.dataset.route = r.name;
  highlight(r.name);
  const view = $('#view');
  const out = ROUTES[r.name].render(view, r);
  if (typeof out === 'function') cleanup = out;
  view.scrollTop = 0; window.scrollTo(0, 0);
  refreshChrome();
}

function handleLaunchAction() {
  const u = new URL(location.href);
  const action = u.searchParams.get('action');
  if (!action) return;
  u.searchParams.delete('action'); u.searchParams.delete('source');
  history.replaceState(null, '', u.pathname + u.search + (action === 'study' ? '#/study' : location.hash));
  if (action === 'add') setTimeout(() => openEditor(null), 60);
}

function boot() {
  store.load();
  P.applyAppearance();
  buildNav();
  handleLaunchAction();
  addEventListener('hashchange', draw);
  draw();

  // تغییر داده‌ها ← به‌روزرسانی نشان/عنوان (کم‌هزینه و با تأخیر)
  let t = null;
  store.onChange(() => { clearTimeout(t); t = setTimeout(refreshChrome, 200); });

  // بازگشت به برنامه (مثلاً فردا صبح) ← تازه‌سازی صفحه
  let lastCheck = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (parse().name !== 'study') draw();
    // برنامه‌ی نصب‌شده ممکن است روزها در پس‌زمینه بماند؛ هنگام بازگشت (حداکثر هر ۳۰ دقیقه) نسخه‌ی جدید را بررسی کن
    if (Date.now() - lastCheck > 30 * 60 * 1000) { lastCheck = Date.now(); P.checkForUpdate(); }
  });
  // همگام‌سازی بین تب‌ها
  addEventListener('storage', (e) => {
    if (e.key === store.KEY && parse().name !== 'study') { store.load(); P.applyAppearance(); draw(); }
  });

  P.events.addEventListener('update-ready', () => {
    toast('نسخه‌ی جدید برنامه آماده است.', { action: 'به‌روزرسانی', onAction: P.applyUpdate, ms: 0 });
  });
  P.initSW();
  P.persistStorage();
}

boot();
