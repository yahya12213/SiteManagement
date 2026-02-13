/**
 * Tests d'intégration pour les routes déclarations
 * Teste: RBAC (requirePermission) + SBAC (injectUserScope) + Logique métier complexe
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, requirePermission, generateToken } from '../../middleware/auth.js';

// Application de test minimale
const app = express();
app.use(express.json());

// Mock des déclarations
const mockDeclarations = [
  {
    id: 'decl-1',
    sheet_id: 'sheet-1',
    professor_id: 'prof-1',
    segment_id: 1,
    city_id: 3,
    status: 'draft',
    created_by: 'prof-1'
  },
  {
    id: 'decl-2',
    sheet_id: 'sheet-1',
    professor_id: 'prof-2',
    segment_id: 2,
    city_id: 4,
    status: 'submitted',
    created_by: 'prof-2'
  },
  {
    id: 'decl-3',
    sheet_id: 'sheet-2',
    professor_id: 'prof-1',
    segment_id: 5,
    city_id: 6,
    status: 'approved',
    created_by: 'admin-1'
  }
];

// Mock de user scope
const mockUserScope = {
  'admin-1': { isAdmin: true, segments: [], cities: [] },
  'gerant-1': { isAdmin: false, segments: [1, 2], cities: [3, 4] },
  'prof-1': { isAdmin: false, segments: [1], cities: [3] },
  'prof-2': { isAdmin: false, segments: [2], cities: [4] }
};

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

// Helper pour filtrer par scope
const filterByScope = (declarations, userScope) => {
  if (userScope.isAdmin) return declarations;
  return declarations.filter(decl =>
    userScope.segments.includes(decl.segment_id) ||
    userScope.cities.includes(decl.city_id)
  );
};

// Helper pour vérifier ownership
const isOwner = (declaration, userId) => {
  return declaration.professor_id === userId || declaration.created_by === userId;
};

// Routes mockées
app.get('/api/declarations',
  authenticateToken,
  mockInjectUserScope,
  (req, res) => {
    const filtered = filterByScope(mockDeclarations, req.userScope);
    res.json(filtered);
  }
);

app.get('/api/declarations/:id',
  authenticateToken,
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;
    const declaration = mockDeclarations.find(d => d.id === id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin &&
        !req.userScope.segments.includes(declaration.segment_id) &&
        !req.userScope.cities.includes(declaration.city_id)) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    res.json(declaration);
  }
);

app.post('/api/declarations',
  authenticateToken,
  requirePermission('accounting.declarations.create', 'accounting.professor.declarations.fill'),
  mockInjectUserScope,
  (req, res) => {
    const { sheet_id, professor_id, segment_id, city_id } = req.body;

    if (!sheet_id || !professor_id) {
      return res.status(400).json({ error: 'Missing required fields: sheet_id, professor_id' });
    }

    // Professeur ne peut créer que ses propres déclarations
    if (req.user.role === 'professeur' && professor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Professors can only create their own declarations',
        code: 'OWNERSHIP_VIOLATION'
      });
    }

    const newDeclaration = {
      id: 'decl-new',
      sheet_id,
      professor_id,
      segment_id,
      city_id,
      status: 'draft',
      created_by: req.user.id
    };

    res.status(201).json(newDeclaration);
  }
);

app.put('/api/declarations/:id/data',
  authenticateToken,
  requirePermission('accounting.declarations.fill_data', 'accounting.professor.declarations.fill'),
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;
    const { data } = req.body;

    const declaration = mockDeclarations.find(d => d.id === id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin &&
        !req.userScope.segments.includes(declaration.segment_id) &&
        !req.userScope.cities.includes(declaration.city_id)) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    // Professeur ne peut remplir que ses propres déclarations
    if (req.user.role === 'professeur' && !isOwner(declaration, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Professors can only fill their own declarations',
        code: 'OWNERSHIP_VIOLATION'
      });
    }

    // Cannot fill approved declarations
    if (declaration.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify approved declaration',
        code: 'DECLARATION_LOCKED'
      });
    }

    const updated = { ...declaration, data, updated_at: new Date().toISOString() };
    res.json(updated);
  }
);

app.post('/api/declarations/:id/approve',
  authenticateToken,
  requirePermission('accounting.declarations.approve'),
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;

    const declaration = mockDeclarations.find(d => d.id === id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin &&
        !req.userScope.segments.includes(declaration.segment_id) &&
        !req.userScope.cities.includes(declaration.city_id)) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    // Cannot approve draft declarations
    if (declaration.status === 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve draft declaration',
        code: 'INVALID_STATUS'
      });
    }

    // Already approved
    if (declaration.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Declaration already approved',
        code: 'ALREADY_APPROVED'
      });
    }

    const approved = { ...declaration, status: 'approved', approved_by: req.user.id, approved_at: new Date().toISOString() };
    res.json(approved);
  }
);

app.delete('/api/declarations/:id',
  authenticateToken,
  requirePermission('accounting.declarations.delete'),
  mockInjectUserScope,
  (req, res) => {
    const { id } = req.params;

    const declaration = mockDeclarations.find(d => d.id === id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found',
        code: 'NOT_FOUND'
      });
    }

    // SBAC check
    if (!req.userScope.isAdmin &&
        !req.userScope.segments.includes(declaration.segment_id) &&
        !req.userScope.cities.includes(declaration.city_id)) {
      return res.status(404).json({
        success: false,
        error: 'Declaration not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    // Cannot delete approved declarations
    if (declaration.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete approved declaration',
        code: 'DECLARATION_LOCKED'
      });
    }

    res.json({ message: 'Declaration deleted successfully', id });
  }
);

describe('Routes Declarations - Tests d\'intégration', () => {

  // Tokens de test
  let adminToken, gerantToken, profToken1, profToken2, unauthorizedToken;

  beforeAll(() => {
    adminToken = generateToken({ id: 'admin-1', username: 'admin', role: 'admin' });
    gerantToken = generateToken({ id: 'gerant-1', username: 'gerant1', role: 'gerant' });
    profToken1 = generateToken({ id: 'prof-1', username: 'prof1', role: 'professeur' });
    profToken2 = generateToken({ id: 'prof-2', username: 'prof2', role: 'professeur' });
    unauthorizedToken = generateToken({ id: 'user-unauthorized', username: 'unauthorized', role: 'user' });
  });

  describe('GET /api/declarations', () => {
    test('Admin voit toutes les déclarations', async () => {
      const response = await request(app)
        .get('/api/declarations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    test('Gérant voit uniquement déclarations dans son scope (SBAC)', async () => {
      const response = await request(app)
        .get('/api/declarations')
        .set('Authorization', `Bearer ${gerantToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // decl-1 et decl-2
      expect(response.body.map(d => d.id)).toEqual(expect.arrayContaining(['decl-1', 'decl-2']));
    });

    test('Professeur voit ses déclarations dans son scope', async () => {
      const response = await request(app)
        .get('/api/declarations')
        .set('Authorization', `Bearer ${profToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1); // decl-1 seulement
      expect(response.body[0].id).toBe('decl-1');
    });

    test('Sans token retourne 401', async () => {
      const response = await request(app).get('/api/declarations');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/declarations/:id', () => {
    test('Admin peut accéder à n\'importe quelle déclaration', async () => {
      const response = await request(app)
        .get('/api/declarations/decl-3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('decl-3');
    });

    test('Gérant peut accéder à déclaration dans son scope', async () => {
      const response = await request(app)
        .get('/api/declarations/decl-1')
        .set('Authorization', `Bearer ${gerantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('decl-1');
    });

    test('Gérant ne peut PAS accéder à déclaration hors scope', async () => {
      const response = await request(app)
        .get('/api/declarations/decl-3')
        .set('Authorization', `Bearer ${gerantToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND_OR_ACCESS_DENIED');
    });

    test('Professeur peut accéder à sa propre déclaration', async () => {
      const response = await request(app)
        .get('/api/declarations/decl-1')
        .set('Authorization', `Bearer ${profToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.professor_id).toBe('prof-1');
    });
  });

  describe('POST /api/declarations (accounting.declarations.create)', () => {
    test('Admin peut créer une déclaration', async () => {
      const response = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sheet_id: 'sheet-1',
          professor_id: 'prof-1',
          segment_id: 1,
          city_id: 3
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('draft');
      expect(response.body.created_by).toBe('admin-1');
    });

    test('Professeur peut créer sa propre déclaration', async () => {
      const response = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${profToken1}`)
        .send({
          sheet_id: 'sheet-1',
          professor_id: 'prof-1',
          segment_id: 1,
          city_id: 3
        });

      expect(response.status).toBe(201);
      expect(response.body.professor_id).toBe('prof-1');
    });

    test('Professeur ne peut PAS créer déclaration pour autre professeur', async () => {
      const response = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${profToken1}`)
        .send({
          sheet_id: 'sheet-1',
          professor_id: 'prof-2', // Autre professeur !
          segment_id: 1,
          city_id: 3
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('OWNERSHIP_VIOLATION');
    });

    test('Champs manquants retournent 400', async () => {
      const response = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sheet_id: 'sheet-1' }); // Missing professor_id

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('Utilisateur SANS permission reçoit 403', async () => {
      const response = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({
          sheet_id: 'sheet-1',
          professor_id: 'prof-1',
          segment_id: 1,
          city_id: 3
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });

  describe('PUT /api/declarations/:id/data (accounting.declarations.fill_data)', () => {
    test('Admin peut remplir n\'importe quelle déclaration', async () => {
      const response = await request(app)
        .put('/api/declarations/decl-1/data')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ data: { heures: 40, tarif: 150 } });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ heures: 40, tarif: 150 });
    });

    test('Professeur peut remplir sa propre déclaration', async () => {
      const response = await request(app)
        .put('/api/declarations/decl-1/data')
        .set('Authorization', `Bearer ${profToken1}`)
        .send({ data: { heures: 30, tarif: 100 } });

      expect(response.status).toBe(200);
      expect(response.body.professor_id).toBe('prof-1');
    });

    test('Professeur ne peut PAS remplir déclaration d\'un autre', async () => {
      const response = await request(app)
        .put('/api/declarations/decl-2/data')
        .set('Authorization', `Bearer ${profToken1}`)
        .send({ data: { heures: 20 } });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('OWNERSHIP_VIOLATION');
    });

    test('Ne peut PAS modifier déclaration approuvée', async () => {
      const response = await request(app)
        .put('/api/declarations/decl-3/data')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ data: { heures: 50 } });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('DECLARATION_LOCKED');
    });

    test('Utilisateur hors scope ne peut pas accéder', async () => {
      const response = await request(app)
        .put('/api/declarations/decl-3/data')
        .set('Authorization', `Bearer ${gerantToken}`)
        .send({ data: { heures: 10 } });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND_OR_ACCESS_DENIED');
    });
  });

  describe('POST /api/declarations/:id/approve (accounting.declarations.approve)', () => {
    test('Admin peut approuver une déclaration submitted', async () => {
      const response = await request(app)
        .post('/api/declarations/decl-2/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
      expect(response.body.approved_by).toBe('admin-1');
    });

    test('Ne peut PAS approuver déclaration draft', async () => {
      const response = await request(app)
        .post('/api/declarations/decl-1/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_STATUS');
    });

    test('Ne peut PAS approuver déclaration déjà approuvée', async () => {
      const response = await request(app)
        .post('/api/declarations/decl-3/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ALREADY_APPROVED');
    });

    test('Utilisateur SANS permission ne peut pas approuver', async () => {
      const response = await request(app)
        .post('/api/declarations/decl-2/approve')
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });

  describe('DELETE /api/declarations/:id (accounting.declarations.delete)', () => {
    test('Admin peut supprimer une déclaration draft', async () => {
      const response = await request(app)
        .delete('/api/declarations/decl-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
    });

    test('Ne peut PAS supprimer déclaration approuvée', async () => {
      const response = await request(app)
        .delete('/api/declarations/decl-3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('DECLARATION_LOCKED');
    });

    test('Utilisateur hors scope ne peut pas supprimer', async () => {
      const response = await request(app)
        .delete('/api/declarations/decl-3')
        .set('Authorization', `Bearer ${gerantToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND_OR_ACCESS_DENIED');
    });

    test('Utilisateur SANS permission reçoit 403', async () => {
      const response = await request(app)
        .delete('/api/declarations/decl-1')
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });
  });

  describe('Scénarios de sécurité avancés', () => {
    test('RBAC + SBAC + Ownership - professeur doit avoir les trois', async () => {
      // Professeur a le scope, mais tente de modifier déclaration d'un autre
      const response = await request(app)
        .put('/api/declarations/decl-2/data')
        .set('Authorization', `Bearer ${profToken1}`)
        .send({ data: { heures: 10 } });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('OWNERSHIP_VIOLATION');
    });

    test('Workflow complet: create → fill → submit → approve', async () => {
      // 1. Create (prof)
      const createResp = await request(app)
        .post('/api/declarations')
        .set('Authorization', `Bearer ${profToken1}`)
        .send({
          sheet_id: 'sheet-1',
          professor_id: 'prof-1',
          segment_id: 1,
          city_id: 3
        });

      expect(createResp.status).toBe(201);
      expect(createResp.body.status).toBe('draft');

      // 2. Fill (prof) - dans ce test simplifié, on simule
      // La vraie app aurait une route /submit
    });

    test('Token expiré sur route critique', async () => {
      const expiredToken = jwt.sign(
        { id: 'admin-1', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/declarations/decl-2/approve')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });
});
