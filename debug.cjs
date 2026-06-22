const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@managerhotel.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log('After login:', page.url());
  
  const headings = await page.$$eval('h1, h2, h3, h4', els => els.map(e => e.textContent?.trim()));
  console.log('Headings:', headings.slice(0, 10));
  
  // Test rooms
  await page.goto('http://localhost:5173/panel/rooms');
  await page.waitForTimeout(2000);
  console.log('\nRooms URL:', page.url());
  const roomHeadings = await page.$$eval('h1, h2, h3, h4', els => els.map(e => e.textContent?.trim()));
  console.log('Room headings:', roomHeadings.slice(0, 5));
  
  // Check for any text content
  const text = await page.textContent('body');
  console.log('Body text preview:', text?.substring(0, 200));
  
  await browser.close();
})();
