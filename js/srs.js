// srs.js — منطق خالص مرور فاصله‌دار (بدون DOM و بدون ذخیره‌سازی).
// الگوریتم شبیه Anki (SM-2 اصلاح‌شده): مراحل یادگیری، ضریب سهولت، تکرار مجدد پس از فراموشی.

export const NEW = 0, LEARN = 1, REVIEW = 2, RELEARN = 3;
export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;
const MIN = 60000, DAY = 86400000;

export const DEFAULTS = Object.freeze({
  learnSteps: [1, 10],   // دقیقه
  relearnSteps: [10],    // دقیقه
  gradIvl: 1,            // فاصله‌ی اولیه پس از فارغ‌التحصیلی (روز)
  easyIvl: 4,            // فاصله‌ی اولیه با «آسان» (روز)
  startEase: 2.5,
  easyBonus: 1.3,
  hardIvl: 1.2,
  ivlMod: 1,
  maxIvl: 365,
  lapseMult: 0,          // ضریب فاصله‌ی جدید پس از فراموشی
  minLapseIvl: 1,
  leechAt: 8,
  newPerDay: 10,
  revPerDay: 100,
  learnAhead: 20,        // دقیقه
  rollover: 4,           // ساعت شروع «روز مطالعه»
});

/** شماره‌ی «روز مطالعه» بر اساس ساعت محلی و ساعت شروع روز. */
export function studyDay(now, rollover = 4) {
  const off = -new Date(now).getTimezoneOffset() * MIN;
  return Math.floor((now + off - rollover * 3600000) / DAY);
}

export function newProg() {
  return { st: NEW, step: 0, due: 0, ivl: 0, ease: 0, reps: 0, lapses: 0, last: 0 };
}

const cfgOf = (cfg) => ({ ...DEFAULTS, ...(cfg || {}) });

/** پاسخ به کارت؛ وضعیت جدید را برمی‌گرداند (ورودی تغییر نمی‌کند). */
export function answer(p0, rating, now, cfg) {
  const c = cfgOf(cfg);
  const today = studyDay(now, c.rollover);
  const p = { ...(p0 || newProg()) };
  p.reps = (p.reps || 0) + 1;
  p.last = now;
  if (p.st === NEW) { p.st = LEARN; p.step = 0; p.ease = c.startEase; }
  if (p.st === LEARN || p.st === RELEARN) learning(p, rating, now, today, c);
  else review(p, rating, now, today, c);
  return p;
}

function learning(p, r, now, today, c) {
  const relearn = p.st === RELEARN;
  const steps = relearn ? c.relearnSteps : c.learnSteps;
  const grad = (ivl) => { p.st = REVIEW; p.step = 0; p.ivl = ivl; p.due = today + ivl; };
  const gradGood = () => grad(relearn ? Math.max(1, p.ivl) : c.gradIvl);
  const gradEasy = () => grad(relearn ? Math.max(1, p.ivl) + 1 : c.easyIvl);

  if (r === AGAIN) { p.step = 0; p.due = now + (steps[0] ?? 1) * MIN; return; }
  if (r === EASY) { gradEasy(); return; }
  if (!steps.length) { gradGood(); return; }
  if (r === HARD) {
    const cur = steps[p.step] ?? steps[0];
    const d = p.step === 0 ? (steps.length > 1 ? (steps[0] + steps[1]) / 2 : cur * 1.5) : cur;
    p.due = now + d * MIN;
    return;
  }
  // GOOD
  if (p.step + 1 >= steps.length) gradGood();
  else { p.step += 1; p.due = now + steps[p.step] * MIN; }
}

function review(p, r, now, today, c) {
  const ivl = Math.max(1, p.ivl || 1);
  const ease = p.ease || c.startEase;
  const overdue = Math.max(0, today - p.due);

  if (r === AGAIN) {
    p.lapses = (p.lapses || 0) + 1;
    p.ease = Math.max(1.3, ease - 0.2);
    p.ivl = Math.max(c.minLapseIvl, Math.round(ivl * c.lapseMult));
    if (p.lapses >= c.leechAt) p.leech = true;
    if (c.relearnSteps.length) { p.st = RELEARN; p.step = 0; p.due = now + c.relearnSteps[0] * MIN; }
    else p.due = today + p.ivl;
    return;
  }
  const cap = (x) => Math.min(c.maxIvl, Math.max(1, x));
  const hard = cap(Math.max(ivl + 1, Math.round(ivl * c.hardIvl * c.ivlMod)));
  const good = cap(Math.max(hard + 1, Math.round((ivl + overdue / 2) * ease * c.ivlMod)));
  const easy = cap(Math.max(good + 1, Math.round((ivl + overdue) * ease * c.easyBonus * c.ivlMod)));

  if (r === HARD) { p.ease = Math.max(1.3, ease - 0.15); p.ivl = hard; }
  else if (r === GOOD) { p.ivl = good; }
  else { p.ease = ease + 0.15; p.ivl = easy; }
  p.due = today + p.ivl;
}

/** فاصله‌ی بعدی برای هر چهار دکمه، به میلی‌ثانیه. */
export function preview(p, now, cfg) {
  const c = cfgOf(cfg);
  const today = studyDay(now, c.rollover);
  return [AGAIN, HARD, GOOD, EASY].map((rating) => {
    const q = answer(p, rating, now, c);
    const ms = (q.st === LEARN || q.st === RELEARN) ? Math.max(0, q.due - now) : (q.due - today) * DAY;
    return { rating, ms };
  });
}

/** ساخت صف امروز. done = {new, rev} شمار انجام‌شده‌ی امروز. */
export function buildSession(cards, prog, now, cfg, done = {}, extraNew = 0) {
  const c = cfgOf(cfg);
  const today = studyDay(now, c.rollover);
  const learn = [], soon = [], reviews = [], fresh = [];
  for (const card of cards) {
    const p = prog[card.id] || newProg();
    if (p.susp || (p.bury != null && p.bury >= today)) continue;
    if (p.st === LEARN || p.st === RELEARN) {
      if (p.due <= now) learn.push({ card, p });
      else if (p.due <= now + c.learnAhead * MIN) soon.push({ card, p });
    } else if (p.st === REVIEW) {
      if (p.due <= today) reviews.push({ card, p });
    } else fresh.push({ card, p });
  }
  learn.sort((a, b) => a.p.due - b.p.due);
  soon.sort((a, b) => a.p.due - b.p.due);
  reviews.sort((a, b) => a.p.due - b.p.due);
  const revLeft = Math.max(0, c.revPerDay - (done.rev || 0));
  const newLeft = Math.max(0, c.newPerDay + extraNew - (done.new || 0));
  const rev = reviews.slice(0, revLeft);
  const nw = fresh.slice(0, newLeft);
  return {
    learn, soon, review: rev, new: nw,
    counts: { new: nw.length, learn: learn.length + soon.length, review: rev.length },
    total: learn.length + soon.length + rev.length + nw.length,
  };
}

export function pickNext(sess) {
  if (sess.learn.length) return { ...sess.learn[0], kind: 'learn' };
  if (sess.review.length) return { ...sess.review[0], kind: 'review' };
  if (sess.new.length) return { ...sess.new[0], kind: 'new' };
  if (sess.soon.length) return { ...sess.soon[0], kind: 'learn' };
  return null;
}

/** زمان نزدیک‌ترین مرور بعدی (برای صفحه‌ی «تمام شد»). */
export function nextDue(cards, prog, now, cfg) {
  const c = cfgOf(cfg);
  const today = studyDay(now, c.rollover);
  let learnMs = null, reviewDay = null;
  for (const card of cards) {
    const p = prog[card.id];
    if (!p || p.susp) continue;
    if (p.st === LEARN || p.st === RELEARN) {
      if (p.due > now && (learnMs === null || p.due < learnMs)) learnMs = p.due;
    } else if (p.st === REVIEW && p.due > today && (reviewDay === null || p.due < reviewDay)) reviewDay = p.due;
  }
  return { learnMs, reviewDay, today };
}

/** پیش‌بینی تعداد مرورهای n روز آینده (روز ۰ = امروز + عقب‌افتاده‌ها). */
export function forecast(cards, prog, now, cfg, n = 14) {
  const c = cfgOf(cfg);
  const today = studyDay(now, c.rollover);
  const out = new Array(n).fill(0);
  for (const card of cards) {
    const p = prog[card.id];
    if (!p || p.susp) continue;
    if (p.st === REVIEW) {
      const i = Math.max(0, p.due - today);
      if (i < n) out[i]++;
    } else if (p.st === LEARN || p.st === RELEARN) out[0]++;
  }
  return out;
}
