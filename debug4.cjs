const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log('CONSOLE:', msg.type(), msg.text());
    }
  });
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  
  // Try to call the API directly from the browser
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@caribeparadise.com', password: 'demo123' })
      });
      const data = await res.json();
      return { status: res.status, data: data };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('Direct API call result:', JSON.stringify(result, null, 2));
  
  await browser.close();
})();
