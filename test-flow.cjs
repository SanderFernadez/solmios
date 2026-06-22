const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('After login:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')) ? 'YES' : 'NO');
  
  // If on panel, test navigation
  if (page.url().includes('/panel')) {
    console.log('\n=== Testing navigation ===');
    
    // Go to rooms
    await page.goto('http://localhost:5173/panel/rooms');
    await page.waitForTimeout(2000);
    console.log('Rooms:', page.url());
    console.log('Token after rooms:', await page.evaluate(() => localStorage.getItem('token')) ? 'YES' : 'NO');
    
    // Go back to dashboard
    await page.goto('http://localhost:5173/panel/dashboard');
    await page.waitForTimeout(2000);
    console.log('Dashboard:', page.url());
    console.log('Token after dashboard:', await page.evaluate(() => localStorage.getItem('token')) ? 'YES' : 'NO');
  }
  
  await browser.close();
})();
