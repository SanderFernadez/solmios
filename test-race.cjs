const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  
  // Click submit WITHOUT waiting for navigation
  await page.click('button[type="submit"]');
  
  // Wait a bit then check
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const user = await page.evaluate(() => localStorage.getItem('user'));
  console.log('Token:', token ? token.substring(0, 50) + '...' : 'MISSING');
  console.log('User:', user ? 'EXISTS' : 'MISSING');
  
  // Check if we're on panel
  if (page.url().includes('/panel')) {
    console.log('\n=== On panel, testing navigation ===');
    await page.goto('http://localhost:5173/panel/rooms');
    await page.waitForTimeout(2000);
    console.log('Rooms URL:', page.url());
    
    const token2 = await page.evaluate(() => localStorage.getItem('token'));
    console.log('Token after navigation:', token2 ? 'EXISTS' : 'MISSING');
  }
  
  await browser.close();
})();
