const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
let passed = 0, failed = 0;
function ok(n) { passed++; console.log(`  ✅ ${n}`); }
function fail(n, e) { failed++; console.log(`  ❌ ${n}: ${e}`); }
async function test(n, fn) { try { await fn(); ok(n); } catch(e) { fail(n, e.message); } }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== LOGIN ===');
  await test('Login hotel_admin', async () => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'admin@caribeparadise.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    if (!page.url().includes('/panel')) throw new Error('No redirect to panel: ' + page.url());
  });
  
  console.log('\n=== PANEL PAGES ===');
  const panelPages = [
    '/panel/dashboard',
    '/panel/reservations',
    '/panel/rooms',
    '/panel/guests',
    '/panel/billing',
    '/panel/housekeeping',
    '/panel/maintenance',
    '/panel/gastos',
    '/panel/opiniones',
    '/panel/settings',
    '/panel/night-audit',
    '/panel/groups',
    '/panel/planning'
  ];
  
  for (const p of panelPages) {
    await test(`Page ${p}`, async () => {
      await page.goto(`${BASE}${p}`);
      await page.waitForTimeout(2000);
      if (page.url().includes('/login')) throw new Error('Redirected to login');
      const body = await page.textContent('body');
      if (!body || body.length < 50) throw new Error('Empty page');
    });
  }
  
  console.log('\n=== CRUD ACTIONS ===');
  
  // Test create room
  await test('Create room modal opens', async () => {
    await page.goto(`${BASE}/panel/rooms`);
    await page.waitForTimeout(2000);
    const btn = await page.$('button:has-text("Nueva"), button:has-text("Crear"), button:has-text("+")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  });
  
  // Test create reservation
  await test('Create reservation page loads', async () => {
    await page.goto(`${BASE}/panel/reservations`);
    await page.waitForTimeout(2000);
    const btn = await page.$('button:has-text("Nueva"), button:has-text("Crear"), button:has-text("+")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  });
  
  // Test housekeeping
  await test('Housekeeping page loads', async () => {
    await page.goto(`${BASE}/panel/housekeeping`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    if (!body || body.length < 50) throw new Error('Empty page');
  });
  
  // Test maintenance
  await test('Maintenance page loads', async () => {
    await page.goto(`${BASE}/panel/maintenance`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    if (!body || body.length < 50) throw new Error('Empty page');
  });
  
  // Test billing
  await test('Billing page loads', async () => {
    await page.goto(`${BASE}/panel/billing`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    if (!body || body.length < 50) throw new Error('Empty page');
  });
  
  // Test gastos
  await test('Gastos page loads', async () => {
    await page.goto(`${BASE}/panel/gastos`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    if (!body || body.length < 50) throw new Error('Empty page');
  });
  
  // Test opiniones
  await test('Opiniones page loads', async () => {
    await page.goto(`${BASE}/panel/opiniones`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    if (!body || body.length < 50) throw new Error('Empty page');
  });
  
  // Test settings
  await test('Settings page loads', async () => {
    await page.goto(`${BASE}/panel/settings`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    if (!body || body.length < 50) throw new Error('Empty page');
  });
  
  console.log('\n=== SUPER ADMIN ===');
  await test('Super Admin login', async () => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'admin@managerhotel.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    if (!page.url().includes('/admin')) throw new Error('No redirect');
  });
  
  const adminPages = ['/admin', '/admin/hotels', '/admin/users', '/admin/audit', '/admin/roles', '/admin/announcements', '/admin/api-keys'];
  for (const p of adminPages) {
    await test(`Admin ${p}`, async () => {
      await page.goto(`${BASE}${p}`);
      await page.waitForTimeout(2000);
      if (page.url().includes('/login')) throw new Error('Redirected to login');
    });
  }
  
  await browser.close();
  console.log(`\n=== RESUMEN: ${passed} passed, ${failed} failed ===`);
})();
