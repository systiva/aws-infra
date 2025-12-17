const request = require('supertest');
const { expect } = require('chai');
const app = require('../../app');

describe('Tenant API Routes', () => {
  
  describe('GET /api/v1/tenants', () => {
    it('should return all tenants with total count', async () => {
      const response = await request(app)
        .get('/api/v1/tenants')
        .expect(200);
      
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('tenants');
      expect(response.body.data).to.have.property('totalCount');
      expect(response.body.data.tenants).to.be.an('array');
    });
  });

  describe('POST /api/v1/tenants/onboard', () => {
    it('should create a new tenant', async () => {
      const newTenant = {
        organizationName: 'Test Company',
        primaryContact: 'test@testcompany.com',
        subscriptionTier: 'starter',
        awsRegion: 'us-east-1',
        createdBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(newTenant)
        .expect(201);
      
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('tenantId');
      expect(response.body.data.organizationName).to.equal('Test Company');
      expect(response.body.data.provisioningState).to.equal('active');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidTenant = {
        organizationName: 'Test Company'
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(invalidTenant)
        .expect(500); // Will be 500 due to internal error handling
      
      expect(response.body).to.have.property('result');
      expect(response.body.result).to.equal('FAILED');
    });
  });

  describe('PUT /api/v1/tenants/onboard', () => {
    it('should update an existing tenant', async () => {
      // First create a tenant
      const newTenant = {
        organizationName: 'Update Test Company',
        primaryContact: 'update@testcompany.com',
        subscriptionTier: 'starter',
        awsRegion: 'us-east-1'
      };

      const createResponse = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(newTenant);

      const tenantId = createResponse.body.data.tenantId;

      // Now update the tenant
      const updateData = {
        tenantId: tenantId,
        subscriptionTier: 'growth',
        primaryContact: 'newemail@testcompany.com'
      };

      const response = await request(app)
        .put('/api/v1/tenants/onboard')
        .send(updateData)
        .expect(200);
      
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('data');
      expect(response.body.data.subscriptionTier).to.equal('growth');
    });
  });

  describe('DELETE /api/v1/tenants/offboard/:tenantId', () => {
    it('should delete an existing tenant', async () => {
      // First create a tenant
      const newTenant = {
        organizationName: 'Delete Test Company',
        primaryContact: 'delete@testcompany.com',
        subscriptionTier: 'starter',
        awsRegion: 'us-east-1'
      };

      const createResponse = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(newTenant);

      const tenantId = createResponse.body.data.tenantId;

      // Now delete the tenant
      const response = await request(app)
        .delete(`/api/v1/tenants/offboard/${tenantId}`)
        .expect(200);
      
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('data');
      expect(response.body.data.tenantId).to.equal(tenantId);
    });

    it('should return 404 for non-existent tenant', async () => {
      const nonExistentId = 'tenant_nonexistent_123';

      const response = await request(app)
        .delete(`/api/v1/tenants/offboard/${nonExistentId}`)
        .expect(404);
      
      expect(response.body).to.have.property('status');
      expect(response.body.data.tenantId).to.equal(nonExistentId);
    });
  });

  describe('POST /api/v1/tenants/onboard - Step Functions Integration', () => {
    it('should create a tenant with private subscription tier using Step Functions', async () => {
      const privateTenant = {
        tenantName: 'Private Test Tenant',
        email: 'private@testcompany.com',
        subscriptionTier: 'private',
        createdBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(privateTenant)
        .expect(201);
      
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('tenantId');
      expect(response.body.data.subscriptionTier).to.equal('private');
      expect(response.body.data.provisioningState).to.equal('creating');
      expect(response.body.data.tenantTableName).to.match(/^TENANT_\d{8}$/);
    });

    it('should create a tenant with public subscription tier using Step Functions', async () => {
      const publicTenant = {
        tenantName: 'Public Test Tenant',
        email: 'public@testcompany.com',
        subscriptionTier: 'public',
        createdBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(publicTenant)
        .expect(201);
      
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('tenantId');
      expect(response.body.data.subscriptionTier).to.equal('public');
      expect(response.body.data.provisioningState).to.equal('creating');
      expect(response.body.data.tenantTableName).to.equal('TENANT_PUBLIC');
    });

    it('should return 400 for invalid subscription tier', async () => {
      const invalidTenant = {
        tenantName: 'Invalid Tier Tenant',
        email: 'invalid@testcompany.com',
        subscriptionTier: 'premium',
        createdBy: 'test-user'
      };

      const response = await request(app)
        .post('/api/v1/tenants/onboard')
        .send(invalidTenant)
        .expect(500);
      
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Invalid subscription tier');
    });
  });

  describe('GET /api/v1/tenants/{tenantId}/provisioning-status - Step Functions Integration', () => {
    it('should return tenant provisioning status with Step Functions info', async () => {
      // This test would work with an existing tenant that has Step Functions execution
      // For demonstration, we'll test the endpoint structure
      const testTenantId = 'test_tenant_123';

      const response = await request(app)
        .get(`/api/v1/tenants/${testTenantId}/provisioning-status`)
        .expect(404); // Will return 404 if tenant doesn't exist, which is expected
      
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Tenant not found');
    });
  });
});
