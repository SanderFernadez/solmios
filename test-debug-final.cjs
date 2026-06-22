const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  
  await page.goto('http://localhost:5173/login');
  
  // Test auth store directly
  const result = await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/stores/auth.store.ts');
    const auth = useAuthStore();
    
    console.log('1. Before login:', auth.isAuthenticated);
    
    try {
      await auth.login('admin@caribeparadise.com', 'demo123');
      console.log('2. After login:', auth.isAuthenticated);
      console.log('3. Token:', auth.token ? 'YES' : 'NO');
      console.log('4. localStorage:', localStorage.getItem('token') ? 'YES' : 'NO');
      
      // Simulate navigation
      window.location.href = '/panel';
      
      // Wait for navigation
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('5. After nav:', auth.isAuthenticated);
      console.log('6. Token after nav:', auth.token ? 'YES' : 'NO');
      console.log('7. localStorage after nav:', localStorage.getItem('token') ? 'YES' : 'NO');
      
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('Result:', result);
  await browser.close();
})();
