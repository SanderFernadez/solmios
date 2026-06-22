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
  
  console.log('=== Login: ✅ ===\n');
  
  const pages = [
    '/panel/dashboard', '/panel/reservations', '/panel/rooms',
    '/panel/guests', '/panel/billing', '/panel/housekeeping',
    '/panel/maintenance', '/panel/gastos', '/panel/opiniones',
    '/panel/settings'
  ];
  
  let ok = 0;
  for (const p of pages) {
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    const hasContent = text && text.length > 100;
    console.log(p + ': ' + (hasContent ? '✅ Content loaded' : '❌ No content'));
    if (hasContent) ok++;
  }
  
  console.log('\n=== RESUMEN: ' + ok + '/10 pages with content ===');
  
  await browser.close();
})();
