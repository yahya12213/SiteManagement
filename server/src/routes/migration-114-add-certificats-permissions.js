/**
 * Migration 114: Add missing certificats permissions
 *
 * The backend routes use training.certificates.* which converts to formation.certificats.*
 * but these permissions were missing from the database.
 *
 * FIXED: Uses correct permissions table schema with 8 columns:
 * module, menu, action, code, label, description, sort_order, permission_type
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/run', authenticateToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🚀 Migration 114: Adding certificats permissions...');

    // Define the certificats permissions with correct schema
    const certificatsPermissions = [
      {
        module: 'formation',
        menu: 'certificats',
        action: 'voir',
        code: 'formation.certificats.voir',
        label: 'Voir les certificats',
        description: 'Permet de voir les certificats generes',
        sort_order: 1,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'generer',
        code: 'formation.certificats.generer',
        label: 'Generer un certificat',
        description: 'Permet de generer un nouveau certificat pour un etudiant',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'modifier',
        code: 'formation.certificats.modifier',
        label: 'Modifier un certificat',
        description: 'Permet de modifier un certificat existant',
        sort_order: 3,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'supprimer',
        code: 'formation.certificats.supprimer',
        label: 'Supprimer un certificat',
        description: 'Permet de supprimer un certificat',
        sort_order: 4,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'telecharger',
        code: 'formation.certificats.telecharger',
        label: 'Telecharger un certificat',
        description: 'Permet de telecharger un certificat en PDF',
        sort_order: 5,
        permission_type: 'bouton'
      }
    ];

    let created = 0;
    let skipped = 0;

    for (const perm of certificatsPermissions) {
      // Check if permission already exists
      const existing = await client.query(`
        SELECT id FROM permissions WHERE code = $1
      `, [perm.code]);

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO permissions (module, menu, action, code, label, description, sort_order, permission_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order, perm.permission_type]);
        console.log(`  ✓ Created: ${perm.code}`);
        created++;
      } else {
        console.log(`  - Skipped (exists): ${perm.code}`);
        skipped++;
      }
    }

    await client.query('COMMIT');

    console.log('✅ Migration 114 completed!');
    console.log(`   - Created: ${created} permissions`);
    console.log(`   - Skipped: ${skipped} permissions`);

    res.json({
      success: true,
      message: 'Migration 114 completed successfully',
      details: {
        created,
        skipped
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 114 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Status check endpoint
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT code, label FROM permissions
      WHERE code LIKE 'formation.certificats.%'
      ORDER BY code
    `);

    res.json({
      success: true,
      migrationApplied: result.rows.length >= 5,
      permissions: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
