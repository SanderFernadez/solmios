const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Listen to all console messages
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('\n=== After login ===');
  console.log('URL:', page.url());
  
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const user = await page.evaluate(() => localStorage.getItem('user'));
  console.log('Token:', token ? 'EXISTS' : 'MISSING');
  console.log('User:', user ? 'EXISTS' : 'MISSING');
  
  await browser.close();
})();
