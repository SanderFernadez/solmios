const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  
  // Fill form
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForNavigation({ timeout: 10000 }).catch(e => console.log('Nav error:', e.message)),
    page.click('button[type="submit"]')
  ]);
  
  await page.waitForTimeout(3000);
  
  console.log('\nFinal URL:', page.url());
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token:', token ? 'EXISTS' : 'MISSING');
  
  await browser.close();
})();
