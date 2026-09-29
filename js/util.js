// util.js — ابزارهای عمومی: ساخت DOM، آیکن، قالب‌بندی فارسی، دیالوگ و توست.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'open', 'readOnly']);

/** ساخت عنصر DOM. متن‌ها همیشه به‌صورت text node درج می‌شوند (ایمن در برابر XSS). */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, ...kids) { clear(el); append(el, kids); return el; }

// ── آیکن‌ها ────────────────────────────────────────────────────────────────
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  cards: 'M7 4h12a2 2 0 0 1 2 2v10M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM9 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  play: 'M7 4l13 8-13 8z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  exitfs: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  pause: 'M8 5v14M16 5v14',
  eyeoff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3 3.5M6.6 7.6A15 15 0 0 0 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6L6 18',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
  chevron: 'M15 5l-7 7 7 7',
  refresh: 'M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01',
  share: 'M12 16V4M8 8l4-4 4 4M5 13v6h14v-6',
};
const NS = 'http://www.w3.org/2000/svg';
export function icon(name, cls = '') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ic ' + cls);
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name] || '');
  s.append(p);
  return s;
}

// ── قالب‌بندی فارسی ────────────────────────────────────────────────────────
let faDigits = true;
export function setDigits(v) { faDigits = !!v; }
const nfFa = new Intl.NumberFormat('fa-IR'), nfEn = new Intl.NumberFormat('en-US');
export const n = (x) => (faDigits ? nfFa : nfEn).format(x);
export const pct = (x) => n(Math.round(x * 100)) + '٪';
const dec1 = (x) => (faDigits ? new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })).format(x);

/** مدت زمان به‌صورت کوتاه و فارسی (ورودی: میلی‌ثانیه). */
export function fmtDelay(ms) {
  const m = ms / 60000;
  if (m < 1) return 'کمتر از ۱ دقیقه';
  if (m < 60) return n(Math.round(m)) + ' دقیقه';
  const hr = m / 60;
  if (hr < 24) return n(Math.round(hr)) + ' ساعت';
  const d = hr / 24;
  if (d < 30) return n(Math.round(d)) + ' روز';
  if (d < 365) return dec1(d / 30.4) + ' ماه';
  return dec1(d / 365) + ' سال';
}
export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return n(s) + ' ثانیه';
  const m = Math.round(s / 60);
  if (m < 60) return n(m) + ' دقیقه';
  return n(Math.floor(m / 60)) + ' ساعت و ' + n(m % 60) + ' دقیقه';
}

const DAY = 86400000;
const dtf = (opts) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', ...opts });
const dfMed = dtf({ day: 'numeric', month: 'long' });
const dfFull = dtf({ year: 'numeric', month: 'long', day: 'numeric' });
const dfWeek = dtf({ weekday: 'long' });
const dfMonth = dtf({ month: 'short' });
const dfNum = dtf({ day: 'numeric' });
/** شماره‌ی روز مطالعه ← تاریخ شمسی. */
export const dayDate = (d) => dfMed.format(new Date(d * DAY));
export const dayDateFull = (d) => dfFull.format(new Date(d * DAY));
export const dayWeekday = (d) => dfWeek.format(new Date(d * DAY));
export const dayMonth = (d) => dfMonth.format(new Date(d * DAY));
export const dayNum = (d) => (faDigits ? dfNum.format(new Date(d * DAY)) : String(+dfNum.format(new Date(d * DAY)).replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))));
/** روز هفته با شنبه = ۰ */
export const dayCol = (d) => (((d + 4) % 7) + 1) % 7;
export const fmtStamp = (ms) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

export const uid = () => 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** نرمال‌سازی برای جستجو: ی/ک عربی، اعداد فارسی، ZWNJ */
export function norm(s) {
  return String(s ?? '')
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[‌‏‎]/g, ' ')
    .replace(/[ً-ٟ]/g, '')
    .toLowerCase().trim();
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ── توست ────────────────────────────────────────────────────────────────────
export function toast(text, { action, onAction, ms = 3500, kind } = {}) {
  const box = $('#toasts');
  const el = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), role: 'status' },
    h('span', {}, text),
    action && h('button', { class: 'toast-act', onclick: () => { onAction && onAction(); el.remove(); } }, action));
  box.append(el);
  if (ms) setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, ms);
  return el;
}

// ── دیالوگ ──────────────────────────────────────────────────────────────────
let dlgResolve = null;
let pendingClose = null;
function dlg() {
  const d = $('#dlg');
  if (!d.dataset.ready) {
    d.dataset.ready = '1';
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => {
      const r = dlgResolve; dlgResolve = null;
      d.classList.remove('sheet');
      r && r(d.returnValue || '');
    });
  }
  return d;
}
/** بستن برنامه‌نویسی‌شده‌ی دیالوگ؛ promise دیالوگ همان لحظه با value حل می‌شود. */
export function closeDialog(value = '') {
  const d = $('#dlg');
  if (!d || !d.open) return;
  const r = dlgResolve; dlgResolve = null;
  pendingClose = new Promise((res) => d.addEventListener('close', () => { pendingClose = null; res(); }, { once: true }));
  d.returnValue = value;
  d.close(value);
  r && r(value);
}
/** نمایش دیالوگ با محتوای دلخواه؛ با بسته‌شدن، returnValue را برمی‌گرداند. */
export async function openDialog(content, { sheet = false } = {}) {
  const d = dlg();
  if (pendingClose) await pendingClose;
  if (d.open) { closeDialog('replaced'); await pendingClose; }
  d.returnValue = '';
  d.classList.toggle('sheet', sheet);
  mount(d, content);
  return new Promise((res) => { dlgResolve = res; d.showModal(); });
}

export async function confirmBox({ title, text, ok = 'تأیید', cancel = 'انصراف', danger = false }) {
  const r = await openDialog(h('form', { method: 'dialog', class: 'dlg-body' },
    h('h2', {}, title),
    text && h('p', { class: 'muted' }, text),
    h('div', { class: 'dlg-actions' },
      h('button', { class: 'btn ghost', value: 'no' }, cancel),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), value: 'yes', autofocus: true }, ok))));
  return r === 'yes';
}
