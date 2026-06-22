const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  
  await page.goto('http://localhost:5173/login');
  
  const result = await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/stores/auth.store.ts');
    const auth = useAuthStore();
    
    console.log('A: isAuthenticated before:', auth.isAuthenticated);
    
    try {
      await auth.login('admin@caribeparadise.com', 'demo123');
      console.log('B: isAuthenticated after login:', auth.isAuthenticated);
      console.log('C: token exists:', !!auth.token);
      console.log('D: localStorage token:', localStorage.getItem('token') ? 'YES' : 'NO');
      
      // Now try to navigate (simulating what handleLogin does)
      // Don't actually navigate, just check if token persists
      console.log('E: token still exists:', !!auth.token);
      
    } catch (e) {
      console.log('ERROR:', e.message);
    }
    
    return { token: auth.token ? 'YES' : 'NO' };
  });
  
  console.log('Result:', result);
  await browser.close();
})();
