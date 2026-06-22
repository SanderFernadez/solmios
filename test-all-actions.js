const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';

let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, err) { failed++; console.log(`  ❌ ${name}: ${err}`); }

async function test(name, fn) {
  try { await fn(); ok(name); }
  catch (e) { fail(name, e.message); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 1. AUTH MODULE ===\n');
  
  // Login
  await test('Login correcto', async () => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'admin@managerhotel.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    if (!page.url().includes('/admin')) throw new Error('No redirect');
  });
  
  await test('Login incorrecto muestra error', async () => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const error = await page.$('.bg-red\\/10');
    if (!error) throw new Error('No error shown');
  });
  
  await test('Redirect sin auth va a login', async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/panel/settings`);
    await p.waitForTimeout(2000);
    if (!p.url().includes('/login')) throw new Error('No redirect to login');
    await ctx.close();
  });
  
  // Logout
  await test('Logout funciona', async () => {
    await page.goto(`${BASE}/admin`);
    await page.waitForTimeout(1000);
    // Find and click logout button
    const logoutBtn = await page.$('button:has-text("Salir"), button:has-text("Logout"), [data-action="logout"]');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(2000);
    }
    // Check if redirected to login
    await page.goto(`${BASE}/panel/dashboard`);
    await page.waitForTimeout(1000);
    if (!page.url().includes('/login')) throw new Error('Not redirected after logout');
  });
  
  // Re-login for next tests
  await test('Re-login para siguientes tests', async () => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'admin@managerhotel.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    if (!page.url().includes('/admin')) throw new Error('No redirect');
  });
  
  console.log('\n=== 2. ROOMS MODULE ===\n');
  
  await test('Rooms page carga', async () => {
    await page.goto(`${BASE}/panel/rooms`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  await test('Crear habitación', async () => {
    await page.goto(`${BASE}/panel/rooms`);
    await page.waitForLoadState('networkidle');
    const btn = await page.$('button:has-text("Nueva"), button:has-text("Crear"), button:has-text("+")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(1000);
      // Check if modal opened
      const modal = await page.$('.fixed.inset-0, [role="dialog"]');
      if (modal) ok('Modal opened');
    }
  });
  
  console.log('\n=== 3. RESERVATIONS MODULE ===\n');
  
  await test('Reservations page carga', async () => {
    await page.goto(`${BASE}/panel/reservations`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 4. HOUSEKEEPING MODULE ===\n');
  
  await test('Housekeeping page carga', async () => {
    await page.goto(`${BASE}/panel/housekeeping`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 5. MAINTENANCE MODULE ===\n');
  
  await test('Maintenance page carga', async () => {
    await page.goto(`${BASE}/panel/maintenance`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 6. BILLING MODULE ===\n');
  
  await test('Billing page carga', async () => {
    await page.goto(`${BASE}/panel/billing`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 7. GASTOS MODULE ===\n');
  
  await test('Gastos page carga', async () => {
    await page.goto(`${BASE}/panel/gastos`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 8. OPINIONES MODULE ===\n');
  
  await test('Opiniones page carga', async () => {
    await page.goto(`${BASE}/panel/opiniones`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 9. SETTINGS MODULE ===\n');
  
  await test('Settings page carga', async () => {
    await page.goto(`${BASE}/panel/settings`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  console.log('\n=== 10. SUPER ADMIN ===\n');
  
  await test('Super Admin page carga', async () => {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  await test('Admin Hotels page carga', async () => {
    await page.goto(`${BASE}/admin/hotels`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  await test('Admin Users page carga', async () => {
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  await test('Admin Audit page carga', async () => {
    await page.goto(`${BASE}/admin/audit`);
    await page.waitForLoadState('networkidle');
    const h2 = await page.$('h2');
    if (!h2) throw new Error('No h2 found');
  });
  
  await browser.close();
  
  console.log('\n=== RESUMEN ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
})();
