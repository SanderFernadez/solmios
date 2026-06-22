const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log('REQUEST:', req.method(), req.url());
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log('RESPONSE:', res.status(), res.url());
    }
  });
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);
  
  console.log('\n=== Filling form ===');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('\nFinal URL:', page.url());
  
  await browser.close();
})();
