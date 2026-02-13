/**
 * Tests simplifiés pour le middleware d'authentification
 * Compatible avec ESM - sans mocks complexes
 */

import { describe, test, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { generateToken } from '../auth.js';

describe('Authentication Middleware - Tests Simples', () => {

  describe('generateToken()', () => {
    test('génère un token JWT valide', () => {
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
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    test('le token contient les données utilisateur correctes', () => {
      const user = {
        id: 'user-456',
        username: 'john',
        role: 'gerant',
        full_name: 'John Doe'
      };

      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.id).toBe('user-456');
      expect(decoded.username).toBe('john');
      expect(decoded.role).toBe('gerant');
      expect(decoded.full_name).toBe('John Doe');
    });

    test('ajoute des tableaux vides si segment_ids/city_ids manquent', () => {
      const user = {
        id: 'user-789',
        username: 'jane',
        role: 'user',
        full_name: 'Jane Smith'
      };

      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.segment_ids).toEqual([]);
      expect(decoded.city_ids).toEqual([]);
    });

    test('le token peut être vérifié avec JWT_SECRET', () => {
      const user = {
        id: 'user-999',
        username: 'admin',
        role: 'admin',
        full_name: 'Admin User'
      };

      const token = generateToken(user);

      // Vérifier que le token est valide
      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).not.toThrow();
    });

    test('le token a une expiration définie', () => {
      const user = {
        id: 'user-111',
        username: 'test',
        role: 'user',
        full_name: 'Test'
      };

      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('Token validation', () => {
    test('un token valide peut être décodé', () => {
      const payload = { id: 'test-123', role: 'user' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.id).toBe('test-123');
      expect(decoded.role).toBe('user');
    });

    test('un token avec mauvaise signature est rejeté', () => {
      const payload = { id: 'test-456', role: 'admin' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow();
    });

    test('un token expiré est rejeté', () => {
      const payload = { id: 'test-789', role: 'user' };
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1h' });

      expect(() => {
        jwt.verify(expiredToken, process.env.JWT_SECRET);
      }).toThrow('jwt expired');
    });
  });
});
