const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 1. LOGIN ===');
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token:', token ? 'EXISTS' : 'MISSING');
  
  if (!token) {
    console.log('\n❌ Login FAILED');
    await browser.close();
    return;
  }
  
  console.log('\n✅ Login SUCCESS\n');
  
  console.log('=== 2. PANEL PAGES ===');
  const pages = [
    '/panel/dashboard', '/panel/reservations', '/panel/rooms',
    '/panel/guests', '/panel/billing', '/panel/housekeeping',
    '/panel/maintenance', '/panel/gastos', '/panel/opiniones',
    '/panel/settings'
  ];
  
  let ok = 0, fail = 0;
  for (const p of pages) {
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(2000);
    if (page.url().includes('/login')) { fail++; console.log('  ❌ ' + p); }
    else { ok++; console.log('  ✅ ' + p); }
  }
  
  console.log('\n=== RESUMEN ===');
  console.log('Login: ✅');
  console.log('Pages: ' + ok + ' passed, ' + fail + ' failed');
  
  await browser.close();
})();
