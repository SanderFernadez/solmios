const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  
  await page.goto('http://localhost:5173/login');
  
  // Manually call auth store login
  const result = await page.evaluate(async () => {
    try {
      // Import the auth store
      const { useAuthStore } = await import('/src/stores/auth.store.ts');
      const auth = useAuthStore();
      console.log('Before login - isAuthenticated:', auth.isAuthenticated);
      await auth.login('admin@caribeparadise.com', 'demo123');
      console.log('After login - isAuthenticated:', auth.isAuthenticated);
      console.log('After login - token:', auth.token ? 'EXISTS' : 'MISSING');
      console.log('After login - user:', auth.user ? 'EXISTS' : 'MISSING');
      return { success: true };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });
  
  console.log('Result:', result);
  
  await browser.close();
})();
