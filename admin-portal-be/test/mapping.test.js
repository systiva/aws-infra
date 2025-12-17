const request = require('supertest');
const { expect } = require('chai');
const app = require('../app'); // Adjust the path as necessary

describe('POST /ingest', () => {
  it('should successfully ingest data', async () => {
    const response = await request(app).post('/ingest').send({ key: 'value' }); // Replace with actual data structure

    expect(response.status).to.equal(200);
    expect(response.body).to.have.property(
      'message',
      'Data ingested successfully',
    ); // Adjust based on actual response
  });

  it('should return an error for invalid data', async () => {
    const response = await request(app).post('/ingest').send({}); // Sending invalid data

    expect(response.status).to.equal(400);
    expect(response.body).to.have.property('error'); // Adjust based on actual response
  });
});
