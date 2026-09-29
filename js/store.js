// store.js — وضعیت برنامه و ذخیره‌سازی در localStorage (نسخه‌دار، با مهاجرت از نسخه‌ی قدیمی).
import { DEFAULTS as SRS, NEW, LEARN, REVIEW, AGAIN, newProg, answer, studyDay, buildSession } from './srs.js';
import { DEFAULT_DECK } from './data.js';
import { PACKS } from './packs.js';
import { uid } from './util.js';

export const KEY = 'ssrs.v2';
const OLD_DATA = 'social_srs_v1_data';
const OLD_STATE = 'social_srs_v1_state';
const REVLOG_MAX = 5000;

export const DEFAULT_SETTINGS = {
  ...SRS,
  theme: 'auto',          // auto | dark | light
  accent: 'blue',         // blue | green | violet | rose | amber
  fontScale: 1,
  persianDigits: true,
  haptics: true,
  exampleOnFront: false,  // نمایش مثال روی روی کارت (پیش‌فرض: پشت کارت)
  showTimer: false,
  motion: 'auto',         // auto | reduce
};

let S = null;
let lastError = null;
const listeners = new Set();

export const state = () => S;
export const settings = () => S.settings;
export const cards = () => S.cards;
export const getError = () => lastError;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => f(S));

// ── بارگذاری / ذخیره ───────────────────────────────────────────────────────
function fresh() {
  return {
    v: 2,
    deckName: DEFAULT_DECK.name,
    cards: DEFAULT_DECK.cards.map((c) => ({ ...c, created: 0, updated: 0 })),
    prog: {},
    log: { days: {}, rev: [] },
    practice: {},
    extra: { day: 0, new: 0 },
    packs: ['core'],
    settings: { ...DEFAULT_SETTINGS },
    meta: { created: Date.now(), migrated: false },
  };
}

export function normalize(raw) {
  const base = fresh();
  const s = { ...base, ...(raw || {}) };
  s.v = 2;
  s.cards = Array.isArray(s.cards) ? s.cards.filter((c) => c && c.id && c.front != null).map(cleanCard) : base.cards;
  s.prog = s.prog && typeof s.prog === 'object' ? s.prog : {};
  s.log = { days: {}, rev: [], ...(s.log || {}) };
  s.practice = s.practice || {};
  s.extra = { day: 0, new: 0, ...(s.extra || {}) };
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  s.meta = { ...base.meta, ...(s.meta || {}) };
  // دک‌های نصب‌شده: اگر ثبت نشده باشد، از شناسه‌ی کارت‌ها حدس بزن (سازگار با داده‌های قدیمی)
  s.packs = Array.isArray(raw && raw.packs) ? raw.packs.filter((id) => PACKS.some((p) => p.id === id)) : PACKS.filter((p) => s.cards.some((c) => c.id.startsWith(p.prefix))).map((p) => p.id);
  return s;
}

export function cleanCard(c) {
  return {
    id: String(c.id),
    front: String(c.front ?? '').trim(),
    example: String(c.example ?? '').trim(),
    rule: String(c.rule ?? '').trim(),
    back: String(c.back ?? '').trim(),
    tags: [...new Set((Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(/[,،\s]+/)).map((t) => String(t).trim()).filter(Boolean))],
    created: c.created || 0,
    updated: c.updated || 0,
  };
}

function migrateV1() {
  try {
    const od = JSON.parse(localStorage.getItem(OLD_DATA) || 'null');
    const os = JSON.parse(localStorage.getItem(OLD_STATE) || 'null');
    if (!od && !os) return null;
    const s = fresh();
    if (od && Array.isArray(od.cards) && od.cards.length) s.cards = od.cards.map((c, i) => cleanCard({ ...c, id: c.id || 'legacy-' + i }));
    const days = {};
    for (const [id, o] of Object.entries(os || {})) {
      if (!o || !o.reps) continue;
      const p = newProg();
      p.reps = o.reps; p.lapses = o.lapses || 0; p.ease = SRS.startEase; p.last = Date.now();
      if ((o.interval || 0) >= 1) { p.st = REVIEW; p.ivl = o.interval; p.due = studyDay(o.due || Date.now(), SRS.rollover); }
      else { p.st = LEARN; p.step = 0; p.due = o.due || Date.now(); }
      s.prog[id] = p;
      if (o.last) days[o.last] = { ...(days[o.last] || { n: 0, new: 0, rev: 0, learn: 0, again: 0, ms: 0 }), n: (days[o.last]?.n || 0) + 1, legacy: true };
    }
    s.log.days = days;
    s.meta.migrated = true;
    return s;
  } catch { return null; }
}

export function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  S = raw ? normalize(raw) : normalize(migrateV1());
  if (!raw) save();
  return S;
}

let timer = null;
export function save() {
  clearTimeout(timer); timer = null;
  try { localStorage.setItem(KEY, JSON.stringify(S)); lastError = null; }
  catch (e) { lastError = e; }
}
export function saveSoon() { clearTimeout(timer); timer = setTimeout(save, 250); }
export function flush() { if (timer) save(); }
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

// ── دسترسی‌ها ───────────────────────────────────────────────────────────────
export const now = () => Date.now();
export const today = () => studyDay(Date.now(), S.settings.rollover);
export const prog = (id) => S.prog[id] || newProg();
export const card = (id) => S.cards.find((c) => c.id === id);
export const daily = (d = today()) => S.log.days[d] || { n: 0, new: 0, rev: 0, learn: 0, again: 0, ms: 0 };

/** ahead: دقیقه‌ی «یادگیری پیش‌رو» (اختیاری؛ برای «مرور زودتر»). */
export function session(ahead) {
  const d = daily();
  const extra = S.extra.day === today() ? S.extra.new : 0;
  const cfg = ahead == null ? S.settings : { ...S.settings, learnAhead: ahead };
  return buildSession(S.cards, S.prog, Date.now(), cfg, { new: d.new, rev: d.rev }, extra);
}
export function addExtraNew(k = 5) {
  const t = today();
  if (S.extra.day !== t) S.extra = { day: t, new: 0 };
  S.extra.new += k;
  saveSoon(); emit();
}

// ── ثبت پاسخ و بازگردانی ───────────────────────────────────────────────────
export function grade(id, rating, ms = 0) {
  const t = today();
  const p0 = S.prog[id];
  const before = p0 ? { ...p0 } : null;
  const p = p0 || newProg();
  const dayBefore = S.log.days[t] ? { ...S.log.days[t] } : null;

  const next = answer(p, rating, Date.now(), S.settings);
  S.prog[id] = { ...next, susp: p.susp, bury: p.bury, flag: p.flag };
  const d = { ...daily(t) };
  d.n++; d.ms += ms;
  if (p.st === NEW) d.new++; else if (p.st === REVIEW) d.rev++; else d.learn++;
  if (rating === AGAIN) d.again++;
  S.log.days[t] = d;
  S.log.rev.push([Date.now(), id, rating, p.st, Math.round(ms)]);
  if (S.log.rev.length > REVLOG_MAX) S.log.rev.splice(0, S.log.rev.length - REVLOG_MAX);
  saveSoon(); emit();
  return { id, before, t, dayBefore, becameLeech: !p.leech && !!next.leech };
}

export function undo(tok) {
  if (!tok) return;
  if (tok.before) S.prog[tok.id] = tok.before; else delete S.prog[tok.id];
  if (tok.dayBefore) S.log.days[tok.t] = tok.dayBefore; else delete S.log.days[tok.t];
  const i = S.log.rev.map((r) => r[1]).lastIndexOf(tok.id);
  if (i >= 0) S.log.rev.splice(i, 1);
  saveSoon(); emit();
}

// ── کارت‌ها ─────────────────────────────────────────────────────────────────
export function upsertCard(data) {
  const c = cleanCard({ ...data, id: data.id || uid() });
  const i = S.cards.findIndex((x) => x.id === c.id);
  const t = Date.now();
  if (i >= 0) S.cards[i] = { ...c, created: S.cards[i].created, updated: t };
  else S.cards.push({ ...c, created: t, updated: t });
  saveSoon(); emit();
  return c.id;
}
// ── دک‌ها ───────────────────────────────────────────────────────────────────
export const installedPacks = () => S.packs;
export function installPack(id) {
  const pack = PACKS.find((p) => p.id === id);
  if (!pack || S.packs.includes(id)) return 0;
  const have = new Set(S.cards.map((c) => c.id));
  const t = Date.now();
  let added = 0;
  for (const c of pack.cards) {
    if (have.has(c.id)) continue;
    S.cards.push({ ...cleanCard(c), created: t, updated: t });
    added++;
  }
  S.packs = [...S.packs, id];
  saveSoon(); emit();
  return added;
}
export function deleteCard(id) {
  const i = S.cards.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const snap = { card: S.cards[i], prog: S.prog[id], index: i };
  S.cards.splice(i, 1); delete S.prog[id];
  saveSoon(); emit();
  return snap;
}
export function restoreCard(snap) {
  if (!snap) return;
  S.cards.splice(Math.min(snap.index, S.cards.length), 0, snap.card);
  if (snap.prog) S.prog[snap.card.id] = snap.prog;
  saveSoon(); emit();
}
export function patchProg(id, patch) {
  const p = { ...prog(id), ...patch };
  for (const k of Object.keys(patch)) if (patch[k] === undefined || patch[k] === false) delete p[k];
  S.prog[id] = p;
  saveSoon(); emit();
}
export function resetCard(id) { delete S.prog[id]; saveSoon(); emit(); }
export function resetAllProgress() {
  S.prog = {}; S.log = { days: {}, rev: [] }; S.practice = {}; S.extra = { day: 0, new: 0 };
  save(); emit();
}
export function eraseEverything() {
  S = normalize(null); save(); emit();
}

// ── تنظیمات ─────────────────────────────────────────────────────────────────
export function setSetting(k, v) { S.settings[k] = v; saveSoon(); emit(); }
export function setSettings(obj) { Object.assign(S.settings, obj); saveSoon(); emit(); }

// ── آمار ────────────────────────────────────────────────────────────────────
/** روزهای متوالی مطالعه؛ اگر امروز هنوز مرور نکرده‌ای، رشته‌ی تا دیروز نمی‌شکند. */
export function streak() {
  const t = today();
  let d = daily(t).n > 0 ? t : t - 1;
  let n = 0;
  while ((S.log.days[d]?.n || 0) > 0) { n++; d--; }
  return n;
}
export function bestStreak() {
  const ds = Object.keys(S.log.days).map(Number).filter((d) => S.log.days[d].n > 0).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const d of ds) { run = prev !== null && d === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}
export function counts() {
  const c = { total: S.cards.length, new: 0, learning: 0, young: 0, mature: 0, susp: 0, leech: 0, flag: 0 };
  for (const cd of S.cards) {
    const p = S.prog[cd.id];
    if (p?.flag) c.flag++;
    if (p?.leech) c.leech++;
    if (p?.susp) { c.susp++; continue; }
    if (!p || p.st === NEW) c.new++;
    else if (p.st === LEARN || p.st === 3) c.learning++;
    else if ((p.ivl || 0) >= 21) c.mature++;
    else c.young++;
  }
  return c;
}
/** درصد پاسخ‌های درست (غیر «دوباره») به کارت‌های مرور در n روز اخیر. */
export function retention(days = 30) {
  const since = Date.now() - days * 86400000;
  let ok = 0, all = 0;
  for (const [t, , r, st] of S.log.rev) {
    if (t < since || st !== REVIEW) continue;
    all++; if (r > AGAIN) ok++;
  }
  return all ? { rate: ok / all, n: all } : null;
}
export function totals() {
  let n = 0, ms = 0;
  for (const d of Object.values(S.log.days)) { n += d.n || 0; ms += d.ms || 0; }
  return { n, ms, days: Object.values(S.log.days).filter((d) => d.n > 0).length };
}

// ── تمرین روزانه (چالش دنیای واقعی) ─────────────────────────────────────────
function hash(n) { let x = (n ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
export function practiceToday() {
  const t = today();
  let e = S.practice[t];
  const valid = (id) => id && S.cards.some((c) => c.id === id);
  if (!e || !valid(e.id)) {
    if (!S.cards.length) return null;
    // ترجیح با کارت‌هایی که تازه‌تر مرور شده‌اند تا محتوای آشنا تمرین شود؛ در غیر این صورت هر کارتی
    const seen = S.cards.filter((c) => S.prog[c.id]?.reps && !S.prog[c.id]?.susp);
    const pool = seen.length ? seen : S.cards;
    e = { id: pool[hash(t) % pool.length].id, done: false, note: '' };
    S.practice[t] = e; saveSoon();
  }
  return { ...e, card: card(e.id) };
}
export function rerollPractice() {
  const t = today();
  const cur = S.practice[t]?.id;
  const pool = S.cards.filter((c) => c.id !== cur);
  if (!pool.length) return;
  S.practice[t] = { id: pool[Math.floor(Math.random() * pool.length)].id, done: false, note: '' };
  saveSoon(); emit();
}
export function setPractice(patch) {
  const t = today();
  practiceToday();
  S.practice[t] = { ...S.practice[t], ...patch };
  saveSoon(); emit();
}
export function practiceStreak() {
  const t = today();
  let d = S.practice[t]?.done ? t : t - 1;
  let n = 0;
  while (S.practice[d]?.done) { n++; d--; }
  return n;
}
export function practiceTotal() { return Object.values(S.practice).filter((p) => p.done).length; }

/** جایگزینی کل وضعیت (برای بازیابی پشتیبان). */
export function replaceState(next) { S = normalize(next); save(); emit(); }
