const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Track ALL localStorage operations
  await page.addInitScript(() => {
    const origSet = localStorage.setItem.bind(localStorage);
    const origDel = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = (k, v) => {
      console.log('LS_SET:', k, v.substring(0, 50));
      origSet(k, v);
    };
    localStorage.removeItem = (k) => {
      console.log('LS_DEL:', k);
      origDel(k);
    };
  });
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('\n=== Final state ===');
  console.log('URL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
