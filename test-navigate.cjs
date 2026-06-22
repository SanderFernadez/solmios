const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/login');
  
  // Login directly via auth store, then navigate
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/stores/auth.store.ts');
    const auth = useAuthStore();
    await auth.login('admin@caribeparadise.com', 'demo123');
    console.log('Logged in, token:', !!auth.token);
  });
  
  // Now navigate to panel
  await page.goto('http://localhost:5173/panel/dashboard');
  await page.waitForTimeout(2000);
  
  console.log('After navigation:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('token')));
  
  // Test rooms
  await page.goto('http://localhost:5173/panel/rooms');
  await page.waitForTimeout(2000);
  console.log('Rooms URL:', page.url());
  console.log('Token after rooms:', await page.evaluate(() => localStorage.getItem('token')));
  
  await context.close();
  await browser.close();
})();
