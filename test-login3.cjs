const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  
  // Inject debug into auth store login
  await page.evaluate(() => {
    window.__origFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = args[0];
      console.log('FETCH:', url);
      const result = await window.__origFetch.apply(this, args);
      console.log('FETCH_RESULT:', url, result.status);
      return result;
    };
  });
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('\nURL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
