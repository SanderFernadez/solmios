const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 1. LOGIN ===');
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@caribeparadise.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token:', token ? 'EXISTS' : 'MISSING');
  
  if (!token) {
    console.log('\n❌ Login FAILED - token not stored');
    await browser.close();
    return;
  }
  
  console.log('\n✅ Login SUCCESS\n');
  
  console.log('=== 2. PANEL PAGES ===');
  const panelPages = [
    '/panel/dashboard', '/panel/reservations', '/panel/rooms',
    '/panel/guests', '/panel/billing', '/panel/housekeeping',
    '/panel/maintenance', '/panel/gastos', '/panel/opiniones',
    '/panel/settings', '/panel/night-audit', '/panel/groups', '/panel/planning'
  ];
  
  let panelOk = 0, panelFail = 0;
  for (const p of panelPages) {
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(2000);
    if (page.url().includes('/login')) { panelFail++; console.log('  ❌ ' + p); }
    else { panelOk++; console.log('  ✅ ' + p); }
  }
  
  console.log('\n=== 3. SUPER ADMIN ===');
  // Re-login as super_admin
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@managerhotel.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  const adminPages = ['/admin', '/admin/hotels', '/admin/users', '/admin/audit', '/admin/roles', '/admin/announcements', '/admin/api-keys'];
  let adminOk = 0, adminFail = 0;
  for (const p of adminPages) {
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(1500);
    if (page.url().includes('/login')) { adminFail++; console.log('  ❌ ' + p); }
    else { adminOk++; console.log('  ✅ ' + p); }
  }
  
  console.log('\n=== RESUMEN ===');
  console.log('Login: ✅');
  console.log('Panel: ' + panelOk + ' passed, ' + panelFail + ' failed');
  console.log('Admin: ' + adminOk + ' passed, ' + adminFail + ' failed');
  console.log('Total: ' + (panelOk + adminOk) + ' passed, ' + (panelFail + adminFail) + ' failed');
  
  await browser.close();
})();
