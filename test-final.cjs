const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log('After login:', page.url());
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token:', token ? 'EXISTS' : 'MISSING');
  
  if (page.url().includes('/panel') && token) {
    console.log('\n=== Testing all panel pages ===');
    const pages = [
      '/panel/dashboard', '/panel/reservations', '/panel/rooms',
      '/panel/guests', '/panel/billing', '/panel/housekeeping',
      '/panel/maintenance', '/panel/gastos', '/panel/opiniones',
      '/panel/settings', '/panel/night-audit', '/panel/groups', '/panel/planning'
    ];
    let ok = 0, fail = 0;
    for (const p of pages) {
      await page.goto('http://localhost:5173' + p);
      await page.waitForTimeout(1500);
      if (page.url().includes('/login')) { fail++; console.log(`  ❌ ${p} -> login`); }
      else { ok++; console.log(`  ✅ ${p}`); }
    }
    console.log(`\nPanel: ${ok} passed, ${fail} failed`);
  } else {
    console.log('Login failed or token missing');
  }
  
  await browser.close();
})();
