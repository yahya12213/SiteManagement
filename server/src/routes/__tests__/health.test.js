/**
 * Tests d'intégration pour les routes de santé
 * Test simple pour valider l'infrastructure
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';

// Application de test minimale
const app = express();
app.use(express.json());

// Route de santé publique
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Route protégée pour test
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Access granted', user: req.user });
});

describe('Routes Health Check - Tests d\'intégration', () => {

  describe('GET /api/health', () => {
    test('retourne 200 sans authentification', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });

    test('retourne un format JSON valide', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /api/protected', () => {
    test('retourne 401 sans token', async () => {
      const response = await request(app).get('/api/protected');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    test('retourne 403 avec token invalide', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('accepte un token JWT valide', async () => {
      // Générer un token valide
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign(
        { id: 'test-user', username: 'test', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Access granted');
      expect(response.body.user.id).toBe('test-user');
    });
  });

  describe('Request handling', () => {
    test('gère les requêtes JSON correctement', async () => {
      app.post('/api/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const testData = { name: 'test', value: 123 };

      const response = await request(app)
        .post('/api/test-json')
        .send(testData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual(testData);
    });

    test('gère les erreurs 404 pour routes inexistantes', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});
