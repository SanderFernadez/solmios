const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      const auth = req.headers()['authorization'];
      requests.push({ method: req.method(), url: req.url(), hasAuth: !!auth });
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      const req = requests.find(r => r.url === res.url());
      if (req) req.status = res.status();
    }
  });
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('\n=== API Requests ===');
  for (const r of requests) {
    console.log(r.method + ' ' + r.url.split('?')[0] + ' - Auth: ' + r.hasAuth + ' - Status: ' + r.status);
  }
  
  console.log('\nURL:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  await browser.close();
})();
