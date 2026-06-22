const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log('After login:', page.url());
  
  // Check localStorage for token
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token exists:', !!token);
  
  // Check if user is stored
  const user = await page.evaluate(() => localStorage.getItem('user'));
  console.log('User stored:', !!user);
  if (user) {
    const userData = JSON.parse(user);
    console.log('User role:', userData.role);
    console.log('User hotelId:', userData.hotelId);
  }
  
  // Try to go to rooms
  await page.goto('http://localhost:5173/panel/rooms');
  await page.waitForTimeout(2000);
  console.log('After rooms:', page.url());
  
  // Check console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Console error:', msg.text());
  });
  
  await page.goto('http://localhost:5173/panel/rooms');
  await page.waitForTimeout(3000);
  
  await browser.close();
})();
