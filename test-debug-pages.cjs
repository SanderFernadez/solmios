const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('ERR:', msg.text());
  });
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  // Test failing pages
  const failPages = ['/panel/housekeeping', '/panel/maintenance', '/panel/gastos', '/panel/opiniones', '/panel/settings'];
  
  for (const p of failPages) {
    console.log('\n=== Testing ' + p + ' ===');
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(3000);
    console.log('URL:', page.url());
    console.log('Token:', await page.evaluate(() => localStorage.getItem('token')) ? 'YES' : 'NO');
  }
  
  await browser.close();
})();
