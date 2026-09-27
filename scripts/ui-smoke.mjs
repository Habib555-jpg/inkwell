// Headless UI smoke test for the running dev server (npm run dev).
// Usage: node scripts/ui-smoke.mjs <stage> [screenshotDir]
// Stages build on each other; each asserts what a user would see.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const stage = process.argv[2] ?? 'shell';
const shots = process.argv[3] ?? './.data/screenshots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (name) => page.screenshot({ path: `${shots}/${stage}-${name}.png`, fullPage: true });
const expectText = async (text) => { await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 }); };
const email = `smoke-${Date.now()}@test.io`;

try {
  // register
  await page.goto(`${BASE}/register`);
  await page.getByLabel('Name').fill('Smoke Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/novels$/);
  await shot('01-novels-empty');

  // create novel with 2 characters
  await page.getByRole('button', { name: 'New novel' }).first().click();
  await page.getByLabel('Title').fill('The Ashen Crown');
  await page.getByLabel('Genre').fill('Dark fantasy');
  await page.getByLabel('Premise').fill('A thief inherits a cursed crown.');
  await page.getByLabel('Character 1 name').fill('Mira Vale');
  await page.getByLabel('Character 1 personality').fill('wry, guarded thief');
  await page.getByRole('button', { name: 'Add character' }).click();
  await page.getByLabel('Character 2 name').fill('Bram Holt');
  await page.getByLabel('Character 2 personality').fill('formal former knight');
  await shot('02-new-novel-dialog');
  await page.getByRole('button', { name: 'Create novel' }).click();
  await page.waitForURL(/\/novels\/[0-9a-f-]{36}$/);
  const novelUrl = page.url();
  await expectText('Novel workspace');
  await shot('03-novel-workspace');

  // world: location + rule
  await page.goto(`${novelUrl}/world`);
  await page.getByLabel('Name').fill("Gull's Rest");
  await page.getByLabel('Description').fill('A fishing village with an old lighthouse.');
  await page.getByRole('button', { name: 'Create location' }).click();
  await expectText('Saved');
  await page.getByRole('tab', { name: /Rules/ }).click();
  await page.getByRole('tabpanel').getByLabel('Name').fill('Ash Oath');
  await page.getByRole('tabpanel').getByLabel('Category').selectOption('magic');
  await page.getByRole('tabpanel').getByLabel('Description').fill('An oath sworn over ash binds the swearer until death.');
  await page.getByRole('button', { name: 'Create rule' }).click();
  await expectText('Saved');
  await shot('04-world');

  // relationship
  await page.goto(`${novelUrl}/characters`);
  await expectText('Mira Vale');
  await page.getByLabel('Relationship', { exact: true }).fill('distrusts');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expectText('distrusts');
  await shot('05-characters');

  // chapter 1
  await page.goto(`${novelUrl}/chapters`);
  await page.getByRole('button', { name: 'New chapter' }).first().click();
  await page.getByLabel('Title').fill('The Salt Road');
  await page.getByLabel('Main idea').fill('Mira robs the customs house while Bram watches.');
  await page.getByLabel('Events that must happen').fill('Mira steals the ledger\nBram sees her and says nothing');
  await page.getByLabel('Events that must NOT happen').fill('Mira is caught');
  await page.getByRole('button', { name: 'Mira Vale' }).click();
  await page.getByRole('button', { name: 'Create chapter' }).click();
  await page.waitForURL(/\/chapters\/[0-9a-f-]{36}$/);

  // persistence after reload
  await page.goto(`${novelUrl}/chapters`);
  await page.reload();
  await expectText('The Salt Road');
  await page.goto(`${novelUrl}/world`);
  await expectText("Gull's Rest");
  await shot('06-after-reload');
  console.log(JSON.stringify({ ok: true, novelUrl, errors }, null, 2));
} catch (e) {
  await shot('zz-failure').catch(() => {});
  console.log(JSON.stringify({ ok: false, error: String(e), url: page.url(), errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
