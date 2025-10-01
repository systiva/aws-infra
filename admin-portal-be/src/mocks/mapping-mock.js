module.exports = {
  mockIngestData: {
    id: '12345',
    name: 'Test Data',
    description: 'This is a mock description for testing ingest functionality.',
    timestamp: new Date().toISOString(),
  },
  generateMockIngestData: () => {
    return {
      id: Math.random().toString(36).substring(2, 15),
      name: `Mock Data ${Math.floor(Math.random() * 100)}`,
      description: 'This is a generated mock description.',
      timestamp: new Date().toISOString(),
    };
  },
};
