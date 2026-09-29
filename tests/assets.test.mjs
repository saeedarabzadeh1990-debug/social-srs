import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');

test('همه‌ی فایل‌های پیش‌کش سرویس‌ورکر وجود دارند (یک فایل گمشده کل نصب آفلاین را می‌شکند)', () => {
  const list = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]).filter((p) => p !== './');
  assert.ok(list.length > 10);
  for (const p of list) assert.ok(existsSync(join(root, p)), `فایل گمشده: ${p}`);
});

test('هر ماژول JS در پوشه‌ی js در فهرست پیش‌کش هست', async () => {
  const { readdirSync } = await import('node:fs');
  const files = [...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => './js/' + f),
    ...readdirSync(join(root, 'js/views')).filter((f) => f.endsWith('.js')).map((f) => './js/views/' + f)];
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `در ASSETS نیست: ${f}`);
});

test('VERSION در sw.js و settings.js با یک الگو قابل جایگزینی است (workflow به آن وابسته است)', () => {
  const re = /const VERSION = '[^']*';/;
  assert.match(sw, re);
  assert.match(readFileSync(join(root, 'js/views/settings.js'), 'utf8'), re);
});

test('مانیفست معتبر است و همه‌ی آیکن‌هایش وجود دارند', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.ok(m.start_url && m.scope && m.name);
  for (const i of [...m.icons, ...(m.screenshots || [])]) assert.ok(existsSync(join(root, i.src)), `گمشده: ${i.src}`);
});
