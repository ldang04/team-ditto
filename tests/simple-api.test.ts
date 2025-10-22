// Simple API tests that don't require full app initialization
import request from 'supertest';
import express from 'express';

describe('Simple API Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Add a simple test route
    app.get('/test', (req, res) => {
      res.json({ message: 'Test successful', timestamp: new Date().toISOString() });
    });

    app.post('/test-json', (req, res) => {
      res.json({ received: req.body });
    });
  });

  describe('Basic Express functionality', () => {
    it('should handle GET requests', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Test successful');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle POST requests with JSON', async () => {
      const testData = { name: 'test', value: 123 };
      
      const response = await request(app)
        .post('/test-json')
        .send(testData)
        .expect(200);

      expect(response.body.received).toEqual(testData);
    });

    it('should handle 404 for unknown routes', async () => {
      await request(app)
        .get('/unknown-route')
        .expect(404);
    });
  });
});
