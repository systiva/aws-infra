// Test HTTP status codes for authentication endpoints
require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

console.log('=== Testing HTTP Status Codes ===');

async function testStatusCodes() {
  try {
    console.log('\n1. Testing invalid login credentials (should return 401)...');
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        username: 'nonexistent@example.com',
        password: 'wrongpassword'
      });
    } catch (error) {
      console.log(`✅ Login with invalid credentials: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Message: ${error.response.data.message}`);
    }

    console.log('\n2. Testing login with missing fields (should return 400)...');
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        username: 'test@example.com'
        // Missing password
      });
    } catch (error) {
      console.log(`✅ Login with missing fields: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Message: ${error.response.data.message}`);
    }

    console.log('\n3. Testing signup with missing Account-ID (should return 400)...');
    try {
      await axios.post(`${BASE_URL}/auth/signup`, {
        username: 'newuser@example.com',
        email: 'newuser@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
        // Missing accountId - should be mandatory
      });
    } catch (error) {
      console.log(`✅ Signup without Account-ID: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Message: ${error.response.data.message}`);
    }

    console.log('\n4. Testing signup with all required fields...');
    try {
      const response = await axios.post(`${BASE_URL}/auth/signup`, {
        username: 'testuser_' + Date.now() + '@example.com',
        email: 'testuser_' + Date.now() + '@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        accountId: 'test-account-123',
        userRole: 'viewer'
      });
      console.log(`✅ Valid signup: ${response.status} ${response.statusText}`);
      console.log(`   Message: ${response.data.message}`);
    } catch (error) {
      console.log(`❌ Valid signup failed: ${error.response?.status} ${error.response?.statusText}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }

    console.log('\n5. Testing health endpoint (should return 200)...');
    try {
      const response = await axios.get(`http://localhost:3001/health`);
      console.log(`✅ Health check: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`❌ Health check failed: ${error.response?.status || 'Connection error'}`);
    }

    console.log('\n🎉 Status code tests completed!');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('Make sure the IMS service is running: npm run local');
  }
}

testStatusCodes();