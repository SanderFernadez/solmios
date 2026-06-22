const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  
  // Test API from browser context
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@caribeparadise.com', password: 'demo123' })
      });
      const text = await res.text();
      return { status: res.status, body: text.substring(0, 200) };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('API result:', result);
  
  await browser.close();
})();
