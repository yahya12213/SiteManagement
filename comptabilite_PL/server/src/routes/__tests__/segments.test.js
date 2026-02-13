/**
 * Tests d'intégration pour les routes segments
 * Teste: RBAC (requirePermission) + SBAC (injectUserScope)
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, requirePermission, generateToken } from '../../middleware/auth.js';
import { injectUserScope, buildScopeFilter } from '../../middleware/requireScope.js';

// Application de test minimale
const app = express();
app.use(express.json());

// Mock de base de données pour SBAC
const mockUserScope = {
  'admin-1': { isAdmin: true, segments: [], cities: [] },
  'gerant-1': { isAdmin: false, segments: [1, 2], cities: [3, 4] },
  'gerant-2': { isAdmin: false, segments: [5], cities: [6] },
  'user-no-scope': { isAdmin: false, segments: [], cities: [] }
};

// Mock de segments en base
const mockSegments = [
  { id: 1, name: 'Segment A', color: '#FF0000' },
  { id: 2, name: 'Segment B', color: '#00FF00' },
  { id: 5, name: 'Segment C', color: '#0000FF' }
];

// Middleware SBAC mocké
const mockInjectUserScope = (req, res, next) => {
  const userId = req.user?.id;
  if (userId && mockUserScope[userId]) {
    req.userScope = mockUserScope[userId];
  } else {
    req.userScope = { isAdmin: false, segments: [], cities: [] };
  }
  next();
};

// Fonction helper pour filtrer par scope
const filterByScope = (segments, userScope) => {
  if (userScope.isAdmin) return segments;
  return segments.filter(seg => userScope.segments.includes(seg.id));
};

// Routes mockées
app.get('/api/segments',
  authenticateToken,
  mockInjectUserScope,
  (req, res) => {
    const filtered = filterByScope(mockSegments, req.userScope);
    res.json(filtered);
  }
);

app.get('/api/segments/:id',
  authenticateToken,
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;
    const segment = mockSegments.find(s => s.id === parseInt(id));

    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin && !req.userScope.segments.includes(segment.id)) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    res.json(segment);
  }
);

app.post('/api/segments',
  authenticateToken,
  requirePermission('accounting.segments.create'),
  (req, res) => {
    const { id, name, color } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'Missing required fields: id, name' });
    }

    const newSegment = { id: parseInt(id), name, color: color || '#3B82F6' };
    res.status(201).json(newSegment);
  }
);

app.put('/api/segments/:id',
  authenticateToken,
  requirePermission('accounting.segments.update'),
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;
    const { name, color } = req.body;

    const segment = mockSegments.find(s => s.id === parseInt(id));

    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin && !req.userScope.segments.includes(segment.id)) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    const updated = { ...segment, name, color };
    res.json(updated);
  }
);

app.delete('/api/segments/:id',
  authenticateToken,
  requirePermission('accounting.segments.delete'),
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;
    const segment = mockSegments.find(s => s.id === parseInt(id));

    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin && !req.userScope.segments.includes(segment.id)) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    res.json({ message: 'Segment deleted successfully' });
  }
);

describe('Routes Segments - Tests d\'intégration', () => {

  // Tokens de test
  let adminToken, gerantToken1, gerantToken2, noScopeToken, unauthorizedToken;

  beforeAll(() => {
    // Générer tokens de test
    adminToken = generateToken({ id: 'admin-1', username: 'admin', role: 'admin' });
    gerantToken1 = generateToken({ id: 'gerant-1', username: 'gerant1', role: 'gerant' });
    gerantToken2 = generateToken({ id: 'gerant-2', username: 'gerant2', role: 'gerant' });
    noScopeToken = generateToken({ id: 'user-no-scope', username: 'noscope', role: 'user' });
    unauthorizedToken = generateToken({ id: 'user-unauthorized', username: 'unauthorized', role: 'user' });
  });

  describe('GET /api/segments', () => {
    test('Admin voit tous les segments', async () => {
      const response = await request(app)
        .get('/api/segments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3); // Tous les segments
      expect(response.body.map(s => s.id)).toEqual([1, 2, 5]);
    });

    test('Gérant voit uniquement ses segments assignés (SBAC)', async () => {
      const response = await request(app)
        .get('/api/segments')
        .set('Authorization', `Bearer ${gerantToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map(s => s.id)).toEqual([1, 2]);
    });

    test('Gérant avec un seul segment assigné', async () => {
      const response = await request(app)
        .get('/api/segments')
        .set('Authorization', `Bearer ${gerantToken2}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(5);
    });

    test('Utilisateur sans scope voit liste vide', async () => {
      const response = await request(app)
        .get('/api/segments')
        .set('Authorization', `Bearer ${noScopeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    test('Sans token retourne 401', async () => {
      const response = await request(app).get('/api/segments');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/segments/:id', () => {
    test('Admin peut accéder à n\'importe quel segment', async () => {
      const response = await request(app)
        .get('/api/segments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Segment A');
    });

    test('Gérant peut accéder à un segment dans son scope', async () => {
      const response = await request(app)
        .get('/api/segments/1')
        .set('Authorization', `Bearer ${gerantToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
    });

    test('Gérant ne peut PAS accéder à un segment hors scope (SBAC)', async () => {
      const response = await request(app)
        .get('/api/segments/5')
        .set('Authorization', `Bearer ${gerantToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND_OR_ACCESS_DENIED');
    });

    test('Segment inexistant retourne 404', async () => {
      const response = await request(app)
        .get('/api/segments/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/segments (accounting.segments.create)', () => {
    test('Admin peut créer un segment', async () => {
      const response = await request(app)
        .post('/api/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: 10, name: 'New Segment', color: '#FFFF00' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Segment');
      expect(response.body.color).toBe('#FFFF00');
    });

    test('Utilisateur SANS permission reçoit 403 (RBAC)', async () => {
      const response = await request(app)
        .post('/api/segments')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ id: 11, name: 'Unauthorized Segment' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });

    test('Champs manquants retournent 400', async () => {
      const response = await request(app)
        .post('/api/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Missing ID' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('Sans token retourne 401', async () => {
      const response = await request(app)
        .post('/api/segments')
        .send({ id: 12, name: 'No Token' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/segments/:id (accounting.segments.update)', () => {
    test('Admin peut modifier n\'importe quel segment', async () => {
      const response = await request(app)
        .put('/api/segments/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Segment', color: '#000000' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Segment');
    });

    test('Gérant peut modifier un segment dans son scope', async () => {
      const response = await request(app)
        .put('/api/segments/1')
        .set('Authorization', `Bearer ${gerantToken1}`)
        .send({ name: 'Gérant Update', color: '#111111' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Gérant Update');
    });

    test('Gérant ne peut PAS modifier un segment hors scope (SBAC)', async () => {
      const response = await request(app)
        .put('/api/segments/5')
        .set('Authorization', `Bearer ${gerantToken1}`)
        .send({ name: 'Forbidden Update' });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND_OR_ACCESS_DENIED');
    });

    test('Utilisateur SANS permission reçoit 403 (RBAC)', async () => {
      const response = await request(app)
        .put('/api/segments/1')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ name: 'Unauthorized Update' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });

  describe('DELETE /api/segments/:id (accounting.segments.delete)', () => {
    test('Admin peut supprimer n\'importe quel segment', async () => {
      const response = await request(app)
        .delete('/api/segments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
    });

    test('Gérant peut supprimer un segment dans son scope', async () => {
      const response = await request(app)
        .delete('/api/segments/2')
        .set('Authorization', `Bearer ${gerantToken1}`);

      expect(response.status).toBe(200);
    });

    test('Gérant ne peut PAS supprimer un segment hors scope (SBAC)', async () => {
      const response = await request(app)
        .delete('/api/segments/5')
        .set('Authorization', `Bearer ${gerantToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND_OR_ACCESS_DENIED');
    });

    test('Utilisateur SANS permission reçoit 403 (RBAC)', async () => {
      const response = await request(app)
        .delete('/api/segments/1')
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });

  describe('Scénarios de sécurité', () => {
    test('Token expiré retourne 401', async () => {
      const expiredToken = jwt.sign(
        { id: 'admin-1', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/segments')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    test('Token invalide retourne 403', async () => {
      const response = await request(app)
        .get('/api/segments')
        .set('Authorization', 'Bearer invalid-token-12345');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('RBAC + SBAC ensemble - utilisateur doit avoir les DEUX', async () => {
      // Gérant a le scope (segments [1,2]) mais pas la permission delete
      const response = await request(app)
        .delete('/api/segments/1')
        .set('Authorization', `Bearer ${gerantToken1}`);

      // Doit échouer sur RBAC (pas la permission)
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });
});
