const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log('After login:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')) ? 'YES' : 'NO');
  
  // Go to admin panel instead
  await page.goto('http://localhost:5173/admin');
  await page.waitForTimeout(2000);
  console.log('\nAdmin URL:', page.url());
  console.log('Token after admin:', await page.evaluate(() => localStorage.getItem('token')) ? 'YES' : 'NO');
  
  // Test admin pages
  const pages = ['/admin/hotels', '/admin/users', '/admin/audit', '/admin/roles'];
  for (const p of pages) {
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(1500);
    console.log(p + ': ' + (page.url().includes('/login') ? 'FAIL' : 'OK'));
  }
  
  await browser.close();
})();
