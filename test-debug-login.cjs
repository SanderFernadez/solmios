const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  
  // Inject debugging
  await page.evaluate(() => {
    window.__debugLog = [];
    const origSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      window.__debugLog.push(`SET ${key}: ${value.substring(0, 50)}`);
      origSetItem.call(this, key, value);
    };
  });
  
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(5000);
  
  console.log('\nDebug log:', await page.evaluate(() => window.__debugLog));
  console.log('URL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
