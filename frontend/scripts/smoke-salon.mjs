import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ bypassCSP: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message));

const BASE = process.env.BASE_URL || 'http://localhost:4200';
page.on('console', (m) => {
  if (m.type() === 'error') console.log('BROWSER_ERR', m.text());
});
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(`${BASE}/login`);
await page.fill('#email', 'profesor@nuclear.local');
await page.fill('#password', 'Profesor123*');
await page.click('button[type=submit]');
await page.waitForURL(/\/grupos/, { timeout: 15000 });
await page.waitForSelector('.salon-card, .empty-hero, app-alert-message', {
  timeout: 20000,
});
await page.waitForSelector('a:has-text("Abrir"), a:has-text("Crear grupo")', {
  timeout: 5000,
}).catch(() => null);

console.log('body snippet', (await page.locator('body').innerText()).slice(0, 800));
const links = await page.locator('a:has-text("Abrir")').count();
console.log('entrar links', links);
const cards = await page.locator('.salon-card').count();
console.log('salon cards', cards);

if (links > 0) {
  const [reqFailed, reqOk] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/estudiantes') && r.request().method() === 'GET',
      { timeout: 25000 },
    ),
    page.locator('a:has-text("Abrir")').first().click(),
  ]);
  console.log('estudiantes GET status', reqFailed.status());
  const body = await reqFailed.text().catch(() => '');
  console.log('estudiantes body len', body.length, body.slice(0, 120));
  await page.waitForTimeout(3000);
  const sceneHtml = await page.locator('app-classroom-scene').innerHTML();
  console.log('loading visible', sceneHtml.includes('Preparando el salón'));
  console.log('desks-grid visible', sceneHtml.includes('desks-grid'));
  console.log('desks-grid html len', (await page.locator('.desks-grid').innerHTML().catch(() => '')).length);
  console.log('url', page.url());
  console.log('h1', (await page.locator('h1').first().textContent())?.trim());
  console.log('alerts', (await page.locator('app-alert-message').allTextContents()).join(' | '));
  console.log('desk components', await page.locator('app-classroom-desk').count());
  console.log('desks total', await page.locator('.desk').count());
  console.log('interactive desks', await page.locator('.desk--interactive').count());
  console.log('empty desks', await page.locator('.desk--empty').count());
  console.log('occupied desks', await page.locator('.desk--occupied').count());
  const empty = page.locator('.desk--empty').first();
  if ((await empty.count()) > 0) {
    await empty.click();
    await page.waitForTimeout(1000);
    console.log('assign buttons', await page.locator('.assign-list__item').count());
    const btn = page.locator('.assign-list__item').first();
    if ((await btn.count()) > 0) {
      await btn.click();
      await page.waitForTimeout(2500);
      console.log('occupied desks', await page.locator('.desk--occupied').count());
      console.log('success alert', await page.locator('app-alert-message').textContent());
    }
  }
}

await browser.close();
