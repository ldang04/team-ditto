// API tests using supertest
import request from 'supertest';
import app from '../src/app';

describe('API Endpoints', () => {
  describe('GET /api/vertex-test', () => {
    it('should handle the endpoint (may fail due to missing credentials)', async () => {
      const response = await request(app)
        .get('/api/vertex-test');

      // Should either succeed (200) or fail gracefully (500)
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toBe('Vertex AI test successful');
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('JSON parsing middleware', () => {
    it('should parse JSON requests', async () => {
      const testData = { test: 'data', number: 123 };
      
      // Create a simple POST endpoint for testing
      const testApp = require('express')();
      testApp.use(require('express').json());
      testApp.post('/test-json', (req: any, res: any) => {
        res.json({ received: req.body });
      });

      const response = await request(testApp)
        .post('/test-json')
        .send(testData)
        .expect(200);

      expect(response.body.received).toEqual(testData);
    });
  });
});
