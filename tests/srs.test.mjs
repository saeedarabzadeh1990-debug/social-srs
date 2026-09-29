import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEW, LEARN, REVIEW, RELEARN, AGAIN, HARD, GOOD, EASY,
  DEFAULTS, newProg, answer, preview, studyDay, buildSession, pickNext, nextDue, forecast,
} from '../js/srs.js';

const T0 = new Date(2026, 8, 29, 12, 0, 0).getTime();
const DAY = 86400000, MIN = 60000;
const today = studyDay(T0, DEFAULTS.rollover);

test('کارت جدید: خوب ← مرحله‌ی دوم ← فارغ‌التحصیلی با ۱ روز', () => {
  let p = answer(newProg(), GOOD, T0);
  assert.equal(p.st, LEARN);
  assert.equal(p.step, 1);
  assert.equal(p.due, T0 + 10 * MIN);
  p = answer(p, GOOD, T0 + 10 * MIN);
  assert.equal(p.st, REVIEW);
  assert.equal(p.ivl, 1);
  assert.equal(p.due, today + 1);
  assert.equal(p.ease, DEFAULTS.startEase);
});

test('کارت جدید: آسان مستقیم ۴ روز', () => {
  const p = answer(newProg(), EASY, T0);
  assert.equal(p.st, REVIEW);
  assert.equal(p.ivl, 4);
});

test('کارت جدید: دوباره در مرحله‌ی اول می‌ماند و سخت میانگین دو مرحله است', () => {
  assert.equal(answer(newProg(), AGAIN, T0).due, T0 + MIN);
  assert.equal(answer(newProg(), HARD, T0).due, T0 + 5.5 * MIN);
});

test('مرور: فاصله‌ها با ضریب سهولت رشد می‌کنند و ترتیب سخت < خوب < آسان برقرار است', () => {
  const p = { st: REVIEW, step: 0, due: today, ivl: 10, ease: 2.5, reps: 5, lapses: 0, last: 0 };
  const [, h, g, e] = preview(p, T0).map((x) => x.ms / DAY);
  assert.equal(h, 12);
  assert.equal(g, 25);
  assert.ok(e > g);
  assert.equal(answer(p, HARD, T0).ease, 2.35);
  assert.equal(answer(p, EASY, T0).ease, 2.65);
});

test('مرور با تأخیر: پاداش تأخیر در فاصله‌ی خوب اعمال می‌شود', () => {
  const p = { st: REVIEW, step: 0, due: today - 4, ivl: 10, ease: 2.5, reps: 5, lapses: 0, last: 0 };
  assert.equal(answer(p, GOOD, T0).ivl, Math.round((10 + 2) * 2.5));
});

test('فراموشی: ضریب کم می‌شود، وارد یادگیری مجدد می‌شود و با «خوب» با ۱ روز برمی‌گردد', () => {
  const p = { st: REVIEW, step: 0, due: today, ivl: 30, ease: 2.5, reps: 5, lapses: 0, last: 0 };
  let q = answer(p, AGAIN, T0);
  assert.equal(q.st, RELEARN);
  assert.equal(q.lapses, 1);
  assert.ok(Math.abs(q.ease - 2.3) < 1e-9);
  assert.equal(q.due, T0 + 10 * MIN);
  q = answer(q, GOOD, T0 + 10 * MIN);
  assert.equal(q.st, REVIEW);
  assert.equal(q.ivl, 1);
});

test('کارت مشکل‌دار (leech) پس از تعداد مشخصی فراموشی علامت می‌خورد', () => {
  let p = { st: REVIEW, step: 0, due: today, ivl: 5, ease: 2.5, reps: 5, lapses: 7, last: 0 };
  p = answer(p, AGAIN, T0);
  assert.equal(p.leech, true);
});

test('سقف فاصله رعایت می‌شود', () => {
  const p = { st: REVIEW, step: 0, due: today, ivl: 300, ease: 2.5, reps: 5, lapses: 0, last: 0 };
  assert.equal(answer(p, EASY, T0).ivl, DEFAULTS.maxIvl);
});

test('answer ورودی را تغییر نمی‌دهد', () => {
  const p = newProg();
  const snap = JSON.stringify(p);
  answer(p, GOOD, T0);
  assert.equal(JSON.stringify(p), snap);
});

test('ساعت شروع روز: ۰۳:۵۹ و ۰۴:۰۱ در دو روز مطالعه‌ی متوالی‌اند', () => {
  const a = new Date(2026, 8, 29, 3, 59).getTime();
  const b = new Date(2026, 8, 29, 4, 1).getTime();
  assert.equal(studyDay(b, 4) - studyDay(a, 4), 1);
  assert.equal(studyDay(b, 0) - studyDay(a, 0), 0);
});

const deck = (n) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i }));

test('محدودیت روزانه‌ی کارت جدید و شمارش انجام‌شده‌ها', () => {
  const cards = deck(25);
  assert.equal(buildSession(cards, {}, T0, { newPerDay: 10 }).counts.new, 10);
  assert.equal(buildSession(cards, {}, T0, { newPerDay: 10 }, { new: 4 }).counts.new, 6);
  assert.equal(buildSession(cards, {}, T0, { newPerDay: 10 }, { new: 4 }, 5).counts.new, 11);
  assert.equal(buildSession(cards, {}, T0, { newPerDay: 10 }, { new: 10 }).counts.new, 0);
});

test('صف: یادگیری ← مرور ← جدید؛ معلق و مخفی‌شده حذف می‌شوند', () => {
  const cards = deck(6);
  const prog = {
    c0: { ...newProg(), st: LEARN, due: T0 - MIN },
    c1: { ...newProg(), st: REVIEW, due: today, ivl: 3, ease: 2.5 },
    c2: { ...newProg(), st: REVIEW, due: today + 2, ivl: 3, ease: 2.5 },
    c3: { ...newProg(), st: REVIEW, due: today, ivl: 3, ease: 2.5, susp: true },
    c4: { ...newProg(), st: REVIEW, due: today, ivl: 3, ease: 2.5, bury: today },
  };
  const s = buildSession(cards, prog, T0, {});
  assert.equal(pickNext(s).card.id, 'c0');
  assert.equal(pickNext(s).kind, 'learn');
  assert.deepEqual(s.review.map((x) => x.card.id), ['c1']);
  assert.deepEqual(s.new.map((x) => x.card.id), ['c5']);
  const s2 = buildSession(cards, prog, T0 + 5 * MIN, {});
  assert.equal(s2.learn.length, 1);
});

test('یادگیری‌ای که هنوز زمانش نرسیده در «یادگیری پیش‌رو» می‌آید، نه دورتر', () => {
  const cards = deck(2);
  const prog = {
    c0: { ...newProg(), st: LEARN, due: T0 + 5 * MIN },
    c1: { ...newProg(), st: LEARN, due: T0 + 60 * MIN },
  };
  const s = buildSession(cards, prog, T0, { newPerDay: 0 });
  assert.equal(s.soon.length, 1);
  assert.equal(pickNext(s).card.id, 'c0');
  assert.equal(nextDue(cards, prog, T0).learnMs, T0 + 5 * MIN);
});

test('پیش‌بینی: عقب‌افتاده‌ها در روز صفر جمع می‌شوند', () => {
  const cards = deck(4);
  const prog = {
    c0: { ...newProg(), st: REVIEW, due: today - 3, ivl: 3 },
    c1: { ...newProg(), st: REVIEW, due: today, ivl: 3 },
    c2: { ...newProg(), st: REVIEW, due: today + 2, ivl: 3 },
    c3: { ...newProg(), st: REVIEW, due: today + 99, ivl: 3 },
  };
  const f = forecast(cards, prog, T0, {}, 14);
  assert.equal(f[0], 2);
  assert.equal(f[2], 1);
  assert.equal(f.reduce((a, b) => a + b, 0), 3);
});

test('NEW در ثابت‌ها تعریف شده است', () => assert.equal(NEW, 0));
