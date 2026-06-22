const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  
  // Monitor all API calls and localStorage
  await page.evaluate(() => {
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      const token = localStorage.getItem('token');
      console.log('FETCH:', url, 'TOKEN:', token ? 'YES' : 'NO');
      const result = await origFetch.apply(this, args);
      console.log('RESULT:', url, result.status);
      return result;
    };
  });
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  
  console.log('\nFinal URL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
