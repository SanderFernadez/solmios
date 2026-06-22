const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  
  // Test if http service picks up token
  const result = await page.evaluate(async () => {
    // First login
    const { useAuthStore } = await import('/src/stores/auth.store.ts');
    const auth = useAuthStore();
    await auth.login('admin@caribeparadise.com', 'demo123');
    
    console.log('Token in store:', auth.token ? 'YES' : 'NO');
    console.log('Token in localStorage:', localStorage.getItem('token') ? 'YES' : 'NO');
    
    // Now test if http service picks up the token
    const { http } = await import('/src/services/http.ts');
    try {
      const result = await http.get('/auth/me');
      return { success: true, user: result };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('Result:', result);
  await browser.close();
})();
