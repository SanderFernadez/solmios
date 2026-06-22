const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  
  // Test auth store directly
  const result = await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/stores/auth.store.ts');
    const auth = useAuthStore();
    
    console.log('1. Before login - isAuthenticated:', auth.isAuthenticated);
    
    try {
      await auth.login('admin@caribeparadise.com', 'demo123');
      console.log('2. After login - isAuthenticated:', auth.isAuthenticated);
      console.log('3. After login - token:', auth.token ? 'EXISTS' : 'MISSING');
      
      // Simulate what happens when page navigates
      console.log('4. Simulating page load...');
      
      // Check if isAuthenticated is still true
      console.log('5. Still isAuthenticated:', auth.isAuthenticated);
      
      return { success: true, token: auth.token ? 'EXISTS' : 'MISSING' };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('Result:', result);
  
  await browser.close();
})();
