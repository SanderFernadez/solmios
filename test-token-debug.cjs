const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  // Get the token
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token:', token ? token.substring(0, 50) + '...' : 'MISSING');
  
  // Test the token directly
  const result = await page.evaluate(async (tkn) => {
    try {
      const res = await fetch('http://localhost:3001/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + tkn }
      });
      const data = await res.json();
      return { status: res.status, data: data };
    } catch (e) {
      return { error: e.message };
    }
  }, token);
  
  console.log('Direct API test:', JSON.stringify(result, null, 2));
  
  await browser.close();
})();
