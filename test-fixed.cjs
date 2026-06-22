const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')) ? 'EXISTS' : 'MISSING');
  
  if (page.url().includes('/panel')) {
    console.log('\n=== Testing pages ===');
    const pages = ['/panel/dashboard', '/panel/rooms', '/panel/reservations', '/panel/guests', '/panel/billing', '/panel/housekeeping', '/panel/maintenance', '/panel/gastos', '/panel/opiniones', '/panel/settings'];
    let ok = 0, fail = 0;
    for (const p of pages) {
      await page.goto('http://localhost:5173' + p);
      await page.waitForTimeout(1500);
      if (page.url().includes('/login')) { fail++; console.log('  FAIL: ' + p); }
      else { ok++; console.log('  OK: ' + p); }
    }
    console.log('\nResult: ' + ok + ' passed, ' + fail + ' failed');
  }
  
  await browser.close();
})();
