/**
 * Tests unitaires pour le middleware d'authentification
 *
 * Tests couverts :
 * - generateToken()
 * - authenticateToken()
 * - requirePermission()
 * - getUserPermissions()
 * - Admin bypass
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock des modules externes
const mockPool = {
  query: jest.fn()
};

// Mock de jwt est déjà importé
jest.unstable_mockModule('../config/database.js', () => ({
  default: mockPool
}));

// Import du module à tester APRÈS les mocks
const { generateToken, authenticateToken, requirePermission, getUserPermissions } = await import('../auth.js');

describe('Authentication Middleware Tests', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset des mocks avant chaque test
    jest.clearAllMocks();

    // Mock des objets request, response, next
    req = {
      headers: {},
      path: '/api/test',
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('generateToken()', () => {
    test('génère un token JWT valide avec les bonnes données', () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        role: 'admin',
        role_id: 'role-456',
        full_name: 'Test User',
        segment_ids: [1, 2],
        city_ids: [3, 4]
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Vérifier que le token contient les bonnes données
      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
      expect(decoded.segment_ids).toEqual(user.segment_ids);
      expect(decoded.city_ids).toEqual(user.city_ids);
    });

    test('utilise des tableaux vides si segment_ids/city_ids sont manquants', () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        role: 'user',
        full_name: 'Test User'
      };

      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.segment_ids).toEqual([]);
      expect(decoded.city_ids).toEqual([]);
    });
  });

  describe('authenticateToken() middleware', () => {
    test('autorise les routes publiques sans token', () => {
      req.path = '/api/auth/login';

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('retourne 401 si aucun token fourni', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'NO_TOKEN'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('retourne 401 si le token est expiré', () => {
      // Créer un token expiré
      const expiredToken = jwt.sign(
        { id: 'user-123', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Token expiré il y a 1 heure
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'TOKEN_EXPIRED'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('retourne 403 si le token est invalide', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_TOKEN'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('accepte un token valide et définit req.user', () => {
      const user = { id: 'user-123', username: 'test', role: 'user' };
      const validToken = generateToken(user);

      req.headers.authorization = `Bearer ${validToken}`;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user.id);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getUserPermissions()', () => {
    test('récupère les permissions depuis user_roles (nouveau système)', async () => {
      const mockPermissions = [
        { code: 'accounting.segments.create' },
        { code: 'accounting.segments.view_page' }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockPermissions });

      const permissions = await getUserPermissions('user-123');

      expect(permissions).toEqual([
        'accounting.segments.create',
        'accounting.segments.view_page'
      ]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_roles'),
        ['user-123']
      );
    });

    test('fallback vers profiles.role_id si user_roles est vide', async () => {
      // Premier appel (user_roles) retourne vide
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Deuxième appel (profiles.role_id) retourne les permissions
      const mockPermissions = [
        { code: 'training.formations.view_page' }
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockPermissions });

      const permissions = await getUserPermissions('user-123');

      expect(permissions).toEqual(['training.formations.view_page']);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    test('retourne tableau vide si aucune permission trouvée', async () => {
      // Tous les appels retournent vide
      mockPool.query.mockResolvedValue({ rows: [] });

      const permissions = await getUserPermissions('user-123');

      expect(permissions).toEqual([]);
    });
  });

  describe('requirePermission() middleware', () => {
    test('retourne 401 si utilisateur non authentifié', async () => {
      const middleware = requirePermission('accounting.segments.create');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'NOT_AUTHENTICATED'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('ADMIN bypass - admin passe sans vérification de permissions', async () => {
      req.user = { id: 'admin-1', role: 'admin', username: 'admin' };

      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Même sans permissions

      const middleware = requirePermission('accounting.segments.create');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('utilisateur AVEC permission obtient l\'accès', async () => {
      req.user = { id: 'user-1', role: 'gerant', username: 'gerant1' };

      mockPool.query.mockResolvedValueOnce({
        rows: [
          { code: 'accounting.segments.create' },
          { code: 'accounting.segments.view_page' }
        ]
      });

      const middleware = requirePermission('accounting.segments.create');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('utilisateur SANS permission reçoit 403', async () => {
      req.user = { id: 'user-1', role: 'user', username: 'user1' };

      mockPool.query.mockResolvedValueOnce({
        rows: [
          { code: 'training.formations.view_page' } // Mauvaise permission
        ]
      });

      const middleware = requirePermission('accounting.segments.create');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INSUFFICIENT_PERMISSION'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('vérifie permissions multiples avec logique OR', async () => {
      req.user = { id: 'user-1', role: 'user', username: 'user1' };

      mockPool.query.mockResolvedValueOnce({
        rows: [
          { code: 'accounting.declarations.view_page' }
        ]
      });

      // Utilisateur a UNE des permissions requises
      const middleware = requirePermission(
        'accounting.declarations.view_all',
        'accounting.declarations.view_page', // Celle-ci match
        'accounting.professor.declarations.view_page'
      );

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('utilisateur avec permission wildcard (*) passe tous les checks', async () => {
      req.user = { id: 'super-admin', role: 'super_admin', username: 'superadmin' };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ code: '*' }] // Wildcard permission
      });

      const middleware = requirePermission('accounting.segments.create');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('gère les erreurs de base de données gracieusement', async () => {
      req.user = { id: 'user-1', role: 'user', username: 'user1' };

      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const middleware = requirePermission('accounting.segments.create');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'PERMISSION_CHECK_ERROR'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Scénarios d\'intégration complexes', () => {
    test('flux complet : token valide -> vérification permission -> accès accordé', async () => {
      // 1. Générer token
      const user = { id: 'user-123', username: 'test', role: 'gerant' };
      const token = generateToken(user);

      // 2. Authentifier
      req.headers.authorization = `Bearer ${token}`;
      authenticateToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();

      // 3. Reset next pour le test de permission
      next.mockClear();

      // 4. Vérifier permission
      mockPool.query.mockResolvedValueOnce({
        rows: [{ code: 'accounting.segments.create' }]
      });

      const permissionMiddleware = requirePermission('accounting.segments.create');
      await permissionMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('flux complet : pas de token -> 401 -> accès refusé', async () => {
      // 1. Pas de token
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('flux complet : token valide mais pas de permission -> 403', async () => {
      // 1. Token valide
      const user = { id: 'user-123', username: 'test', role: 'user' };
      const token = generateToken(user);
      req.headers.authorization = `Bearer ${token}`;

      authenticateToken(req, res, next);
      expect(req.user).toBeDefined();

      // 2. Pas de permission
      next.mockClear();
      res.status.mockClear();

      mockPool.query.mockResolvedValueOnce({
        rows: [] // Aucune permission
      });

      const permissionMiddleware = requirePermission('accounting.segments.delete');
      await permissionMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
