// Test password policy validation
require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

console.log('=== Testing Password Policy Validation ===');

async function testPasswordPolicyErrors() {
  try {
    // Test cases for different password policy violations
    const testCases = [
      {
        name: 'Short password (should return 400)',
        data: {
          username: 'testuser1@example.com',
          email: 'testuser1@example.com',
          password: '123',  // Too short
          firstName: 'Test',
          lastName: 'User',
          accountId: 'test-account',
          userRole: 'viewer'
        },
        expectedStatus: 400
      },
      {
        name: 'Weak password (should return 400)',
        data: {
          username: 'testuser2@example.com',
          email: 'testuser2@example.com',
          password: 'password',  // No special chars, numbers, uppercase
          firstName: 'Test',
          lastName: 'User',
          accountId: 'test-account',
          userRole: 'viewer'
        },
        expectedStatus: 400
      },
      {
        name: 'Missing Account-ID (should return 400)',
        data: {
          username: 'testuser3@example.com',
          email: 'testuser3@example.com',
          password: 'ValidPassword123!',
          firstName: 'Test',
          lastName: 'User',
          userRole: 'viewer'
          // Missing accountId
        },
        expectedStatus: 400
      },
      {
        name: 'Valid password with all fields (should work or return specific error)',
        data: {
          username: 'testuser4_' + Date.now() + '@example.com',
          email: 'testuser4_' + Date.now() + '@example.com',
          password: 'ValidPassword123!',
          firstName: 'Test',
          lastName: 'User',
          accountId: 'test-account-123',
          userRole: 'viewer'
        },
        expectedStatus: 201
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      
      try {
        const response = await axios.post(`${BASE_URL}/auth/signup`, testCase.data);
        console.log(`✅ Status: ${response.status} - ${testCase.name}`);
        console.log(`   Message: ${response.data.message}`);
        
        if (response.status !== testCase.expectedStatus) {
          console.log(`⚠️  Expected ${testCase.expectedStatus}, got ${response.status}`);
        }
      } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        console.log(`📋 Status: ${status} - ${testCase.name}`);
        console.log(`   Message: ${message}`);
        
        if (status === testCase.expectedStatus) {
          console.log(`✅ Correct status code returned`);
        } else {
          console.log(`❌ Expected ${testCase.expectedStatus}, got ${status}`);
        }
      }
    }

    console.log('\n🎉 Password policy validation tests completed!');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('Make sure the IMS service is running: npm run local');
  }
}

testPasswordPolicyErrors();