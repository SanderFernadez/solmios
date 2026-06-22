const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  
  // Monitor localStorage changes
  await page.evaluate(() => {
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k, v) => {
      console.log('LS_SET:', k, v.substring(0, 30));
      orig(k, v);
    };
    const origR = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = (k) => {
      console.log('LS_DEL:', k);
      origR(k);
    };
  });
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  
  console.log('\nFinal URL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
