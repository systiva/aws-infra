// Test logout functionality
console.log('=== Logout Functionality Test ===');

// This script can be run in the browser console to test logout
function testLogout() {
  const logoutButton = document.querySelector('.logout-button');
  const userInfo = document.querySelector('.user-info');
  const loginButton = document.querySelector('.login-button');

  console.log('🔍 Checking logout button presence...');
  if (logoutButton) {
    console.log('✅ Logout button found');
    console.log('📋 Logout button properties:');
    console.log('  - Title:', logoutButton.title);
    console.log('  - Text content:', logoutButton.textContent);
    console.log('  - Is visible:', window.getComputedStyle(logoutButton).display !== 'none');
  } else {
    console.log('❌ Logout button not found');
  }

  console.log('\n🔍 Checking authentication state...');
  if (userInfo && !loginButton) {
    console.log('✅ User is authenticated (user-info visible, login button hidden)');
  } else if (!userInfo && loginButton) {
    console.log('✅ User is not authenticated (login button visible, user-info hidden)');
  } else {
    console.log('⚠️  Inconsistent authentication state');
  }

  console.log('\n💡 To test logout:');
  console.log('1. Make sure you are logged in');
  console.log('2. Click the logout button (🚪 icon) next to user info');
  console.log('3. Verify you are redirected to login state');
}

// Auto-run the test
testLogout();

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testLogout };
}