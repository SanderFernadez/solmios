const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Intercept all requests
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('/api/auth/login')) {
      console.log('INTERCEPTED LOGIN:', url);
    }
    if (url.includes('/api/auth/logout')) {
      console.log('INTERCEPTED LOGOUT:', url);
      console.log('Stack:', new Error().stack?.split('\n').slice(1, 3).join('\n'));
    }
    await route.continue();
  });
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
